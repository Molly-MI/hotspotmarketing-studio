/* =====================================================================
 * eval.js —— 文案生成效果评测引擎(评测台 eval.html 使用)
 *
 * 设计原则:引擎与 UI 完全分离,本文件不碰任何 DOM,可被单独调用/单测。
 *
 * 六个部分:
 *   1) 数据集      DatasetStore(服务端 /api/datasets > localStorage > 内置默认)
 *   2) 规则校验层  runRules()  纯 JS、零 token、确定性强
 *   3) LLM 评委层  judgeCopy() 四维打分,容错解析 JSON
 *   4) 总分        scoreOf()   规则分 × 权重 + 评委分 × 权重
 *   5) 运行器      runEval()   并发池 + AbortController + 实时 hooks
 *   6) 运行记录    RunStore(服务端 /api/eval-runs > localStorage,本地留 20 条)
 *
 * 文案生成一律复用 PromptStore.buildMessages(),保证"评测用的提示词"
 * 与"工作台 Step 4 实际使用的提示词"完全一致。
 * ===================================================================== */

/* ===================== 通用小工具 ===================== */
const EVAL_LS = { dataset: 'hotspot.datasets', runs: 'hotspot.evalRuns', cfg: 'hotspot.evalCfg' };
const EVAL_RUNS_KEEP = 20;                     // localStorage 兜底时最多保留的运行数

function evalUid(prefix) {
  return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function evalNow() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}
