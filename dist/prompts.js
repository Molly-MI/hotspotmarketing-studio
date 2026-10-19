/* =====================================================================
 * prompts.js —— 提示词模板中心(工作台 index.html 与后台 admin.html 共用)
 *
 * 存储优先级:服务端 prompts.json  >  浏览器 localStorage  >  内置默认值
 * 后台页面可视化修改后,工作台 Step 4 立即生效。
 * ===================================================================== */

const PROMPT_DEFAULTS = {
  /* 系统提示词:定义模型的角色与硬性写作规范
     注意:前 6 条是「硬约束」,与发布前的规则校验一一对应,措辞要写死,不要软化成建议 */
  system: `你是资深电商媒体的微博营销操盘手,擅长把社会热点自然嫁接到商品卖点上,写出高传播力的微博短文案。

【硬性约束 · 任一条不满足即视为不合格】
1. 全文长度必须在 140~220 字之间(含标点与话题标签)。写完后自己数一遍,超出就删减、不足就补充,调整到区间内再输出。宁可少写一个卖点,也不要超字数。
2. 价格只能原样使用素材中给出的数字,一个字都不能改。素材里没有给出的价格、折扣力度、优惠券、销量、库存、排名等数字一律不得出现。
3. 禁止绝对化用语:最/最好/最佳/最低/第一/国家级/世界级/顶级/绝对/永久/100%/全网最低/唯一/首选/冠军 等一律不得使用。
4. 话题标签 1~3 个,且必须包含素材中给定的话题标签,不要自造大量标签。
5. 结尾必须有明确的互动引导(提问 / 抽奖 / 评论召唤 / 主页橱窗引导,任选其一)。
6. 只输出文案正文纯文本,不要任何解释、标题、编号、markdown 符号或引号包裹。

【写作要求】
- 分 3~4 个自然段,段与段之间空一行
- 恰当使用 2~5 个 emoji,不堆砌、不刷屏
- 语气口语化、有网感,像真人运营在发微博,不要企业公告腔
- 先接住热点情绪,再自然过渡到商品,不要生硬拼接

【示例】(注意它的长度与价格写法)
素材:热点「寒潮来袭,多地气温断崖式下跌」,话题 #寒潮来袭#;商品「姜茶 · 红糖姜块,售价 ¥33.9,卖点:古法红糖、暖身驱寒、独立小块」
输出:
#寒潮来袭# 一夜之间从秋天直接跳进冬天,你那边降了多少度?🥶

被冻到手抖的时候真的会想念一杯热的。姜茶红糖姜块用的是古法红糖,一小块丢进热水里两分钟就化开,喝完从胃里暖到指尖,早八和加班都靠它续命。

到手价 ¥33.9,独立小块不占地方,抽屉里囤一盒刚好☕

你们最近都靠什么取暖?评论区聊聊,点主页橱窗可以直达~ #冬天的第一杯热饮#`,

  /* 用户提示词模板:{{变量}} 会在运行时替换为真实素材 */
  userTemplate: `【热点新闻】
标题:{{news.title}}
来源:{{news.source}} · {{news.time}} · 热度 {{news.heat}}
摘要:{{news.summary}}
话题标签:{{news.topics}}

【待推商品】
{{products}}

【整体语调】{{tone}}
【本条创作风格】{{style.name}}:{{style.brief}}

请据此写 1 条可直接发布的微博文案。`,

  /* 商品行模板:{{products}} 中每件商品的渲染格式 */
  productLine: `{{index}}. {{name}} | 售价 ¥{{price}}(原价 ¥{{orig}}) | 品类 {{cat}} | 卖点 {{points}}`,

  /* 合规修正提示词:文案没通过发布前校验时,带着失败原因让模型自己改一版
     用到的变量:{{copy}} 原文案 · {{failures}} 未通过的检查项 · {{products}} 商品素材 · {{topics}} 话题标签 */
  repairTemplate: `你刚才写的这条微博文案没有通过发布前的合规校验,请针对下面列出的问题逐条修正后重新输出。

【原文案】
{{copy}}

【未通过的检查项】
{{failures}}

【可用素材】(价格只能使用这里出现的数字)
{{products}}
【必须包含的话题标签】{{topics}}

修正要求:
1. 只修问题,尽量保留原文的语气、结构与卖点表达,不要重写成另一篇。
2. 修完后必须同时满足:全文 140~220 字、价格与素材完全一致、无绝对化用语、话题标签 1~3 个且包含给定话题、结尾有互动引导。
3. 如果是超字数,优先删掉重复的形容词与次要卖点,不要删掉话题标签和互动引导。
4. 只输出修正后的文案正文纯文本,不要解释、不要说明改了什么。`,

  /* 版本风格:每个风格独立发起一次生成,产出一个候选版本 */
  styles: [
    { key: 'A', name: '版本 A · 热点借势', brief: '开头强共鸣地切入热点情绪,再自然过渡到商品如何解决热点带来的真实痛点,重体验与场景感' },
    { key: 'B', name: '版本 B · 促销导向', brief: '突出限时价格钩子与优惠力度,营造紧迫感,清晰列出商品与到手价,重转化效率' },
    { key: 'C', name: '版本 C · 互动话题', brief: '以第一人称提问开场,引导评论区讨论与晒单,搭配抽奖/送同款玩法,重互动率与转发' },
  ],

  /* 语调预设:工作台 Step 4 左侧可选的"主打语调" */
  tones: ['热点借势', '促销导向', '互动话题'],

  updatedAt: null,
};

