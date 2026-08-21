/* =====================================================================
 * news.js —— 真实热点抓取(服务端模块,零第三方依赖)
 *
 * 支持两类源:
 *   1) 热榜   微博热搜 / 百度热搜 / 头条热榜 —— 公开热榜接口,自带热度值
 *   2) RSS    任意 RSS / Atom 订阅源(新浪、36氪、虎嗅…)—— 最稳定、最规范
 *
 * ⚠️ 合规提示:热榜接口为站点公开数据,此处仅作原型演示用途。生产环境请改用
 *    官方开放平台(如微博开放平台)或商业舆情 API,并遵守目标站点的 robots.txt
 *    与服务条款;请求已做 60s 缓存与超时限制,避免高频抓取。
 * ===================================================================== */
'use strict';

const https = require('https');
const http = require('http');
const zlib = require('zlib');
const { similarity } = require('./dedupe.js');   // 跨源标题聚类,与前端共用同一套算法

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const TIMEOUT = 9000;
const DUP_THRESHOLD = 0.55;   // 标题相似度超过即视为同一件事(与前端默认值保持一致)

/* ---------------- 内置源 ---------------- */
const BUILTIN_SOURCES = [
  { id: 'weibo',   name: '微博热搜',   type: 'hotlist', enabled: true },
  { id: 'baidu',   name: '百度热搜',   type: 'hotlist', enabled: true },
  { id: 'toutiao', name: '今日头条',   type: 'hotlist', enabled: false },
  { id: 'rss-36kr',  name: '36氪',     type: 'rss', url: 'https://36kr.com/feed', enabled: false },
  { id: 'rss-huxiu', name: '虎嗅网',   type: 'rss', url: 'https://www.huxiu.com/rss/0.xml', enabled: false },
];

