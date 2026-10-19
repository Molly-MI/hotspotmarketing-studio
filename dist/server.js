#!/usr/bin/env node
/* =====================================================================
 * server.js —— 热点营销工作台本地服务(零第三方依赖,仅用 Node 内置模块)
 *
 *   1) 静态托管 index.html / admin.html / *.js
 *   2) POST /api/llm      大模型代理:附加服务端密钥后转发,支持 SSE 流式
 *   3) GET|PUT /api/prompts  提示词持久化到 prompts.json(后台页面读写)
 *   4) GET  /api/config   告知前端服务端是否已配置密钥
 *
 * 启动:  node server.js        然后打开 http://localhost:8787
 * 密钥:  同目录 .env 里写 DEEPSEEK_API_KEY=sk-xxx(参考 .env.example)
 * ===================================================================== */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const newsCrawler = require('./news.js');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8787);
const PROMPT_FILE = path.join(ROOT, 'prompts.json');
const PRODUCT_FILE = path.join(ROOT, 'products.json');
const DATASET_FILE = path.join(ROOT, 'datasets.json');
const SOURCE_FILE = path.join(ROOT, 'sources.json');
const EVAL_DIR = path.join(ROOT, 'evals');

/* ---------- 极简 .env 加载(仅本地开发使用) ---------- */
(function loadEnv() {
  const f = path.join(ROOT, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
})();

const SERVER_KEY = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || '';
const DEFAULT_BASE = process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = process.env.LLM_MODEL || 'deepseek-chat';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
};

