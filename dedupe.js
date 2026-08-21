/* =====================================================================
 * dedupe.js —— 热点去重(工作台 index.html 使用,服务端定时任务后续可复用)
 *
 * 解决两类重复:
 *   1) 跨轮次重复:同一个热点昨天已经发过,今天抓到了不该再发
 *   2) 同批次跨源重复:微博和百度报的是同一件事,只是措辞不同
 *
 * 中文标题没有词边界,用「二元组(bigram)+ Dice 系数」做相似度,
 * 不依赖分词库,对新闻标题这种短文本效果稳定。
 * ===================================================================== */

/* ---------------- 文本归一化 ---------------- */
const PUNCT_RE = /[\s,,。.!!??;;::、""''「」『』《》〈〉()()【】\[\]{}#＃…·・\-—~～|｜\/\\+*&%^]/g;

/** 全角数字/字母转半角,并统一大小写 */
function toHalfWidth(s) {
  return String(s).replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

function normalizeTitle(s) {
  return toHalfWidth(String(s || ''))
    .toLowerCase()
    .replace(/#[^#]{1,30}#/g, '')       // 去掉话题标签整体
    .replace(PUNCT_RE, '')
    .trim();
}

/** 二元组集合;长度不足 2 时退化为单字集合 */
function bigrams(s) {
  const set = new Set();
  if (s.length < 2) { if (s) set.add(s); return set; }
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}

/**
 * 标题相似度 0~1。
 * Dice 系数为主;一方完全包含另一方时给一个高分兜底
 * (「空调一直开vs忍着不开」 vs 「空调一直开vs忍着不开 谁更健康」这类)。
 */
function similarity(a, b) {
  const na = normalizeTitle(a), nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ga = bigrams(na), gb = bigrams(nb);
  let inter = 0;
  ga.forEach(g => { if (gb.has(g)) inter++; });
  const dice = (2 * inter) / (ga.size + gb.size);

  /* 包含关系:短的那条至少 6 个字才算数,避免「小米」命中一切 */
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (short.length >= 6 && long.includes(short)) return Math.max(dice, 0.82);

  return dice;
}

/* =====================================================================
 * 1) 同批次跨源聚类
 * ===================================================================== */
/**
 * 把一批新闻按相似度聚类,每簇保留热度最高的一条作为代表。
 * 直接在原对象上打标:
 *   n.dupOf     = 代表条目的 id(仅重复项有)
 *   n.dupTitle  = 代表条目的标题
 *   n.dupScore  = 相似度
 *   n.dupSources= 该簇覆盖的来源(代表条目上有,用于展示"3 个源都在报")
 * @returns {{primary: Array, duplicates: Array}}
 */
function clusterNews(items, threshold = 0.55) {
  const primary = [], duplicates = [];
  /* 先按热度降序,保证代表条目是热度最高的那条 */
  const sorted = [...items].sort((a, b) => (b.heat || 0) - (a.heat || 0));

  for (const n of sorted) {
    delete n.dupOf; delete n.dupTitle; delete n.dupScore;
    let hit = null, hitScore = 0;
    for (const p of primary) {
      const s = similarity(n.title, p.title);
      if (s >= threshold && s > hitScore) { hit = p; hitScore = s; }
    }
    if (hit) {
      n.dupOf = hit.id; n.dupTitle = hit.title; n.dupScore = Math.round(hitScore * 100) / 100;
      hit.dupSources = [...new Set([...(hit.dupSources || [hit.source]), n.source])];
      duplicates.push(n);
    } else {
      n.dupSources = [n.source];
      primary.push(n);
    }
  }
  return { primary, duplicates };
}

/* =====================================================================
 * 2) 跨轮次去重:已发布索引
 * ===================================================================== */
const PublishIndex = {
  records: [],          // [{title, at}]
  loaded: false,
  source: 'none',       // server | local | none

  /** 从服务端事件日志载入历史发布记录;无服务端时回落 localStorage */
  async load({ limit = 400 } = {}) {
    try {
      const res = await fetch('/api/events?limit=' + limit, { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        this.records = (j.events || [])
          .filter(e => e.type === 'publish' && e.newsTitle)
          .map(e => ({ title: e.newsTitle, at: e.at }));
        this.loaded = true; this.source = 'server';
        this.mirror();
        return this.records;
      }
    } catch (e) { /* file:// 或未启动服务 */ }
    try {
      this.records = JSON.parse(localStorage.getItem('hotspot.published') || '[]');
      this.source = this.records.length ? 'local' : 'none';
    } catch (e) { this.records = []; }
    this.loaded = true;
    return this.records;
  },

  mirror() {
    try { localStorage.setItem('hotspot.published', JSON.stringify(this.records.slice(-400))); } catch (e) { /* ignore */ }
  },

  /** 发布成功后立即登记,避免同一轮里连着发两条重复的 */
  add(title, at) {
    if (!title) return;
    this.records.push({ title, at: at || new Date().toISOString() });
    this.mirror();
  },

  /**
   * 判断某个标题是否与近期已发布内容重复
   * @returns {{duplicate:boolean, matched?:string, score?:number, at?:string, hoursAgo?:number}}
   */
  check(title, { windowHours = 72, threshold = 0.55 } = {}) {
    const now = Date.now();
    let best = null;
    for (const r of this.records) {
      const ts = Date.parse(r.at);
      if (Number.isFinite(ts) && (now - ts) > windowHours * 3600e3) continue;   // 超出时间窗不算重复
      const s = similarity(title, r.title);
      if (s >= threshold && (!best || s > best.score)) {
        best = { matched: r.title, score: Math.round(s * 100) / 100, at: r.at,
          hoursAgo: Number.isFinite(ts) ? Math.max(0, Math.round((now - ts) / 3600e3 * 10) / 10) : null };
      }
    }
    return best ? { duplicate: true, ...best } : { duplicate: false };
  },
};

/* 服务端(news.js)也要用相似度做跨源聚类,这里按需导出纯函数 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { normalizeTitle, bigrams, similarity, clusterNews };
}