/* ---------------- HTTP ---------------- */
function fetchUrl(url, extraHeaders = {}, redirects = 3) {
  return new Promise((resolve, reject) => {
    let target;
    try { target = new URL(url); } catch (e) { return reject(new Error('URL 不合法:' + url)); }
    const mod = target.protocol === 'https:' ? https : http;
    const req = mod.get({
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json, text/html, application/xml, text/xml, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        ...extraHeaders,
      },
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(fetchUrl(new URL(res.headers.location, url).href, extraHeaders, redirects - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const enc = (res.headers['content-encoding'] || '').toLowerCase();
      const stream = enc === 'gzip' ? res.pipe(zlib.createGunzip())
        : enc === 'deflate' ? res.pipe(zlib.createInflate())
        : res;
      const bufs = [];
      stream.on('data', c => bufs.push(c));
      stream.on('end', () => resolve(Buffer.concat(bufs).toString('utf8')));
      stream.on('error', reject);
    });
    req.setTimeout(TIMEOUT, () => { req.destroy(new Error('请求超时')); });
    req.on('error', reject);
  });
}

/* ---------------- 工具 ---------------- */
const decodeEntities = s => String(s)
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&amp;/g, '&');
const stripTags = s => decodeEntities(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const tag = (i) => i < 3 ? 'hot' : i < 8 ? 'rise' : 'new';
const relTime = (ts) => {
  if (!ts) return '刚刚';
  const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (min < 60) return min + ' 分钟前';
  if (min < 1440) return Math.round(min / 60) + ' 小时前';
  return Math.round(min / 1440) + ' 天前';
};
/* 从标题里提炼一个微博话题标签 */
function topicOf(title) {
  const clean = String(title).replace(/[《》"'"'\[\]()()]/g, '').trim();
  const seg = clean.split(/[,,。!!??::;;、\s|\-—]/).filter(Boolean)[0] || clean;
  return '#' + seg.slice(0, 14) + '#';
}

/* ---------------- 各源适配器 ---------------- */
async function fromWeibo() {
  const raw = await fetchUrl('https://weibo.com/ajax/side/hotSearch', {
    'Referer': 'https://weibo.com/',
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json, text/plain, */*',
  });
  const j = JSON.parse(raw);
  const list = (j.data && j.data.realtime) || [];
  return list.slice(0, 20).map((it, i) => ({
    title: it.word_scheme ? it.word_scheme.replace(/^#|#$/g, '') : it.word,
    source: '微博热搜',
    heatRaw: it.num || 0,
    rank: i,
    summary: `微博热搜榜第 ${i + 1} 位${it.label_name ? ' · ' + it.label_name : ''},实时热度 ${(it.num || 0).toLocaleString('zh-CN')},话题正在快速发酵。`,
    topics: ['#' + String(it.word).replace(/^#|#$/g, '') + '#'],
    url: 'https://s.weibo.com/weibo?q=' + encodeURIComponent('#' + it.word + '#'),
    ts: Date.now(),
  }));
}

async function fromBaidu() {
  const html = await fetchUrl('https://top.baidu.com/board?tab=realtime');
  const m = html.match(/<!--s-data:([\s\S]*?)-->/);
  if (!m) throw new Error('页面结构变化,未解析到榜单数据');
  const j = JSON.parse(m[1]);
  const cards = (j.data && j.data.cards) || [];
  const list = cards.flatMap(c => c.content || []);
  return list.slice(0, 20).map((it, i) => ({
    title: stripTags(it.word || it.query || ''),
    source: '百度热搜',
    heatRaw: Number(it.hotScore || it.heatScore || 0),
    rank: i,
    summary: stripTags(it.desc || '') || `百度热搜榜第 ${i + 1} 位,搜索热度持续走高。`,
    topics: [topicOf(it.word || '')],
    url: it.url || it.rawUrl || '',
    ts: Date.now(),
  }));
}

async function fromToutiao() {
  const raw = await fetchUrl('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc');
  const j = JSON.parse(raw);
  return (j.data || []).slice(0, 20).map((it, i) => ({
    title: stripTags(it.Title || it.title || ''),
    source: '今日头条',
    heatRaw: Number(it.HotValue || it.hot_value || 0),
    rank: i,
    summary: `今日头条热榜第 ${i + 1} 位,热度 ${it.HotValue || '—'},相关讨论正在升温。`,
    topics: [topicOf(it.Title || it.title || '')],
    url: it.Url || it.url || '',
    ts: Date.now(),
  }));
}

async function fromRss(src) {
  const xml = await fetchUrl(src.url);
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g) || [];
  if (!blocks.length) throw new Error('未解析到 RSS 条目');
  const pick = (block, tagName) => {
    const m = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'));
    return m ? decodeEntities(m[1]).trim() : '';
  };
  return blocks.slice(0, 15).map((b, i) => {
    const title = stripTags(pick(b, 'title'));
    const desc = stripTags(pick(b, 'description') || pick(b, 'summary') || pick(b, 'content'));
    const dateStr = pick(b, 'pubDate') || pick(b, 'updated') || pick(b, 'published');
    const linkTag = b.match(/<link[^>]*href=["']([^"']+)["']/i);
    const ts = dateStr ? Date.parse(dateStr) || Date.now() : Date.now();
    return {
      title,
      source: src.name,
      heatRaw: 0,
      rank: i,
      summary: desc.slice(0, 120) || title,
      topics: [topicOf(title)],
      url: linkTag ? linkTag[1] : stripTags(pick(b, 'link')),
      ts,
    };
  });
}

const ADAPTERS = { weibo: fromWeibo, baidu: fromBaidu, toutiao: fromToutiao };

/* ---------------------------------------------------------------
 * 借势风险识别
 * 真实热榜里混杂灾难、事故、疫情、战争、政治与社会负面事件,
 * 这类新闻绝不能拿来做商品营销 —— 蹭这种热点是重大品牌事故。
 * block = 禁止借势(前端不允许选中);warn = 需人工判断
 * --------------------------------------------------------------- */
const RISK_RULES = [
  { level: 'block', cat: '灾难事故', words: ['遇难', '死亡', '身亡', '坠机', '坠楼', '爆炸', '地震', '崩塌', '塌方', '火灾', '溺亡', '溺水', '伤亡', '重伤', '失联', '搜救', '救援', '车祸', '事故', '泄漏', '洪水', '决堤', '山洪', '殉职', '追悼'] },
  { level: 'block', cat: '疾病疫情', words: ['疫情', '确诊', '感染', '病毒', '病例', '疫苗', '癌症', '猝死', '中毒', '病危', '抢救'] },
  { level: 'block', cat: '战争冲突', words: ['战争', '开战', '袭击', '导弹', '空袭', '交火', '军演', '冲突', '轰炸', '停火', '难民'] },
  { level: 'block', cat: '犯罪司法', words: ['杀人', '凶手', '嫌疑人', '被捕', '逮捕', '判刑', '死刑', '诈骗', '性侵', '猥亵', '家暴', '虐待', '拐卖', '毒品', '自杀', '跳楼', '失踪'] },
  { level: 'warn',  cat: '时政外交', words: ['中共', '中央', '总书记', '国家主席', '总理', '两会', '外交部', '发言人', '大使', '解放军', '国防部', '领导人', '会晤', '座谈会', '选举', '总统'] },
  { level: 'warn',  cat: '社会争议', words: ['举报', '塌房', '道歉', '维权', '罢工', '抗议', '歧视', '造假', '翻车', '处罚', '罚款', '通报批评', '下架', '召回'] },
];

function assessRisk(text) {
  const hits = [];
  let level = null;
  for (const rule of RISK_RULES) {
    const words = rule.words.filter(w => text.includes(w));
    if (!words.length) continue;
    hits.push({ cat: rule.cat, words });
    if (rule.level === 'block') level = 'block';
    else if (!level) level = 'warn';
  }
  if (!level) return null;
  return {
    level,
    cats: hits.map(h => h.cat),
    words: hits.flatMap(h => h.words).slice(0, 6),
    reason: level === 'block'
      ? `涉及${hits.map(h => h.cat).join('、')},禁止借势营销`
      : `涉及${hits.map(h => h.cat).join('、')},借势需人工审慎判断`,
  };
}

/* ---------------- 聚合 ---------------- */
let cache = { at: 0, payload: null };

async function crawl(sources, { force = false, ttl = 60000 } = {}) {
  if (!force && cache.payload && Date.now() - cache.at < ttl) {
    return { ...cache.payload, cached: true };
  }
  const enabled = (sources || BUILTIN_SOURCES).filter(s => s.enabled);
  const results = await Promise.all(enabled.map(async s => {
    const t0 = Date.now();
    try {
      const fn = s.type === 'rss' ? fromRss : ADAPTERS[s.id];
      if (!fn) throw new Error('未知的抓取源类型:' + s.id);
      const items = await fn(s);
      return { source: s, ok: true, ms: Date.now() - t0, items };
    } catch (e) {
      return { source: s, ok: false, ms: Date.now() - t0, error: e.message, items: [] };
    }
  }));

  /* 归一化 + 跨源聚类去重 + 排序
     不同源的原始热度值不可比(微博 num / 百度 hotScore / 头条 HotValue),
     因此以各自榜单内的名次为主排序,名次相同再看原始热度。 */
  const all = [];
  results.forEach(r => r.items.forEach(it => { if (it.title) all.push(it); }));
  all.sort((a, b) => a.rank - b.rank || (b.heatRaw || 0) - (a.heatRaw || 0));

  const items = [];
  for (const it of all) {
    /* 与已保留条目比对措辞相似度,同一件事只留最靠前的那条,并记录还有哪些源在报 */
    const hit = items.find(p => similarity(p.title, it.title) >= DUP_THRESHOLD);
    if (hit) {
      hit.sources = [...new Set([...(hit.sources || [hit.source]), it.source])];
      continue;
    }
    it.sources = [it.source];
    items.push(it);
  }

  const payload = {
    at: new Date().toISOString(),
    sources: results.map(r => ({ id: r.source.id, name: r.source.name, ok: r.ok, ms: r.ms, count: r.items.length, error: r.error || null })),
    items: items.slice(0, 24).map((it, i) => ({
      id: 'live-' + i,
      title: it.title,
      source: it.source,
      time: relTime(it.ts),
      summary: it.summary,
      heat: Math.max(52, Math.min(99, 99 - i * 2)),   // 按聚合排名归一化为 0~99 热度
      topics: it.topics.filter(Boolean),
      url: it.url || '',
      tag: tag(i),
      sources: it.sources || [it.source],
      live: true,
      risk: assessRisk(it.title + ' ' + it.summary),
    })),
  };
  payload.riskCount = payload.items.filter(i => i.risk && i.risk.level === 'block').length;
  cache = { at: Date.now(), payload };
  return { ...payload, cached: false };
}

module.exports = { crawl, BUILTIN_SOURCES };
