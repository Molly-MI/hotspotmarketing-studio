const USER_AGENT = 'HotspotMarketingStudio/1.0 (+https://hotspot.hielise.tech)';
const DEFAULT_TTL = 60_000;
const DUP_THRESHOLD = 0.55;

export const BUILTIN_SOURCES = [
  { id: 'weibo', name: '微博热搜', type: 'hotlist', enabled: true },
  { id: 'baidu', name: '百度热搜', type: 'hotlist', enabled: true },
  { id: 'toutiao', name: '今日头条', type: 'hotlist', enabled: false },
  { id: 'rss-36kr', name: '36氪', type: 'rss', url: 'https://36kr.com/feed', enabled: false },
  { id: 'rss-huxiu', name: '虎嗅网', type: 'rss', url: 'https://www.huxiu.com/rss/0.xml', enabled: false },
];

const RISK_RULES = [
  { level: 'block', cat: '灾难事故', words: ['遇难', '死亡', '身亡', '坠机', '爆炸', '地震', '崩塌', '火灾', '溺亡', '伤亡', '失联', '搜救', '救援', '车祸', '事故', '洪水'] },
  { level: 'block', cat: '疾病疫情', words: ['疫情', '确诊', '感染', '病毒', '病例', '癌症', '猝死', '中毒', '病危', '抢救'] },
  { level: 'block', cat: '战争冲突', words: ['战争', '开战', '袭击', '导弹', '空袭', '交火', '冲突', '轰炸', '难民'] },
  { level: 'block', cat: '犯罪司法', words: ['杀人', '凶手', '嫌疑人', '被捕', '逮捕', '判刑', '诈骗', '性侵', '家暴', '毒品', '自杀'] },
  { level: 'warn', cat: '时政外交', words: ['总书记', '国家主席', '总理', '两会', '外交部', '国防部', '领导人', '选举', '总统'] },
  { level: 'warn', cat: '社会争议', words: ['举报', '塌房', '道歉', '维权', '罢工', '抗议', '造假', '翻车', '处罚', '罚款', '下架', '召回'] },
];

let cache = { at: 0, payload: null };

function decodeEntities(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');
}

function stripTags(value) {
  return decodeEntities(String(value || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function topicOf(title) {
  const clean = String(title || '').replace(/[《》"'\[\]()]/g, '').trim();
  const segment = clean.split(/[,，。!！?？:：;；、\s|\-—]/).filter(Boolean)[0] || clean;
  return segment ? `#${segment.slice(0, 14)}#` : '';
}

function relativeTime(timestamp) {
  if (!timestamp) return '刚刚';
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} 小时前`;
  return `${Math.round(minutes / 1440)} 天前`;
}

function tagFor(index) {
  return index < 3 ? 'hot' : index < 8 ? 'rise' : 'new';
}

function assessRisk(text) {
  const hits = [];
  let level = null;
  for (const rule of RISK_RULES) {
    const words = rule.words.filter(word => text.includes(word));
    if (!words.length) continue;
    hits.push({ cat: rule.cat, words });
    if (rule.level === 'block') level = 'block';
    else if (!level) level = 'warn';
  }
  if (!level) return null;
  const categories = hits.map(hit => hit.cat);
  return {
    level,
    cats: categories,
    words: hits.flatMap(hit => hit.words).slice(0, 6),
    reason: level === 'block'
      ? `涉及${categories.join('、')}，禁止借势营销`
      : `涉及${categories.join('、')}，借势需人工审慎判断`,
  };
}

function normalizeTitle(title) {
  return String(title || '')
    .replace(/[！-～]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
    .toLowerCase()
    .replace(/#[^#]{1,30}#/g, '')
    .replace(/[\s,，。.!！?？;；:：、"'“”‘’「」『』《》〈〉()（）【】\[\]{}#＃…·・\-—~～|｜/\\+*&%^]/g, '');
}

function titleSimilarity(left, right) {
  const a = normalizeTitle(left);
  const b = normalizeTitle(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const makeBigrams = value => new Set(value.length < 2 ? [value] : Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2)));
  const aBigrams = makeBigrams(a);
  const bBigrams = makeBigrams(b);
  let common = 0;
  for (const gram of aBigrams) if (bBigrams.has(gram)) common += 1;
  const dice = (2 * common) / (aBigrams.size + bBigrams.size);
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 6 && longer.includes(shorter) ? Math.max(dice, 0.82) : dice;
}

async function fetchText(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/json, text/html, application/xml, text/xml, */*',
      'accept-language': 'zh-CN,zh;q=0.9',
      'user-agent': USER_AGENT,
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function fromWeibo(fetchImpl) {
  const raw = await fetchText('https://weibo.com/ajax/side/hotSearch', fetchImpl);
  const entries = JSON.parse(raw).data?.realtime || [];
  return entries.slice(0, 20).map((entry, rank) => {
    const title = String(entry.word_scheme || entry.word || '').replace(/^#|#$/g, '');
    return {
      title, source: '微博热搜', heatRaw: Number(entry.num || 0), rank,
      summary: `微博热搜榜第 ${rank + 1} 位${entry.label_name ? ` · ${entry.label_name}` : ''}，话题正在快速发酵。`,
      topics: [topicOf(title)], url: `https://s.weibo.com/weibo?q=${encodeURIComponent(`#${title}#`)}`, ts: Date.now(),
    };
  });
}

async function fromBaidu(fetchImpl) {
  const html = await fetchText('https://top.baidu.com/board?tab=realtime', fetchImpl);
  const matched = html.match(/<!--s-data:([\s\S]*?)-->/);
  if (!matched) throw new Error('页面结构变化，未解析到榜单数据');
  const cards = JSON.parse(matched[1]).data?.cards || [];
  return cards.flatMap(card => card.content || []).slice(0, 20).map((entry, rank) => {
    const title = stripTags(entry.word || entry.query || '');
    return {
      title, source: '百度热搜', heatRaw: Number(entry.hotScore || entry.heatScore || 0), rank,
      summary: stripTags(entry.desc || '') || `百度热搜榜第 ${rank + 1} 位，搜索热度持续走高。`,
      topics: [topicOf(title)], url: entry.url || entry.rawUrl || '', ts: Date.now(),
    };
  });
}

async function fromToutiao(fetchImpl) {
  const raw = await fetchText('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc', fetchImpl);
  return (JSON.parse(raw).data || []).slice(0, 20).map((entry, rank) => {
    const title = stripTags(entry.Title || entry.title || '');
    return {
      title, source: '今日头条', heatRaw: Number(entry.HotValue || entry.hot_value || 0), rank,
      summary: `今日头条热榜第 ${rank + 1} 位，相关讨论正在升温。`,
      topics: [topicOf(title)], url: entry.Url || entry.url || '', ts: Date.now(),
    };
  });
}

async function fromRss(source, fetchImpl) {
  const xml = await fetchText(source.url, fetchImpl);
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  if (!blocks.length) throw new Error('未解析到 RSS 条目');
  const pick = (block, name) => {
    const matched = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
    return matched ? decodeEntities(matched[1]).trim() : '';
  };
  return blocks.slice(0, 15).map((block, rank) => {
    const title = stripTags(pick(block, 'title'));
    const description = stripTags(pick(block, 'description') || pick(block, 'summary') || pick(block, 'content'));
    const date = pick(block, 'pubDate') || pick(block, 'updated') || pick(block, 'published');
    const href = block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1];
    return {
      title, source: source.name, heatRaw: 0, rank,
      summary: description.slice(0, 120) || title, topics: [topicOf(title)],
      url: href || stripTags(pick(block, 'link')), ts: Date.parse(date) || Date.now(),
    };
  });
}