/* 模板变量说明,后台页面用于生成参考表 */
const PROMPT_VARS = [
  ['{{news.title}}',   '热点新闻标题'],
  ['{{news.summary}}', '热点新闻摘要'],
  ['{{news.source}}',  '新闻来源媒体'],
  ['{{news.time}}',    '新闻发布时间(相对)'],
  ['{{news.heat}}',    '热度值 0~100'],
  ['{{news.topics}}',  '话题标签,空格分隔,如 #高温预警# #41度的夏天怎么过#'],
  ['{{products}}',     '按「商品行模板」渲染并换行拼接的全部选定商品'],
  ['{{tone}}',         '用户在 Step 4 选择的主打语调'],
  ['{{style.name}}',   '当前版本风格名称'],
  ['{{style.brief}}',  '当前版本风格创作要求'],
  ['{{date}}',         '当天日期,如 2026-07-30'],
];

/* 商品行模板可用变量 */
const PRODUCT_VARS = [
  ['{{index}}', '序号(从 1 开始)'], ['{{name}}', '商品名'], ['{{price}}', '售价'],
  ['{{orig}}', '原价'], ['{{cat}}', '品类'], ['{{points}}', '卖点,顿号分隔'],
];

/* 后台"实时预览 / 试运行"使用的示例素材 */
const SAMPLE_CONTEXT = {
  news: {
    title: '全国多地开启"高温炙烤"模式,局部气温突破 41℃',
    source: '央视新闻', time: '12 分钟前', heat: 98,
    summary: '中央气象台连续第 5 天发布高温红色预警,华东华中多地气温刷新历史同期纪录,清凉消暑话题登上热搜榜首。',
    topics: ['#高温预警#', '#41度的夏天怎么过#'],
  },
  products: [
    { name: '便携手持小风扇 · 三档静音', price: 39.9, orig: 69, cat: '数码', points: ['USB 充电', '48h 续航', '静音'] },
    { name: '零感冰丝空调被 · 抗菌夏凉被', price: 129, orig: 199, cat: '家居', points: ['冰丝凉感', 'A类抗菌', '可机洗'] },
  ],
};

/* ===================== 模板渲染 ===================== */
function renderTemplate(tpl, ctx) {
  return String(tpl == null ? '' : tpl).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (raw, key) => {
    const val = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
    if (val == null) return raw;                      // 未知变量原样保留,便于后台排查
    return Array.isArray(val) ? val.join(' ') : String(val);
  });
}

/* ===================== 存储 ===================== */
const PromptStore = {
  data: JSON.parse(JSON.stringify(PROMPT_DEFAULTS)),
  source: 'default',        // default | local | server
  serverAvailable: false,

  async load() {
    try {
      const res = await fetch('/api/prompts', { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        this.serverAvailable = true;
        if (j && j.system) { this.data = this.normalize(j); this.source = 'server'; return this.data; }
      }
    } catch (e) { /* file:// 打开或未启动 server.js,回落本地 */ }
    try {
      const s = JSON.parse(localStorage.getItem('hotspot.prompts') || 'null');
      if (s && s.system) { this.data = this.normalize(s); this.source = 'local'; }
    } catch (e) { /* ignore */ }
    return this.data;
  },

  async save(next) {
    this.data = this.normalize(next || this.data);
    this.data.updatedAt = new Date().toISOString();
    localStorage.setItem('hotspot.prompts', JSON.stringify(this.data));
    this.source = 'local';
    if (this.serverAvailable) {
      const res = await fetch('/api/prompts', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.data),
      });
      if (!res.ok) throw new Error('服务端写入失败:HTTP ' + res.status);
      this.source = 'server';
    }
    return this.source;
  },

  reset() { this.data = JSON.parse(JSON.stringify(PROMPT_DEFAULTS)); return this.data; },

  /* 兜底补全缺失字段,避免后台误删导致工作台崩溃 */
  normalize(d) {
    const out = { ...JSON.parse(JSON.stringify(PROMPT_DEFAULTS)), ...d };
    if (!Array.isArray(out.styles) || !out.styles.length) out.styles = JSON.parse(JSON.stringify(PROMPT_DEFAULTS.styles));
    out.styles = out.styles.map((s, i) => ({ key: s.key || String.fromCharCode(65 + i), name: s.name || `版本 ${i + 1}`, brief: s.brief || '' }));
    if (!Array.isArray(out.tones) || !out.tones.length) out.tones = [...PROMPT_DEFAULTS.tones];
    out.tones = out.tones.map(t => String(t).trim()).filter(Boolean);
    /* 老版本保存的 prompts.json 里没有修正模板,补上默认值 */
    if (!out.repairTemplate || !String(out.repairTemplate).trim()) out.repairTemplate = PROMPT_DEFAULTS.repairTemplate;
    return out;
  },

  /* 组装最终发给大模型的 messages */
  buildMessages({ news, products, tone, style }) {
    const d = this.data;
    const productBlock = (products || []).map((p, i) =>
      renderTemplate(d.productLine, {
        index: i + 1, name: p.name, price: p.price, orig: p.orig, cat: p.cat,
        points: Array.isArray(p.points) ? p.points.join('、') : p.points,
      })).join('\n');
    const ctx = {
      news, products: productBlock, tone, style,
      date: new Date().toISOString().slice(0, 10),
    };
    return [
      { role: 'system', content: renderTemplate(d.system, ctx) },
      { role: 'user', content: renderTemplate(d.userTemplate, ctx) },
    ];
  },
};
