/* =====================================================================
 * llm.js —— 大模型接入层(工作台 index.html 与后台 admin.html 共用)
 *
 * 三种接入方式:
 *   mock   本地模板生成,无需密钥,离线可用(演示兜底)
 *   proxy  走本地 node server.js 的 /api/llm 代理 —— 密钥留在服务端,推荐
 *   direct 浏览器直连厂商接口 —— 需要该接口允许跨域(CORS)
 *
 * 协议统一为 OpenAI 兼容的 POST {baseUrl}/chat/completions,
 * 因此 DeepSeek / Kimi / 通义 / vLLM / Ollama 都可直接切换。
 * ===================================================================== */

const PROVIDERS = {
  deepseek:  { label: 'DeepSeek(深度求索)', base: 'https://api.deepseek.com/v1',                       models: ['deepseek-chat', 'deepseek-reasoner'], keyUrl: 'https://platform.deepseek.com/api_keys' },
  moonshot:  { label: 'Kimi · Moonshot',     base: 'https://api.moonshot.cn/v1',                        models: ['moonshot-v1-8k', 'moonshot-v1-32k'],  keyUrl: 'https://platform.moonshot.cn/console/api-keys' },
  dashscope: { label: '通义千问 · DashScope', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-turbo', 'qwen-max'], keyUrl: 'https://bailian.console.aliyun.com/' },
  custom:    { label: 'OpenAI 兼容 / 本地自建', base: 'http://localhost:11434/v1',                       models: ['qwen2.5:7b', 'glm4:9b'],              keyUrl: '' },
};

const LLM_DEFAULTS = {
  mode: 'mock',
  provider: 'deepseek',
  baseUrl: PROVIDERS.deepseek.base,
  model: 'deepseek-chat',
  apiKey: '',
  temperature: 1.5,   // DeepSeek 官方建议:创意写作 1.5 / 通用对话 1.3 / 数据抽取 1.0
  stream: true,
};

const MODE_LABEL = { mock: '本地 Mock', proxy: '服务端代理', direct: '浏览器直连' };

const LlmStore = {
  cfg: { ...LLM_DEFAULTS },
  configured: false,                       // 用户是否显式保存过配置
  server: { hasServerKey: false, defaultBaseUrl: '', defaultModel: '' },

  load() {
    try {
      const s = JSON.parse(localStorage.getItem('hotspot.llm') || 'null');
      if (s) { this.cfg = { ...LLM_DEFAULTS, ...s }; this.configured = true; }
    } catch (e) { /* ignore */ }
    return this.cfg;
  },

  save(next) {
    if (next) this.cfg = { ...this.cfg, ...next };
    this.configured = true;
    localStorage.setItem('hotspot.llm', JSON.stringify(this.cfg));
    return this.cfg;
  },

  /* 探测本地代理服务:若服务端已配置密钥且用户从未手动设置,则自动切到真实大模型 */
  async probeServer() {
    try {
      const res = await fetch('/api/config', { cache: 'no-store' });
      if (!res.ok) return false;
      this.server = await res.json();
      if (!this.configured && this.server.hasServerKey) {
        this.cfg.mode = 'proxy';
        if (this.server.defaultBaseUrl) this.cfg.baseUrl = this.server.defaultBaseUrl;
        if (this.server.defaultModel) this.cfg.model = this.server.defaultModel;
        return true;
      }
    } catch (e) { /* file:// 或未启动 server.js */ }
    return false;
  },

  label() {
    const c = this.cfg;
    return c.mode === 'mock' ? '本地 Mock 生成' : `${c.model} · ${MODE_LABEL[c.mode]}`;
  },
};

/* ===================================================================
 * 单次对话调用。stream=true 时通过 onDelta 增量回吐文本。
 * 返回 { text, usage, reasoning }
 * =================================================================== */
async function llmChat(messages, { stream = false, onDelta, signal, max_tokens } = {}) {
  const cfg = LlmStore.cfg;
  const viaProxy = cfg.mode === 'proxy';
  const url = viaProxy ? '/api/llm' : cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const headers = { 'Content-Type': 'application/json' };
  const body = { model: cfg.model, messages, temperature: Number(cfg.temperature), stream };
  if (max_tokens) body.max_tokens = max_tokens;
  if (viaProxy) {
    body.baseUrl = cfg.baseUrl;
    if (cfg.apiKey) body.apiKey = cfg.apiKey;   // 前端留空时由服务端 .env 提供
  } else {
    if (!cfg.apiKey) throw new Error('未填写 API Key');
    headers.Authorization = 'Bearer ' + cfg.apiKey;
  }

  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error(viaProxy
      ? `无法连接本地代理 /api/llm,请先运行 node server.js(${e.message})`
      : `请求失败,浏览器直连常见原因是接口未开放跨域(CORS),建议改用「服务端代理」模式(${e.message})`);
  }

  if (!res.ok) throw new Error(await readError(res));

  if (!stream) {
    const j = await res.json();
    return {
      text: ((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '').trim(),
      usage: j.usage || null,
      model: j.model || cfg.model,
    };
  }

  /* --- SSE 流式解析 --- */
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '', text = '', usage = null, reasoning = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      const s = line.trim();
      if (!s || !s.startsWith('data:')) continue;
      const payload = s.slice(5).trim();
      if (payload === '[DONE]') continue;
      let chunk;
      try { chunk = JSON.parse(payload); } catch (e) { continue; }
      if (chunk.usage) usage = chunk.usage;
      if (chunk.error) throw new Error(chunk.error.message || JSON.stringify(chunk.error));
      const delta = (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) || {};
      if (delta.reasoning_content) reasoning = true;          // deepseek-reasoner 思维链,不计入正文
      if (delta.content) {
        text += delta.content;
        if (onDelta) onDelta(text, { reasoning });
      }
    }
  }
  return { text: text.trim(), usage, reasoning, model: cfg.model };
}

async function readError(res) {
  let detail = '';
  try {
    const j = await res.json();
    detail = (j.error && (j.error.message || j.error.code)) || j.message || JSON.stringify(j);
  } catch (e) {
    try { detail = (await res.text()).slice(0, 300); } catch (_) { /* ignore */ }
  }
  const hint = {
    401: '(密钥无效或未授权)', 402: '(账户余额不足)', 403: '(无权限访问该模型)',
    404: '(Base URL 或模型名不存在)', 429: '(触发限流,请稍后重试)',
  }[res.status] || '';
  return `HTTP ${res.status}${hint} ${detail}`.trim();
}