/* djb2 短哈希:用于给 prompt 快照打版本指纹 */
function evalHash(input) {
  const s = typeof input === 'string' ? input : JSON.stringify(input);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36).padStart(7, '0').slice(0, 7);
}
/* 粗略 token 估算:中日韩字符约 0.7 token,其余按 4 字符 1 token(仅用于跑前预估) */
function estTokens(text) {
  const s = String(text || '');
  const cjk = (s.match(/[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/g) || []).length;
  return Math.ceil(cjk * 0.7 + Math.max(0, s.length - cjk) / 4);
}
/* 构造一个与 fetch 中止一致的错误对象(Node 里没有 DOMException) */
function abortError() {
  const e = new Error('已中止');
  e.name = 'AbortError';
  return e;
}
function clampNum(v, min, max, dflt) {
  const n = Number(v);
  if (!isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}
function costOf(tokensIn, tokensOut, priceIn, priceOut) {
  return (tokensIn / 1e6) * Number(priceIn || 0) + (tokensOut / 1e6) * Number(priceOut || 0);
}

/* =====================================================================
 * 1) 数据集
 *
 * 用例结构:
 * { id, name,
 *   news: { title, source, time, heat, summary, topics[] },
 *   products: [{ name, price, orig, cat, points[] }],
 *   tone, note }
 * ===================================================================== */
const DATASET_DEFAULTS = { cases: [], updatedAt: null };

const DatasetStore = {
  data: JSON.parse(JSON.stringify(DATASET_DEFAULTS)),
  source: 'default',            // default | local | server
  serverAvailable: false,

  async load() {
    try {
      const res = await fetch('/api/datasets', { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        this.serverAvailable = true;
        if (j && Array.isArray(j.cases) && j.cases.length) {
          this.data = this.normalize(j); this.source = 'server'; return this.data;
        }
      }
    } catch (e) { /* file:// 打开或未启动 server.js,回落本地 */ }
    try {
      const s = JSON.parse(localStorage.getItem(EVAL_LS.dataset) || 'null');
      if (s && Array.isArray(s.cases) && s.cases.length) { this.data = this.normalize(s); this.source = 'local'; }
    } catch (e) { /* ignore */ }
    return this.data;
  },

  async save(next) {
    this.data = this.normalize(next || this.data);
    this.data.updatedAt = new Date().toISOString();
    try { localStorage.setItem(EVAL_LS.dataset, JSON.stringify(this.data)); } catch (e) { /* 超配额时忽略 */ }
    this.source = 'local';
    if (this.serverAvailable) {
      const res = await fetch('/api/datasets', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.data),
      });
      if (!res.ok) throw new Error('服务端写入失败:HTTP ' + res.status);
      this.source = 'server';
    }
    return this.source;
  },

  /* 兜底补全字段,避免手工编辑/导入的脏数据让评测崩溃 */
  normalize(d) {
    const out = { cases: [], updatedAt: (d && d.updatedAt) || null };
    const list = (d && Array.isArray(d.cases)) ? d.cases : [];
    out.cases = list.map((k, i) => {
      const news = k.news || {};
      return {
        id: k.id || evalUid('case_'),
        name: String(k.name || `用例 ${i + 1}`),
        news: {
          title: String(news.title || ''),
          source: String(news.source || ''),
          time: String(news.time || ''),
          heat: Number(news.heat) || 0,
          summary: String(news.summary || ''),
          topics: Array.isArray(news.topics) ? news.topics.map(t => String(t).trim()).filter(Boolean) : [],
        },
        products: (Array.isArray(k.products) ? k.products : []).map(p => ({
          name: String(p.name || ''),
          price: Number(p.price) || 0,
          orig: Number(p.orig) || 0,
          cat: String(p.cat || ''),
          points: Array.isArray(p.points) ? p.points.map(String) : String(p.points || '').split(/[、,,]/).filter(Boolean),
        })),
        tone: String(k.tone || ''),
        note: String(k.note || ''),
      };
    });
    return out;
  },

  /* 用 data.js 的 NEWS + MATCH_MAP + PRODUCTS 生成 6 条种子用例:
     每条热点取匹配度最高的 2 个商品,语调取提示词配置里的第一个 */
  seed() {
    if (typeof NEWS === 'undefined' || typeof PRODUCTS === 'undefined' || typeof MATCH_MAP === 'undefined')
      throw new Error('未加载 data.js,无法生成种子用例');
    const tone = (typeof PromptStore !== 'undefined' && PromptStore.data.tones[0]) || '热点借势';
    const byId = {};
    PRODUCTS.forEach(p => { byId[p.id] = p; });
    return NEWS.slice(0, 6).map((n, i) => {
      const picked = (MATCH_MAP[n.id] || []).slice()
        .sort((a, b) => b.score - a.score).slice(0, 2)
        .map(m => byId[m.pid]).filter(Boolean);
      return {
        id: 'case_seed_' + n.id,
        name: `种子 ${i + 1} · ${n.title.slice(0, 12)}`,
        news: { title: n.title, source: n.source, time: n.time, heat: n.heat, summary: n.summary, topics: [...n.topics] },
        products: picked.map(p => ({ name: p.name, price: p.price, orig: p.orig, cat: p.cat, points: [...p.points] })),
        tone,
        note: '由匹配库自动生成',
      };
    });
  },
};

/* =====================================================================
 * 2) 规则校验层(纯 JS,不花 token)
 * ===================================================================== */

/* 广告法违禁词 / 绝对化用语(命中即判失败) */
const BANNED_WORDS = [
  '最佳', '最好', '最大', '最高', '最低', '最强', '最优', '第一', '国家级', '世界级', '顶级',
  '极致', '绝对', '永久', '100%', '全网最低', '史上最', '独家', '唯一', '首选', '冠军',
  '领导品牌', '完美', '万能', '包治', '神效', '立竿见影',
];

/* 结尾互动引导关键词(命中其一即通过) */
const CTA_WORDS = ['评论', '转发', '关注', '点击', '主页', '橱窗', '抽', '送', '聊聊', '说说', '蹲', '晒'];

/* 规则元信息:UI 用来画说明表 */
const RULE_DEFS = [
  { key: 'length',   label: '字数 140~220',    weight: 1, desc: '不含空白字符的正文字数' },
  { key: 'topics',   label: '话题标签',        weight: 2, desc: '必须含用例给定的每个话题,全文标签总数 1~3 个' },
  { key: 'emoji',    label: 'emoji 2~5 个',    weight: 1, desc: '过少没网感,过多像刷屏' },
  { key: 'banned',   label: '广告法违禁词',    weight: 3, desc: '绝对化用语命中即失败,最高权重' },
  { key: 'price',    label: '价格幻觉',        weight: 3, desc: '文案里出现的价格必须来自商品的售价/原价' },
  { key: 'cta',      label: '结尾互动引导',    weight: 1, desc: '评论/转发/关注/抽奖/主页橱窗等引导' },
  { key: 'markdown', label: '无 markdown 标记', weight: 1, desc: '微博正文不应出现 **、##、``` 或行首 - ' },
  { key: 'product',  label: '提及商品',        weight: 2, desc: '至少出现 1 个商品名的核心词' },
];
const RULE_WEIGHT_SUM = RULE_DEFS.reduce((s, r) => s + r.weight, 0);

/* 提取全文话题标签 #xxx# */
function extractTopics(text) {
  return String(text || '').match(/#[^#\s]{1,30}#/g) || [];
}
/* 统计 emoji 数量 */
function countEmoji(text) {
  return (String(text || '').match(/\p{Extended_Pictographic}/gu) || []).length;
}
/* 提取文案中出现的价格数字:¥39.9 / 39.9元 两种写法 */
function extractPrices(text) {
  const s = String(text || '');
  const out = [];
  let m;
  const re1 = /[¥￥]\s*(\d+(?:\.\d+)?)/g;
  while ((m = re1.exec(s))) out.push(Number(m[1]));
  const re2 = /(\d+(?:\.\d+)?)\s*元/g;
  while ((m = re2.exec(s))) out.push(Number(m[1]));
  return out.filter((v, i, a) => a.indexOf(v) === i);
}
/* 商品名核心词:'零感冰丝空调被 · 抗菌夏凉被' → '零感冰丝空调被' */
function productCore(name) {
  return String(name || '').split(' ·')[0].trim();
}

/**
 * 规则校验
 * @param {string} text 待评文案
 * @param {object} kase 用例
 * @returns {{items: Array, score: number, passCount: number}} score 为 0~100 的加权得分
 */
function runRules(text, kase) {
  const t = String(text || '');
  const k = kase || {};
  const news = k.news || {};
  const products = Array.isArray(k.products) ? k.products : [];
  const mk = (key, pass, detail, extra) => {
    const def = RULE_DEFS.find(r => r.key === key);
    return { key, label: def.label, weight: def.weight, pass: !!pass, detail, ...(extra || {}) };
  };
  const items = [];

  /* --- 字数 --- */
  const chars = t.replace(/\s/g, '').length;
  items.push(mk('length', chars >= 140 && chars <= 220,
    `实际 ${chars} 字(不含空白),要求 140~220`));

  /* --- 话题标签 --- */
  const need = news.topics || [];
  const got = extractTopics(t);
  const missing = need.filter(x => t.indexOf(x) < 0);
  const topicOk = missing.length === 0 && got.length >= 1 && got.length <= 3;
  items.push(mk('topics', topicOk,
    (missing.length ? `缺失指定话题:${missing.join(' ')};` : '指定话题已全部覆盖;')
    + `全文共 ${got.length} 个标签${got.length ? '(' + got.join(' ') + ')' : ''},要求 1~3 个`));

  /* --- emoji --- */
  const emo = countEmoji(t);
  items.push(mk('emoji', emo >= 2 && emo <= 5, `共 ${emo} 个 emoji,要求 2~5 个`));

  /* --- 广告法违禁词 --- */
  const hitWords = BANNED_WORDS.filter(w => t.indexOf(w) >= 0);
  items.push(mk('banned', hitWords.length === 0,
    hitWords.length ? `命中违禁词:${hitWords.join('、')}` : '未命中任何绝对化用语',
    { words: hitWords }));

  /* --- 价格幻觉 --- */
  const allowed = [];
  products.forEach(p => {
    if (Number(p.price)) allowed.push(Number(p.price));
    if (Number(p.orig)) allowed.push(Number(p.orig));
  });
  const found = extractPrices(t);
  const fake = found.filter(v => !allowed.some(a => Math.abs(a - v) < 0.001));
  items.push(mk('price', fake.length === 0,
    found.length === 0 ? '文案中未出现价格'
      : (fake.length ? `编造价格:${fake.map(v => '¥' + v).join('、')};素材可用价格:${allowed.map(v => '¥' + v).join('、') || '无'}`
        : `出现 ${found.length} 个价格,全部来自素材`),
    { fake, found }));

  /* --- 结尾互动引导(只看结尾 80 字) --- */
  const tail = t.trim().slice(-80);
  const ctaHit = CTA_WORDS.filter(w => tail.indexOf(w) >= 0);
  items.push(mk('cta', ctaHit.length > 0,
    ctaHit.length ? `结尾命中引导词:${ctaHit.join('、')}` : '结尾 80 字内未发现互动引导'));

  /* --- markdown 标记(先剔除 #话题# 避免 "#a##b#" 误判为 ##) --- */
  const stripped = t.replace(/#[^#\s]{1,30}#/g, '');
  const mdHits = [];
  if (stripped.indexOf('**') >= 0) mdHits.push('**');
  if (stripped.indexOf('##') >= 0) mdHits.push('##');
  if (stripped.indexOf('```') >= 0) mdHits.push('```');
  if (/^[ \t]*-[ \t]+\S/m.test(stripped)) mdHits.push('行首 "- "');
  items.push(mk('markdown', mdHits.length === 0,
    mdHits.length ? `出现 markdown 标记:${mdHits.join('、')}` : '正文为纯文本'));

  /* --- 提及商品 --- */
  const cores = products.map(p => productCore(p.name)).filter(Boolean);
  const hitCores = cores.filter(c => t.indexOf(c) >= 0);
  items.push(mk('product', hitCores.length > 0,
    hitCores.length ? `已提及:${hitCores.join('、')}` : `未提及任何商品(核心词:${cores.join('、') || '无'})`));

  const gain = items.reduce((s, r) => s + (r.pass ? r.weight : 0), 0);
  return {
    items,
    score: Math.round((gain / RULE_WEIGHT_SUM) * 1000) / 10,
    passCount: items.filter(r => r.pass).length,
  };
}

/* =====================================================================
 * 2.5) 合规自愈 —— 校验不过时,带着失败原因让模型自己改一版
 *
 * 工作台(手工「一键修正」与自动流水线)共用这里,保证两条路径
 * 用的是同一套修正逻辑与同一份可后台编辑的提示词。
 * ===================================================================== */

/** 只有这些规则失败值得回炉重修;像"提及商品"这类失败改了也多半没用 */
const REPAIRABLE_RULES = ['length', 'banned', 'price', 'topics', 'cta', 'markdown', 'emoji'];

/** 把失败项整理成给模型看的清单 */
function describeFailures(ruleItems) {
  return (ruleItems || [])
    .filter(r => !r.pass && REPAIRABLE_RULES.includes(r.key))
    .map((r, i) => `${i + 1}. 【${r.label}】${r.detail}`)
    .join('\n');
}

function buildRepairMessages(text, kase, ruleItems) {
  const d = PromptStore.data;
  const products = (kase.products || []).map((p, i) =>
    renderTemplate(d.productLine, {
      index: i + 1, name: p.name, price: p.price, orig: p.orig, cat: p.cat,
      points: Array.isArray(p.points) ? p.points.join('、') : p.points,
    })).join('\n');
  const user = renderTemplate(d.repairTemplate || PROMPT_DEFAULTS.repairTemplate, {
    copy: text,
    failures: describeFailures(ruleItems),
    products,
    topics: (kase.news && kase.news.topics || []).join(' '),
  });
  return [
    { role: 'system', content: renderTemplate(d.system, { news: kase.news, tone: kase.tone }) },
    { role: 'user', content: user },
  ];
}

/**
 * 反复修正直到规则通过或用尽次数。
 * @returns {Promise<{text, rules, rounds, history:[{round, text, score, fixed, remaining}]}>}
 */
async function repairCopy(text, kase, { maxRounds = 1, signal, onRound } = {}) {
  let cur = text;
  let rules = runRules(cur, kase);
  const history = [];
  let rounds = 0;

  while (rounds < maxRounds) {
    const failed = rules.items.filter(r => !r.pass && REPAIRABLE_RULES.includes(r.key));
    if (!failed.length) break;                       // 已无可修项

    rounds++;
    if (onRound) onRound({ round: rounds, phase: 'start', failed });
    let next;
    try {
      /* 修正是"照着清单改错",低温更稳,不需要发挥 */
      const backupTemp = LlmStore.cfg.temperature;
      LlmStore.cfg = { ...LlmStore.cfg, temperature: 0.4 };
      try {
        const r = await llmChat(buildRepairMessages(cur, kase, rules.items), { stream: false, signal });
        next = (r.text || '').trim();
      } finally {
        LlmStore.cfg = { ...LlmStore.cfg, temperature: backupTemp };
      }
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      history.push({ round: rounds, error: e.message });
      break;                                          // 修正调用失败就用原文交人工
    }
    if (!next) { history.push({ round: rounds, error: '修正返回为空' }); break; }

    const nextRules = runRules(next, kase);
    const before = rules.items.filter(r => !r.pass).map(r => r.key);
    const after = nextRules.items.filter(r => !r.pass).map(r => r.key);

    /* 只有确实变好才采纳,避免越修越差 */
    if (nextRules.score >= rules.score) {
      history.push({ round: rounds, text: next, score: nextRules.score,
        fixed: before.filter(k => !after.includes(k)), remaining: after });
      cur = next; rules = nextRules;
    } else {
      history.push({ round: rounds, text: next, score: nextRules.score, rejected: true,
        fixed: [], remaining: after });
      if (onRound) onRound({ round: rounds, phase: 'rejected', score: nextRules.score });
      break;                                          // 改差了就保留上一版
    }
    if (onRound) onRound({ round: rounds, phase: 'done', score: rules.score, remaining: after });
  }

  return { text: cur, rules, rounds, history, changed: cur !== text };
}

/* =====================================================================
 * 3) LLM 评委层
 * ===================================================================== */
const JUDGE_DIMS = [
  ['relevance', '热点关联度'],
  ['coverage', '卖点价格覆盖'],
  ['appeal', '传播吸引力'],
  ['tone', '语气自然度'],
];

const JUDGE_PROMPT_DEFAULT = `你是资深的电商内容评审专家,负责为「热点借势微博营销文案」打分。

请阅读给定的热点新闻、商品资料与待评文案,从以下 4 个维度各打 1~5 分(整数,5 分最好):
- relevance 热点关联度:是否真正借势该热点,而不是生硬贴一个标签。
- coverage  卖点与价格覆盖准确度:是否准确使用了商品卖点与给定价格,有无编造功效、销量或数字。
- appeal    传播吸引力:钩子、节奏与互动设计是否能带来点击、评论与转发。
- tone      语气自然度:是否像真人运营在发微博,而不是 AI 腔或企业公告腔。

输出要求:
1. 只输出一个 JSON 对象,不要任何解释文字,不要 markdown 代码块。
2. 严格使用如下格式(comment 为一句话点评,不超过 40 字):
{"relevance":4,"coverage":5,"appeal":4,"tone":5,"comment":"点评"}`;

/* 组装评委 messages:system 为可编辑的评委提示词,user 为素材 + 待评文案 */
function buildJudgeMessages(text, kase, judgePrompt) {
  const k = kase || {};
  const n = k.news || {};
  const prod = (k.products || []).map((p, i) =>
    `${i + 1}. ${p.name} | 售价 ¥${p.price}(原价 ¥${p.orig}) | 品类 ${p.cat} | 卖点 ${(p.points || []).join('、')}`
  ).join('\n') || '(无)';
  const user = `【热点新闻】
标题:${n.title || ''}
来源:${n.source || ''} · ${n.time || ''} · 热度 ${n.heat || 0}
摘要:${n.summary || ''}
话题标签:${(n.topics || []).join(' ')}

【待推商品】
${prod}

【整体语调】${k.tone || ''}

【待评文案】
${text}

请按要求只输出 JSON。`;
  return [
    { role: 'system', content: judgePrompt || JUDGE_PROMPT_DEFAULT },
    { role: 'user', content: user },
  ];
}

/* 从模型回复里抠出第一个完整的 {...} 并解析(容忍 ```json 包裹与前后废话) */
function parseJudgeJson(raw) {
  const s = String(raw || '');
  const start = s.indexOf('{');
  if (start < 0) throw new Error('回复中没有找到 JSON 对象');
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error('JSON 对象没有闭合');
  const obj = JSON.parse(s.slice(start, end + 1));
  const scores = {};
  JUDGE_DIMS.forEach(([key]) => {
    const v = Number(obj[key]);
    if (!isFinite(v)) throw new Error(`缺少维度 ${key}`);
    scores[key] = clampNum(Math.round(v), 1, 5, 1);
  });
  return { scores, comment: String(obj.comment || '').slice(0, 120) };
}

/* 四维 1~5 分 → 0~100 分(5 分 = 100 分) */
function judgeScoreOf(scores) {
  const vals = JUDGE_DIMS.map(([k]) => Number(scores[k]) || 0);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round((avg / 5) * 1000) / 10;
}

/**
 * 调用大模型评委。永远不抛异常 —— 失败时返回 { ok:false, error },不中断整轮评测。
 * temperature 固定 0.2 保证打分稳定:llmChat 只读 LlmStore.cfg,
 * 而它在第一个 await 之前就已把 temperature 写进请求体,
 * 因此"改 → 同步调用 → 立刻改回"在并发下也是安全的。
 */
async function judgeCopy(text, kase, opts) {
  const o = opts || {};
  const msgs = buildJudgeMessages(text, kase, o.judgePrompt);
  let r;
  try {
    const prev = LlmStore.cfg.temperature;
    LlmStore.cfg.temperature = 0.2;
    try {
      r = llmChat(msgs, { stream: false, signal: o.signal, max_tokens: 200 });
    } finally {
      LlmStore.cfg.temperature = prev;
    }
    r = await r;
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    return { ok: false, error: '评委调用失败:' + e.message, usage: null };
  }
  try {
    const parsed = parseJudgeJson(r.text);
    return { ok: true, scores: parsed.scores, comment: parsed.comment, raw: r.text, usage: r.usage || null };
  } catch (e) {
    return { ok: false, error: '评委输出无法解析:' + e.message, raw: r.text, usage: r.usage || null };
  }
}

/* =====================================================================
 * 4) 总分
 * ===================================================================== */
/** 总分 = 规则分 × 规则权重 + 评委分 × 评委权重;评委缺席时规则分即总分 */
function scoreOf(ruleScore, judgeScore, ruleWeight, judgeWeight) {
  const rw = Number(ruleWeight), jw = Number(judgeWeight);
  if (judgeScore == null || !isFinite(judgeScore) || jw <= 0) return Math.round(ruleScore * 10) / 10;
  const sum = (rw > 0 ? rw : 0) + jw;
  if (!sum) return Math.round(ruleScore * 10) / 10;
  return Math.round(((ruleScore * rw + judgeScore * jw) / sum) * 10) / 10;
}

/* =====================================================================
 * 5) 运行器
 * ===================================================================== */
const EVAL_DEFAULTS = {
  concurrency: 3,          // 并发池大小 1~8
  repeat: 1,               // 每个「用例 × 风格」重复次数
  judgeEnabled: true,      // 是否启用 LLM 评委
  ruleWeight: 50,          // 规则分权重(%)
  judgeWeight: 50,         // 评委分权重(%)
  priceIn: 2,              // 输入单价 元 / 百万 token(deepseek-chat 参考价)
  priceOut: 8,             // 输出单价 元 / 百万 token(deepseek-chat 参考价)
  judgePrompt: JUDGE_PROMPT_DEFAULT,
  maxTokens: 700,          // 单条文案生成上限
};

function normalizeEvalCfg(cfg) {
  const c = { ...EVAL_DEFAULTS, ...(cfg || {}) };
  c.concurrency = Math.round(clampNum(c.concurrency, 1, 8, 3));
  c.repeat = Math.round(clampNum(c.repeat, 1, 10, 1));
  c.ruleWeight = clampNum(c.ruleWeight, 0, 100, 50);
  c.judgeWeight = clampNum(c.judgeWeight, 0, 100, 50);
  c.priceIn = clampNum(c.priceIn, 0, 10000, 2);
  c.priceOut = clampNum(c.priceOut, 0, 10000, 8);
  c.judgeEnabled = !!c.judgeEnabled;
  c.judgePrompt = String(c.judgePrompt || JUDGE_PROMPT_DEFAULT);
  c.cases = Array.isArray(c.cases) ? c.cases : [];
  c.styles = Array.isArray(c.styles) ? c.styles : [];
  return c;
}

/* 当前提示词快照:用于事后判断"这次跑分是哪一版 prompt 产出的" */
function promptSnapshot() {
  const d = (typeof PromptStore !== 'undefined' && PromptStore.data) || {};
  const snap = {
    system: d.system || '',
    userTemplate: d.userTemplate || '',
    productLine: d.productLine || '',
    styles: (d.styles || []).map(s => ({ key: s.key, name: s.name, brief: s.brief })),
    updatedAt: d.updatedAt || null,
  };
  snap.hash = evalHash([snap.system, snap.userTemplate, snap.productLine, JSON.stringify(snap.styles)].join(''));
  return snap;
}

/* 本地 Mock 文案:mode=mock 时使用,与工作台 index.html 的模板保持一致,离线也能跑通整条链路 */
function mockCopy(kase, style, seq) {
  const n = kase.news || {};
  const ps = kase.products || [];
  const topic = (n.topics || [])[0] || '#热点#';
  const topic2 = (n.topics || [])[1] || '';
  const p1 = ps[0] || { name: '好物', price: 0, orig: 0, points: ['好用'] };
  const names = ps.map(p => productCore(p.name));
  const priceLine = ps.map(p => `${productCore(p.name)} 直降到手 ¥${p.price}`).join(',');
  const pointLine = (p1.points || []).slice(0, 2).join('+');

  const vA = `${topic} 冲上热搜!${String(n.title || '').slice(0, 18)}…这波热度谁还没跟上?🔥\n\n实测好物安利👉 ${names.join(' × ')},${pointLine},谁用谁知道!✨\n\n${priceLine}💰 手慢无!\n\n点击主页橱窗直达👆 评论区蹲一个真实反馈~ ${topic2}`;
  const vB = `⏰ 限时 48 小时!${topic} 应援专场开抢!\n\n${ps.map(p => `🛒 ${productCore(p.name)}:原价¥${p.orig},现价¥${p.price},${(p.points || [])[0] || ''}`).join('\n')}\n\n💥 叠加店铺券再减 10 元,今晚 8 点准时开抢!\n\n转发+关注,抽 3 位小伙伴免单!🎁 ${topic}`;
  const vC = `姐妹们!${String(n.title || '').slice(0, 15)}…你们那边也这样吗?😭\n\n评论区聊聊:这个夏天你最离不开哪件好物?\n\n我先来:全靠 ${names[0] || '它'} 续命!${pointLine},真的绝了👍\n\n🎁 今晚抽 5 位评论区宝子送同款!转发让更多人看到~ ${topic} ${topic2}`;

  const pool = [vA, vB, vC];
  const idx = (String(style.key || '').charCodeAt(0) - 65 + (seq || 0));
  return pool[((idx % pool.length) + pool.length) % pool.length];
}

/* 单条任务:生成 → 规则 → 评委 → 总分。异常都收进 item,不向外抛(中止除外) */
async function runOneTask(item, kase, style, c, signal) {
  const t0 = evalNow();
  try {
    if (signal && signal.aborted) throw abortError();

    /* --- 生成文案:复用工作台同一套 buildMessages --- */
    let text = '', usage = null;
    const isMock = typeof LlmStore !== 'undefined' && LlmStore.cfg.mode === 'mock';
    if (isMock) {
      await new Promise(r => setTimeout(r, 120));
      text = mockCopy(kase, style, item.repeat - 1);
      item.mock = true;
    } else {
      const msgs = PromptStore.buildMessages({
        news: kase.news, products: kase.products, tone: kase.tone, style,
      });
      const r = await llmChat(msgs, { stream: false, signal, max_tokens: c.maxTokens });
      text = r.text || '';
      usage = r.usage || null;
      if (!text.trim()) throw new Error('模型返回为空');
    }
    item.text = text;
    item.chars = text.replace(/\s/g, '').length;
    if (usage) {
      item.tokensIn += Number(usage.prompt_tokens) || 0;
      item.tokensOut += Number(usage.completion_tokens) || 0;
    }

    /* --- 规则层 --- */
    const rules = runRules(text, kase);
    item.rules = rules.items;
    item.ruleScore = rules.score;
    item.banned = !rules.items.find(r => r.key === 'banned').pass;
    item.priceFake = !rules.items.find(r => r.key === 'price').pass;

    /* --- 评委层 --- */
    if (c.judgeEnabled && !isMock) {
      const j = await judgeCopy(text, kase, { judgePrompt: c.judgePrompt, signal });
      item.judge = j;
      if (j.usage) {
        item.tokensIn += Number(j.usage.prompt_tokens) || 0;
        item.tokensOut += Number(j.usage.completion_tokens) || 0;
      }
      item.judgeScore = j.ok ? judgeScoreOf(j.scores) : null;
    } else if (c.judgeEnabled && isMock) {
      item.judge = { ok: false, skipped: true, error: '本地 Mock 模式不调用 LLM 评委,本条只计规则分' };
      item.judgeScore = null;
    }

    item.score = scoreOf(item.ruleScore, item.judgeScore, c.ruleWeight, c.judgeWeight);
    item.status = 'done';
  } catch (e) {
    if (e && e.name === 'AbortError') { item.status = 'aborted'; item.error = '已中止'; }
    else { item.status = 'error'; item.error = e.message || String(e); }
  } finally {
    item.ms = Math.round(evalNow() - t0);
  }
  return item;
}

/**
 * 批量评测:每个选中用例 × 每个选中风格 × 重复 N 次
 * @param {object} cfg   { cases[], styles[], concurrency, repeat, judgeEnabled, ruleWeight, judgeWeight, priceIn, priceOut, judgePrompt, signal }
 * @param {object} hooks { onStart(run), onUpdate(item, progress), onProgress(progress), onDone(run) }
 * @returns {Promise<object>} run
 */
async function runEval(cfg, hooks) {
  const h = hooks || {};
  const c = normalizeEvalCfg(cfg);
  if (!c.cases.length) throw new Error('没有选中任何用例');
  if (!c.styles.length) throw new Error('没有选中任何风格');
  const signal = (cfg && cfg.signal) || null;

  /* 展开任务矩阵;plan 与 results 一一对应,results 保持可 JSON 序列化 */
  const items = [], plan = [];
  c.cases.forEach(k => {
    c.styles.forEach(s => {
      for (let r = 1; r <= c.repeat; r++) {
        plan.push({ kase: k, style: s });
        items.push({
          idx: items.length, caseId: k.id, caseName: k.name, newsTitle: (k.news || {}).title || '',
          tone: k.tone, styleKey: s.key, styleName: s.name, repeat: r,
          status: 'pending', text: '', chars: 0, rules: [], ruleScore: 0,
          judge: null, judgeScore: null, score: 0, banned: false, priceFake: false,
          tokensIn: 0, tokensOut: 0, ms: 0, error: '', mark: 0, note: '',
        });
      }
    });
  });

  const model = (typeof LlmStore !== 'undefined' ? LlmStore.label() : '未知');
  const snap = promptSnapshot();
  const run = {
    id: evalUid('run_'),
    startedAt: new Date().toISOString(),
    savedAt: null,
    model,
    mode: (typeof LlmStore !== 'undefined' ? LlmStore.cfg.mode : 'mock'),
    cfg: {
      concurrency: c.concurrency, repeat: c.repeat, judgeEnabled: c.judgeEnabled,
      ruleWeight: c.ruleWeight, judgeWeight: c.judgeWeight,
      priceIn: c.priceIn, priceOut: c.priceOut, judgePrompt: c.judgePrompt,
      caseCount: c.cases.length, styleCount: c.styles.length,
      caseIds: c.cases.map(k => k.id), styleKeys: c.styles.map(s => s.key),
    },
    prompt: snap,
    /* meta:服务端 GET /api/eval-runs 的列表只回 {id, savedAt, summary, meta},
       历史页要显示的字段都得放进这里 */
    meta: {
      model, promptHash: snap.hash,
      caseCount: c.cases.length, styleCount: c.styles.length, repeat: c.repeat,
      judgeEnabled: c.judgeEnabled, ruleWeight: c.ruleWeight, judgeWeight: c.judgeWeight,
    },
    /* 字段名用 results:与 server.js 的 POST /api/eval-runs 校验保持一致 */
    results: items,
    summary: null, ms: 0, aborted: false,
  };

  if (h.onStart) h.onStart(run);

  const t0 = evalNow();
  let cursor = 0, done = 0;
  const total = items.length;

  /* 并发池:固定 N 个 worker 轮流取任务,避免一次性把请求全打出去 */
  async function worker() {
    for (;;) {
      if (signal && signal.aborted) return;
      const i = cursor++;
      if (i >= total) return;
      const it = items[i];
      it.status = 'running';
      if (h.onUpdate) h.onUpdate(it, { done, total });
      await runOneTask(it, plan[i].kase, plan[i].style, c, signal);
      done++;
      if (h.onUpdate) h.onUpdate(it, { done, total });
      if (h.onProgress) h.onProgress({ done, total, ms: Math.round(evalNow() - t0) });
    }
  }
  await Promise.all(Array.from({ length: Math.min(c.concurrency, total) }, worker));

  /* 中止时把没轮到的任务标成已跳过 */
  if (signal && signal.aborted) {
    run.aborted = true;
    items.forEach(it => { if (it.status === 'pending' || it.status === 'running') { it.status = 'aborted'; it.error = '已中止'; } });
  }
  run.ms = Math.round(evalNow() - t0);
  run.summary = summarizeRun(run);
  if (h.onDone) h.onDone(run);
  return run;
}

/** 汇总统计(人工标注变化后可随时重算) */
function summarizeRun(run) {
  const items = run.results || [];
  const c = run.cfg || {};
  const ok = items.filter(i => i.status === 'done');
  const avg = arr => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
  const judged = ok.filter(i => i.judgeScore != null);
  let checkPass = 0, checkTotal = 0, bannedWords = 0;
  ok.forEach(i => {
    (i.rules || []).forEach(r => { checkTotal++; if (r.pass) checkPass++; });
    const b = (i.rules || []).find(r => r.key === 'banned');
    if (b && !b.pass) bannedWords += (b.words || []).length;
  });
  const tokensIn = items.reduce((s, i) => s + (i.tokensIn || 0), 0);
  const tokensOut = items.reduce((s, i) => s + (i.tokensOut || 0), 0);
  return {
    total: items.length,
    done: ok.length,
    errors: items.filter(i => i.status === 'error').length,
    aborted: items.filter(i => i.status === 'aborted').length,
    avgScore: avg(ok.map(i => i.score)),
    avgRule: avg(ok.map(i => i.ruleScore)),
    avgJudge: judged.length ? avg(judged.map(i => i.judgeScore)) : null,
    judgedCount: judged.length,
    judgeFailed: ok.filter(i => i.judge && !i.judge.ok && !i.judge.skipped).length,
    avgChars: avg(ok.map(i => i.chars)),
    rulePassRate: checkTotal ? Math.round((checkPass / checkTotal) * 1000) / 10 : 0,
    fullPass: ok.filter(i => (i.rules || []).every(r => r.pass)).length,
    bannedCases: ok.filter(i => i.banned).length,
    bannedWords,
    priceCases: ok.filter(i => i.priceFake).length,
    tokensIn, tokensOut,
    cost: Math.round(costOf(tokensIn, tokensOut, c.priceIn, c.priceOut) * 10000) / 10000,
    ms: run.ms || 0,
    up: items.filter(i => i.mark === 1).length,
    down: items.filter(i => i.mark === -1).length,
  };
}

/** 跑前预估:任务数与 token / 费用(粗略,仅供心里有数) */
function estimateRun(cfg) {
  const c = normalizeEvalCfg(cfg);
  const tasks = c.cases.length * c.styles.length * c.repeat;
  if (!tasks) return { tasks: 0, tokensIn: 0, tokensOut: 0, cost: 0 };
  const k0 = c.cases[0], s0 = c.styles[0];
  let perIn = 0, perOut = 320;
  try {
    const msgs = PromptStore.buildMessages({ news: k0.news, products: k0.products, tone: k0.tone, style: s0 });
    perIn = estTokens(msgs.map(m => m.content).join('\n'));
  } catch (e) { perIn = 600; }
  if (c.judgeEnabled) {
    const jm = buildJudgeMessages('X'.repeat(200), k0, c.judgePrompt);
    perIn += estTokens(jm.map(m => m.content).join('\n'));
    perOut += 90;
  }
  const tokensIn = perIn * tasks, tokensOut = perOut * tasks;
  return {
    tasks, tokensIn, tokensOut,
    cost: Math.round(costOf(tokensIn, tokensOut, c.priceIn, c.priceOut) * 10000) / 10000,
  };
}

/* =====================================================================
 * 6) 运行记录
 * ===================================================================== */
const RunStore = {
  serverAvailable: false,
  source: 'default',           // default | local | server

  /* 历史摘要列表 [{id, savedAt, summary, meta}](与服务端返回结构保持一致) */
  async list() {
    try {
      const res = await fetch('/api/eval-runs', { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        this.serverAvailable = true;
        if (Array.isArray(j)) {
          this.source = 'server';
          return j.slice().sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
        }
      }
    } catch (e) { /* 回落本地 */ }
    this.source = 'local';
    return this._local().map(r => ({
      id: r.id, savedAt: r.savedAt, summary: r.summary,
      meta: r.meta || { model: r.model, promptHash: (r.prompt || {}).hash, caseCount: (r.cfg || {}).caseCount },
    }));
  },

  /* 取完整运行:优先服务端,拿不到再翻本地 */
  async get(id) {
    if (this.serverAvailable) {
      try {
        const res = await fetch('/api/eval-runs?id=' + encodeURIComponent(id), { cache: 'no-store' });
        if (res.ok) {
          const j = await res.json();
          if (j && j.id) return j;
        }
      } catch (e) { /* 回落本地 */ }
    }
    return this._local().find(r => r.id === id) || null;
  },

  /* 保存一次运行:本地先写(兜底),服务端可用时再同步 */
  async save(run) {
    run.savedAt = new Date().toISOString();
    run.summary = summarizeRun(run);
    const list = this._local().filter(r => r.id !== run.id);
    list.unshift(run);
    try {
      localStorage.setItem(EVAL_LS.runs, JSON.stringify(list.slice(0, EVAL_RUNS_KEEP)));
    } catch (e) {
      /* 超出配额:丢掉最旧的一半再试一次 */
      try { localStorage.setItem(EVAL_LS.runs, JSON.stringify(list.slice(0, Math.floor(EVAL_RUNS_KEEP / 2)))); }
      catch (e2) { /* 仍失败则放弃本地缓存 */ }
    }
    this.source = 'local';
    if (this.serverAvailable) {
      const res = await fetch('/api/eval-runs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(run),
      });
      if (!res.ok) throw new Error('服务端写入失败:HTTP ' + res.status);
      this.source = 'server';
    }
    return this.source;
  },

  /* 探测服务端是否提供 /api/eval-runs(页面启动时调一次) */
  async probe() {
    try {
      const res = await fetch('/api/eval-runs', { cache: 'no-store' });
      this.serverAvailable = res.ok;
    } catch (e) { this.serverAvailable = false; }
    return this.serverAvailable;
  },

  _local() {
    try {
      const a = JSON.parse(localStorage.getItem(EVAL_LS.runs) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  },
};

/* =====================================================================
 * A/B 对比:两次运行的差异
 * ===================================================================== */
/** 逐用例平均总分对比,delta<0 即本次改动导致变差 */
function diffRuns(runA, runB) {
  const byCase = run => {
    const m = {};
    (run.results || []).filter(i => i.status === 'done').forEach(i => {
      (m[i.caseId] = m[i.caseId] || { name: i.caseName, scores: [], rule: [], judge: [] });
      m[i.caseId].scores.push(i.score);
      m[i.caseId].rule.push(i.ruleScore);
      if (i.judgeScore != null) m[i.caseId].judge.push(i.judgeScore);
    });
    const out = {};
    Object.keys(m).forEach(k => {
      const v = m[k];
      const avg = a => a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null;
      out[k] = { name: v.name, score: avg(v.scores), rule: avg(v.rule), judge: avg(v.judge) };
    });
    return out;
  };
  const a = byCase(runA), b = byCase(runB);
  const ids = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  const cases = ids.map(id => {
    const x = a[id], y = b[id];
    const delta = (x && y && x.score != null && y.score != null) ? Math.round((y.score - x.score) * 10) / 10 : null;
    return { id, name: (y && y.name) || (x && x.name) || id, a: x || null, b: y || null, delta, worse: delta != null && delta < 0 };
  }).sort((p, q) => (p.delta == null ? 1 : q.delta == null ? -1 : p.delta - q.delta));

  const pa = runA.prompt || {}, pb = runB.prompt || {};
  const prompt = {
    hashA: pa.hash || '-', hashB: pb.hash || '-',
    systemChanged: (pa.system || '') !== (pb.system || ''),
    userChanged: (pa.userTemplate || '') !== (pb.userTemplate || ''),
    productLineChanged: (pa.productLine || '') !== (pb.productLine || ''),
    styleCountA: (pa.styles || []).length, styleCountB: (pb.styles || []).length,
    styleChanged: JSON.stringify(pa.styles || []) !== JSON.stringify(pb.styles || []),
    systemDelta: (pb.system || '').length - (pa.system || '').length,
    userDelta: (pb.userTemplate || '').length - (pa.userTemplate || '').length,
  };
  return { cases, prompt, worseCount: cases.filter(c => c.worse).length };
}

/* Node 环境下(单测)导出;浏览器 classic script 里这段不执行 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DatasetStore, RULE_DEFS, BANNED_WORDS, CTA_WORDS, runRules, extractTopics, countEmoji,
    extractPrices, productCore, JUDGE_DIMS, JUDGE_PROMPT_DEFAULT, buildJudgeMessages,
    parseJudgeJson, judgeScoreOf, judgeCopy, scoreOf, EVAL_DEFAULTS, normalizeEvalCfg,
    promptSnapshot, mockCopy, runEval, summarizeRun, estimateRun, RunStore, diffRuns,
    evalHash, estTokens, costOf,
  };
}