const HOTLIST_ADAPTERS = { weibo: fromWeibo, baidu: fromBaidu, toutiao: fromToutiao };

export async function crawlNews(sources = BUILTIN_SOURCES, { force = false, ttl = DEFAULT_TTL, fetch = globalThis.fetch } = {}) {
  if (!force && cache.payload && Date.now() - cache.at < ttl) return { ...cache.payload, cached: true };

  const enabled = sources.filter(source => source.enabled);
  const results = await Promise.all(enabled.map(async source => {
    const startedAt = Date.now();
    try {
      const adapter = source.type === 'rss' ? () => fromRss(source, fetch) : HOTLIST_ADAPTERS[source.id] && (() => HOTLIST_ADAPTERS[source.id](fetch));
      if (!adapter) throw new Error(`未知的抓取源类型：${source.id}`);
      const items = await adapter();
      return { source, ok: true, ms: Date.now() - startedAt, items };
    } catch (error) {
      return { source, ok: false, ms: Date.now() - startedAt, error: error.message, items: [] };
    }
  }));

  const all = results.flatMap(result => result.items).filter(item => item.title)
    .sort((a, b) => a.rank - b.rank || (b.heatRaw || 0) - (a.heatRaw || 0));
  const unique = [];
  for (const item of all) {
    const duplicate = unique.find(saved => titleSimilarity(saved.title, item.title) >= DUP_THRESHOLD);
    if (duplicate) {
      duplicate.sources = [...new Set([...(duplicate.sources || [duplicate.source]), item.source])];
    } else {
      unique.push({ ...item, sources: [item.source] });
    }
  }

  const payload = {
    at: new Date().toISOString(),
    sources: results.map(result => ({ id: result.source.id, name: result.source.name, ok: result.ok, ms: result.ms, count: result.items.length, error: result.error || null })),
    items: unique.slice(0, 24).map((item, index) => ({
      id: `live-${index}`, title: item.title, source: item.source, time: relativeTime(item.ts), summary: item.summary,
      heat: Math.max(52, Math.min(99, 99 - index * 2)), topics: item.topics.filter(Boolean), url: item.url || '',
      tag: tagFor(index), sources: item.sources, live: true, risk: assessRisk(`${item.title} ${item.summary}`),
    })),
  };
  payload.riskCount = payload.items.filter(item => item.risk?.level === 'block').length;
  cache = { at: Date.now(), payload };
  return { ...payload, cached: false };
}