function sendJson(res, code, obj) {
  if (res.headersSent) return;
  const buf = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': buf.length, 'Cache-Control': 'no-store' });
  res.end(buf);
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => {
      raw += c;
      if (raw.length > limit) { reject(new Error('请求体过大')); req.destroy(); }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

/* ---------------------- 静态文件 ---------------------- */
function serveStatic(req, res) {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404 Not Found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

/* ---------------------- 大模型代理 ---------------------- */
async function handleLlm(req, res) {
  let body;
  try { body = JSON.parse(await readBody(req)); }
  catch (e) { return sendJson(res, 400, { error: { message: '请求体不是合法 JSON:' + e.message } }); }

  if (!Array.isArray(body.messages) || !body.messages.length)
    return sendJson(res, 400, { error: { message: 'messages 不能为空' } });

  const baseUrl = String(body.baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
  if (!/^https:\/\//i.test(baseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(baseUrl))
    return sendJson(res, 400, { error: { message: 'baseUrl 只允许 https 或本机地址' } });

  const key = body.apiKey || SERVER_KEY;
  if (!key) return sendJson(res, 400, {
    error: { message: '未提供 API Key:请在 .env 中配置 DEEPSEEK_API_KEY,或在页面「模型设置」里临时填写' },
  });

  const payload = JSON.stringify({
    model: body.model || DEFAULT_MODEL,
    messages: body.messages,
    temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
    max_tokens: body.max_tokens,
    stream: !!body.stream,
  });

  let target;
  try { target = new URL(baseUrl + '/chat/completions'); }
  catch (e) { return sendJson(res, 400, { error: { message: 'baseUrl 格式不正确' } }); }

  const mod = target.protocol === 'https:' ? https : http;
  const t0 = Date.now();
  const upstream = mod.request({
    hostname: target.hostname,
    port: target.port || (target.protocol === 'https:' ? 443 : 80),
    path: target.pathname + target.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
      'Accept': body.stream ? 'text/event-stream' : 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, up => {
    res.writeHead(up.statusCode, {
      'Content-Type': up.headers['content-type'] || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    });
    up.pipe(res);
    up.on('end', () => console.log(`[llm] ${up.statusCode} ${Date.now() - t0}ms  ${target.host} ${body.model || DEFAULT_MODEL}`));
  });

  upstream.on('error', e => {
    console.error('[llm] 上游错误:', e.message);
    sendJson(res, 502, { error: { message: '转发到大模型失败:' + e.message } });
  });
  upstream.setTimeout(180000, () => {
    upstream.destroy();
    sendJson(res, 504, { error: { message: '上游超时(180s)' } });
  });
  upstream.end(payload);
  console.log(`[llm] → ${target.host}${target.pathname} model=${body.model || DEFAULT_MODEL} stream=${!!body.stream} key=${body.apiKey ? '前端提供' : '服务端 .env'}`);
}

/* ---------------------- 提示词读写 ---------------------- */
async function handlePrompts(req, res) {
  if (req.method === 'GET') {
    if (!fs.existsSync(PROMPT_FILE)) return sendJson(res, 200, {});   // 空对象 → 前端回落默认值
    try { return sendJson(res, 200, JSON.parse(fs.readFileSync(PROMPT_FILE, 'utf8'))); }
    catch (e) { return sendJson(res, 500, { error: { message: 'prompts.json 解析失败:' + e.message } }); }
  }
  if (req.method === 'PUT' || req.method === 'POST') {
    let data;
    try { data = JSON.parse(await readBody(req)); }
    catch (e) { return sendJson(res, 400, { error: { message: '请求体不是合法 JSON' } }); }
    if (!data || typeof data.system !== 'string')
      return sendJson(res, 400, { error: { message: '缺少 system 字段,拒绝写入' } });
    try {
      /* 覆盖前留一份上一版,便于回滚 */
      if (fs.existsSync(PROMPT_FILE)) fs.copyFileSync(PROMPT_FILE, PROMPT_FILE + '.bak');
      fs.writeFileSync(PROMPT_FILE, JSON.stringify(data, null, 2), 'utf8');
      console.log('[prompts] 已写入 prompts.json');
      return sendJson(res, 200, { ok: true, updatedAt: data.updatedAt || null });
    } catch (e) {
      return sendJson(res, 500, { error: { message: '写入失败:' + e.message } });
    }
  }
  res.writeHead(405); res.end();
}

/* ---------------------- 通用 JSON 文件读写 ---------------------- */
/** 把一个 JSON 文件包装成 GET/PUT 接口;validate 返回错误字符串则拒绝写入 */
async function jsonFileRoute(req, res, file, validate) {
  if (req.method === 'GET') {
    if (!fs.existsSync(file)) return sendJson(res, 200, {});     // 空 → 前端回落默认值
    try { return sendJson(res, 200, JSON.parse(fs.readFileSync(file, 'utf8'))); }
    catch (e) { return sendJson(res, 500, { error: { message: path.basename(file) + ' 解析失败:' + e.message } }); }
  }
  if (req.method === 'PUT' || req.method === 'POST') {
    let data;
    try { data = JSON.parse(await readBody(req)); }
    catch (e) { return sendJson(res, 400, { error: { message: '请求体不是合法 JSON' } }); }
    const err = validate ? validate(data) : null;
    if (err) return sendJson(res, 400, { error: { message: err } });
    try {
      if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak');   // 留一版备份便于回滚
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
      console.log('[store] 已写入 ' + path.basename(file));
      return sendJson(res, 200, { ok: true });
    } catch (e) { return sendJson(res, 500, { error: { message: '写入失败:' + e.message } }); }
  }
  res.writeHead(405); res.end();
}

/* ---------------------- 评测运行记录 ---------------------- */
async function handleEvalRuns(req, res, query) {
  if (!fs.existsSync(EVAL_DIR)) fs.mkdirSync(EVAL_DIR, { recursive: true });

  if (req.method === 'GET') {
    const id = query.get('id');
    if (id) {
      const f = path.join(EVAL_DIR, path.basename(id) + '.json');
      if (!fs.existsSync(f)) return sendJson(res, 404, { error: { message: '运行记录不存在' } });
      return sendJson(res, 200, JSON.parse(fs.readFileSync(f, 'utf8')));
    }
    const list = fs.readdirSync(EVAL_DIR).filter(f => f.endsWith('.json')).map(f => {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(EVAL_DIR, f), 'utf8'));
        return { id: j.id || f.replace(/\.json$/, ''), savedAt: j.savedAt || null, summary: j.summary || null, meta: j.meta || null };
      } catch (e) { return null; }
    }).filter(Boolean).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
    return sendJson(res, 200, list);
  }

  if (req.method === 'POST') {
    let run;
    try { run = JSON.parse(await readBody(req, 8 * 1024 * 1024)); }
    catch (e) { return sendJson(res, 400, { error: { message: '请求体不是合法 JSON' } }); }
    if (!run || !Array.isArray(run.results)) return sendJson(res, 400, { error: { message: '缺少 results 字段' } });
    const id = String(run.id || 'run-' + Date.now()).replace(/[^\w.-]/g, '');
    run.id = id; run.savedAt = run.savedAt || new Date().toISOString();
    fs.writeFileSync(path.join(EVAL_DIR, id + '.json'), JSON.stringify(run, null, 2), 'utf8');
    console.log('[eval] 已保存运行记录 ' + id + '(' + run.results.length + ' 条结果)');
    return sendJson(res, 200, { ok: true, id });
  }
  res.writeHead(405); res.end();
}

/* ---------------------- 运行事件流水(看板数据源) ----------------------
 * 工作台每次「生成文案」「发布」都会 POST 一条事件,按行追加到 events.jsonl。
 * 看板据此统计真实的生成量、发布量、耗时、token 与成本。
 * ------------------------------------------------------------------- */
const EVENT_FILE = path.join(ROOT, 'events.jsonl');
const EVENT_TYPES = ['generate', 'publish', 'crawl', 'eval'];

async function handleEvents(req, res, query) {
  if (req.method === 'GET') {
    if (!fs.existsSync(EVENT_FILE)) return sendJson(res, 200, { events: [] });
    const limit = Math.min(Number(query.get('limit')) || 500, 5000);
    const lines = fs.readFileSync(EVENT_FILE, 'utf8').split('\n').filter(Boolean);
    const events = lines.slice(-limit).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
    return sendJson(res, 200, { events, total: lines.length });
  }
  if (req.method === 'POST') {
    let ev;
    try { ev = JSON.parse(await readBody(req, 512 * 1024)); }
    catch (e) { return sendJson(res, 400, { error: { message: '请求体不是合法 JSON' } }); }
    if (!ev || !EVENT_TYPES.includes(ev.type))
      return sendJson(res, 400, { error: { message: 'type 必须是 ' + EVENT_TYPES.join('/') } });
    ev.at = ev.at || new Date().toISOString();
    fs.appendFileSync(EVENT_FILE, JSON.stringify(ev) + '\n', 'utf8');
    return sendJson(res, 200, { ok: true });
  }
  if (req.method === 'DELETE') {
    if (fs.existsSync(EVENT_FILE)) fs.unlinkSync(EVENT_FILE);
    return sendJson(res, 200, { ok: true });
  }
  res.writeHead(405); res.end();
}

/* ---------------------- 真实热点抓取 ---------------------- */
async function handleNews(req, res, query) {
  let sources = newsCrawler.BUILTIN_SOURCES;
  if (fs.existsSync(SOURCE_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
      if (Array.isArray(saved.sources) && saved.sources.length) sources = saved.sources;
    } catch (e) { /* 配置坏了就用内置源 */ }
  }
  try {
    const payload = await newsCrawler.crawl(sources, { force: query.get('force') === '1' });
    console.log(`[news] ${payload.cached ? '命中缓存' : '实时抓取'} ${payload.items.length} 条,风险拦截 ${payload.riskCount} 条`);
    return sendJson(res, 200, payload);
  } catch (e) {
    return sendJson(res, 502, { error: { message: '抓取失败:' + e.message } });
  }
}

/* ---------------------- 路由 ---------------------- */
const server = http.createServer((req, res) => {
  const [url, qs] = req.url.split('?');
  const query = new URLSearchParams(qs || '');

  if (url === '/api/config' && req.method === 'GET')
    return sendJson(res, 200, {
      hasServerKey: !!SERVER_KEY, defaultBaseUrl: DEFAULT_BASE, defaultModel: DEFAULT_MODEL,
      liveNews: true,   // 告诉前端:本服务支持真实抓取
    });

  if (url === '/api/llm') {
    if (req.method !== 'POST') { res.writeHead(405); return res.end(); }
    return handleLlm(req, res);
  }
  if (url === '/api/prompts') return handlePrompts(req, res);

  /* 商品库 / 评测数据集 / 抓取源配置 */
  if (url === '/api/products')
    return jsonFileRoute(req, res, PRODUCT_FILE, d =>
      Array.isArray(d && d.products) && d.products.length ? null : '缺少 products 数组,拒绝写入');
  if (url === '/api/datasets')
    return jsonFileRoute(req, res, DATASET_FILE, d =>
      d && (Array.isArray(d.cases) || Array.isArray(d)) ? null : '缺少 cases 数组,拒绝写入');
  if (url === '/api/news/sources') {
    /* 尚未自定义过时,把内置源作为默认值返回,后台才有东西可编辑 */
    if (req.method === 'GET' && !fs.existsSync(SOURCE_FILE))
      return sendJson(res, 200, { sources: newsCrawler.BUILTIN_SOURCES, builtin: true });
    return jsonFileRoute(req, res, SOURCE_FILE, d =>
      Array.isArray(d && d.sources) ? null : '缺少 sources 数组,拒绝写入');
  }

  if (url === '/api/eval-runs') return handleEvalRuns(req, res, query);
  if (url === '/api/events') return handleEvents(req, res, query);
  if (url === '/api/news' && req.method === 'GET') return handleNews(req, res, query);

  if (req.method === 'GET') return serveStatic(req, res);
  res.writeHead(405); res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  热点营销工作台   http://localhost:' + PORT);
  console.log('  后台管理         http://localhost:' + PORT + '/admin.html');
  console.log('  大模型代理       POST /api/llm  →  ' + DEFAULT_BASE + '  (' + DEFAULT_MODEL + ')');
  console.log('  服务端密钥       ' + (SERVER_KEY ? '已配置 ✓' : '未配置 —— 在 .env 写 DEEPSEEK_API_KEY,或在页面「模型设置」里临时填写'));
  console.log('  提示词文件       ' + (fs.existsSync(PROMPT_FILE) ? PROMPT_FILE : '(尚未保存,后台首次保存后生成)'));
  console.log('');
});
