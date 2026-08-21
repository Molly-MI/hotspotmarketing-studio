/* =====================================================================
 * data.js —— Mock 数据层(工作台 index.html 与评测台 eval.html 共用)
 *
 * 接真实数据源时替换这三处即可:
 *   NEWS      热点新闻,来自抓取服务
 *   PRODUCTS  商品库,来自商品中台
 *   MATCH_MAP 热点→商品匹配结果,来自推荐/向量检索服务
 * ===================================================================== */

const NEWS = [
  { id: 'n1', title: '全国多地开启"高温炙烤"模式,局部气温突破 41℃', source: '央视新闻', time: '12 分钟前', heat: 98, tag: 'hot',
    summary: '中央气象台连续第 5 天发布高温红色预警,华东华中多地气温刷新历史同期纪录,清凉消暑话题登上热搜榜首。',
    topics: ['#高温预警#', '#41度的夏天怎么过#'] },
  { id: 'n2', title: '巴黎奥运会开幕倒计时,全民健身热情高涨', source: '新华社', time: '28 分钟前', heat: 91, tag: 'hot',
    summary: '奥运临近带动运动装备销量激增,跑步、游泳、骑行等相关消费搜索量环比上涨 156%。',
    topics: ['#巴黎奥运会#', '#全民健身#'] },
  { id: 'n3', title: '年度剧王收官夜,全网追剧人熬夜刷完大结局', source: '娱理', time: '1 小时前', heat: 84, tag: 'rise',
    summary: '该剧大结局当晚播放量破 10 亿,社交平台"追剧搭子""边追边吃"话题同步冲上热搜,深夜零食订单量明显走高。',
    topics: ['#年度剧王收官#', '#追剧搭子#'] },
  { id: 'n4', title: '新版"国家学生体质健康标准"发布,家长关注度飙升', source: '人民日报', time: '2 小时前', heat: 76, tag: 'rise',
    summary: '新标准强化日常锻炼要求,儿童运动装备、跳绳、护具等品类迎来关注热潮。',
    topics: ['#学生体质健康标准#', '#暑期运动计划#'] },
  { id: 'n5', title: '中秋临近,礼盒类目搜索量环比翻倍', source: '第一财经', time: '3 小时前', heat: 69, tag: 'new',
    summary: '距中秋不足一月,送礼、团圆话题热度持续攀升,礼盒装与地方特产成为企业采购与走亲访友的主力选择。',
    topics: ['#中秋送礼#', '#团圆味道#'] },
  { id: 'n6', title: '露营经济回暖,"城市微度假"成周末新潮流', source: '第一财经', time: '4 小时前', heat: 62, tag: 'new',
    summary: '近郊露营、公园野餐搜索量回升,便携户外装备迎来第二波增长曲线。',
    topics: ['#城市微度假#', '#露营的快乐#'] },
];

const PRODUCTS = [
  { id: 'p1', name: '每日坚果混合装 · 30 袋', emoji: '🥜', bg: 'linear-gradient(135deg,#fdf6ec,#faf0e2)', price: 69.9, orig: 129, cat: '坚果炒货', points: ['独立小包', '七种果仁', '当季新货'] },
  { id: 'p2', name: '手剥巴旦木 · 奶香味', emoji: '🌰', bg: 'linear-gradient(135deg,#f2f8f4,#e9f3ee)', price: 39.9, orig: 69, cat: '坚果炒货', points: ['薄皮好剥', '低温烘焙', '奶香浓郁'] },
  { id: 'p3', name: '盐焗腰果仁 · 罐装', emoji: '🥜', bg: 'linear-gradient(135deg,#f5f4fb,#eeecf8)', price: 45, orig: 79, cat: '坚果炒货', points: ['颗粒饱满', '咸香不齁', '密封罐装'] },
  { id: 'p4', name: '原味碧根果 · 纸皮', emoji: '🌰', bg: 'linear-gradient(135deg,#fdf2f2,#f9eaea)', price: 59, orig: 99, cat: '坚果炒货', points: ['纸皮易开', '果仁清甜', '一斤装'] },
  { id: 'p5', name: '夏威夷果 · 开口器附赠', emoji: '🥥', bg: 'linear-gradient(135deg,#f1f7fa,#e8f1f6)', price: 49.9, orig: 89, cat: '坚果炒货', points: ['开口自然', '附赠开果器', '奶香回甘'] },
  { id: 'p6', name: '焦糖瓜子 · 大颗粒', emoji: '🌻', bg: 'linear-gradient(135deg,#f6f7fb,#eef0f7)', price: 19.9, orig: 35, cat: '坚果炒货', points: ['颗粒大', '焦糖香', '追剧必备'] },
  { id: 'p7', name: '琥珀核桃仁 · 免剥', emoji: '🌰', bg: 'linear-gradient(135deg,#fdf6ec,#faf0e2)', price: 42, orig: 72, cat: '坚果炒货', points: ['免剥即食', '琥珀糖衣', '补脑零食'] },
  { id: 'p8', name: '山核桃仁 · 临安产区', emoji: '🌰', bg: 'linear-gradient(135deg,#f2f8f4,#e9f3ee)', price: 88, orig: 148, cat: '坚果炒货', points: ['临安小胡桃', '现剥现装', '罐装保鲜'] },
  { id: 'p9', name: '多味花生 · 老式怀旧', emoji: '🥜', bg: 'linear-gradient(135deg,#f5f4fb,#eeecf8)', price: 15.9, orig: 28, cat: '坚果炒货', points: ['老式配方', '越嚼越香', '佐餐佐酒'] },
  { id: 'p10', name: '开心果 · 无漂白原色', emoji: '🥜', bg: 'linear-gradient(135deg,#fdf2f2,#f9eaea)', price: 65, orig: 108, cat: '坚果炒货', points: ['无漂白', '自然开口', '颗颗饱满'] },
  { id: 'p11', name: '手工黄油曲奇 · 铁盒装', emoji: '🍪', bg: 'linear-gradient(135deg,#f1f7fa,#e8f1f6)', price: 59, orig: 99, cat: '饼干糕点', points: ['纯正黄油', '现烤直发', '送礼铁盒'] },
  { id: 'p12', name: '咸蛋黄酥 · 6 枚装', emoji: '🥮', bg: 'linear-gradient(135deg,#f6f7fb,#eef0f7)', price: 39.9, orig: 65, cat: '饼干糕点', points: ['整颗蛋黄', '酥皮层叠', '现做现发'] },
  { id: 'p13', name: '椰蓉小方 · 无蔗糖', emoji: '🍰', bg: 'linear-gradient(135deg,#fdf6ec,#faf0e2)', price: 29.9, orig: 49, cat: '饼干糕点', points: ['无蔗糖配方', '椰香浓郁', '独立包装'] },
  { id: 'p14', name: '海苔苏打饼 · 低糖', emoji: '🍘', bg: 'linear-gradient(135deg,#f2f8f4,#e9f3ee)', price: 18.9, orig: 32, cat: '饼干糕点', points: ['低糖配方', '海苔咸香', '办公室常备'] },
  { id: 'p15', name: '提拉米苏千层 · 冷链', emoji: '🍰', bg: 'linear-gradient(135deg,#f5f4fb,#eeecf8)', price: 79, orig: 128, cat: '饼干糕点', points: ['现制冷链', '八层千层', '低甜不腻'] },
  { id: 'p16', name: '红丝绒蛋糕卷', emoji: '🎂', bg: 'linear-gradient(135deg,#fdf2f2,#f9eaea)', price: 45, orig: 78, cat: '饼干糕点', points: ['手工卷制', '奶油内馅', '切片装'] },
  { id: 'p17', name: '坚果塔 · 四种果仁', emoji: '🥧', bg: 'linear-gradient(135deg,#f1f7fa,#e8f1f6)', price: 52, orig: 88, cat: '饼干糕点', points: ['实料满配', '酥脆塔皮', '下午茶'] },
  { id: 'p18', name: '芝士夹心饼干 · 家庭装', emoji: '🍪', bg: 'linear-gradient(135deg,#f6f7fb,#eef0f7)', price: 32.9, orig: 55, cat: '饼干糕点', points: ['真芝士夹心', '独立小包', '家庭分享装'] },
  { id: 'p19', name: '桃酥 · 老字号配方', emoji: '🥠', bg: 'linear-gradient(135deg,#fdf6ec,#faf0e2)', price: 22.9, orig: 39, cat: '饼干糕点', points: ['传统桃酥', '一咬即酥', '怀旧味道'] },
  { id: 'p20', name: '蔓越莓曲奇 · 手作', emoji: '🍪', bg: 'linear-gradient(135deg,#f2f8f4,#e9f3ee)', price: 36, orig: 62, cat: '饼干糕点', points: ['整粒蔓越莓', '手工现烤', '黄油香'] },
  { id: 'p21', name: '靖江猪肉脯 · 厚切', emoji: '🥓', bg: 'linear-gradient(135deg,#f5f4fb,#eeecf8)', price: 49.9, orig: 89, cat: '肉干卤味', points: ['厚切一片', '炭火烘烤', '独立包装'] },
  { id: 'p22', name: '手撕牛肉干 · 五香', emoji: '🥩', bg: 'linear-gradient(135deg,#fdf2f2,#f9eaea)', price: 78, orig: 128, cat: '肉干卤味', points: ['整块手撕', '五香入味', '高蛋白'] },
  { id: 'p23', name: '虎皮凤爪 · 卤香', emoji: '🍗', bg: 'linear-gradient(135deg,#f1f7fa,#e8f1f6)', price: 35.9, orig: 59, cat: '肉干卤味', points: ['卤足 6 小时', '虎皮弹牙', '真空锁鲜'] },
  { id: 'p24', name: '麻辣鸭脖 · 武汉风味', emoji: '🍖', bg: 'linear-gradient(135deg,#f6f7fb,#eef0f7)', price: 42, orig: 69, cat: '肉干卤味', points: ['现卤现发', '麻辣够劲', '追剧下饭'] },
  { id: 'p25', name: '蜜汁猪肉铺 · 儿童装', emoji: '🥓', bg: 'linear-gradient(135deg,#fdf6ec,#faf0e2)', price: 45, orig: 75, cat: '肉干卤味', points: ['低盐配方', '蜜汁微甜', '小包分装'] },
  { id: 'p26', name: '卤蛋 · 溏心入味', emoji: '🥚', bg: 'linear-gradient(135deg,#f2f8f4,#e9f3ee)', price: 25.9, orig: 42, cat: '肉干卤味', points: ['溏心卤蛋', '常温保存', '早餐加餐'] },
  { id: 'p27', name: '风干牛肉粒 · 沙嗲味', emoji: '🥩', bg: 'linear-gradient(135deg,#f5f4fb,#eeecf8)', price: 55, orig: 92, cat: '肉干卤味', points: ['嚼劲十足', '沙嗲风味', '罐装'] },
  { id: 'p28', name: '盐水鸭翅 · 南京风味', emoji: '🍗', bg: 'linear-gradient(135deg,#fdf2f2,#f9eaea)', price: 39, orig: 65, cat: '肉干卤味', points: ['南京老卤', '真空装', '佐餐首选'] },
  { id: 'p29', name: '鱿鱼丝 · 碳烤', emoji: '🦑', bg: 'linear-gradient(135deg,#f1f7fa,#e8f1f6)', price: 29.9, orig: 49, cat: '肉干卤味', points: ['碳烤鱿鱼', '手撕成丝', '海味十足'] },
  { id: 'p30', name: '辣卤豆干 · 湘味', emoji: '🧆', bg: 'linear-gradient(135deg,#f6f7fb,#eef0f7)', price: 16.9, orig: 29, cat: '肉干卤味', points: ['湘式辣卤', '豆香浓', '解馋小包'] },
  { id: 'p31', name: '纯可可脂黑巧 · 72%', emoji: '🍫', bg: 'linear-gradient(135deg,#fdf6ec,#faf0e2)', price: 45, orig: 78, cat: '糖果巧克力', points: ['纯可可脂', '72% 可可', '低糖'] },
  { id: 'p32', name: '夹心软糖 · 果汁爆浆', emoji: '🍬', bg: 'linear-gradient(135deg,#f2f8f4,#e9f3ee)', price: 19.9, orig: 35, cat: '糖果巧克力', points: ['真果汁', '爆浆夹心', '缤纷口味'] },
  { id: 'p33', name: '牛轧糖 · 手工现做', emoji: '🍬', bg: 'linear-gradient(135deg,#f5f4fb,#eeecf8)', price: 39, orig: 65, cat: '糖果巧克力', points: ['手工现做', '整粒扁桃仁', '奶香浓'] },
  { id: 'p34', name: '榛果威化巧克力 · 分享装', emoji: '🍫', bg: 'linear-gradient(135deg,#fdf2f2,#f9eaea)', price: 52, orig: 88, cat: '糖果巧克力', points: ['榛果碎', '威化脆芯', '分享装'] },
  { id: 'p35', name: '无糖薄荷糖 · 铁盒', emoji: '🍬', bg: 'linear-gradient(135deg,#f1f7fa,#e8f1f6)', price: 15.9, orig: 26, cat: '糖果巧克力', points: ['无糖配方', '清新口气', '便携铁盒'] },
  { id: 'p36', name: '太妃糖 · 英式配方', emoji: '🍬', bg: 'linear-gradient(135deg,#f6f7fb,#eef0f7)', price: 28, orig: 46, cat: '糖果巧克力', points: ['英式太妃', '奶香醇厚', '独立纸包'] },
  { id: 'p37', name: '生巧克力 · 冷链配送', emoji: '🍫', bg: 'linear-gradient(135deg,#fdf6ec,#faf0e2)', price: 68, orig: 118, cat: '糖果巧克力', points: ['入口即化', '冷链直发', '日式生巧'] },
  { id: 'p38', name: '棒棒糖礼盒 · 儿童节', emoji: '🍭', bg: 'linear-gradient(135deg,#f2f8f4,#e9f3ee)', price: 32, orig: 55, cat: '糖果巧克力', points: ['缤纷造型', '果味十足', '礼盒装'] },
  { id: 'p39', name: '海盐焦糖巧克力', emoji: '🍫', bg: 'linear-gradient(135deg,#f5f4fb,#eeecf8)', price: 48, orig: 82, cat: '糖果巧克力', points: ['海盐点睛', '焦糖夹心', '微苦回甘'] },
  { id: 'p40', name: '水果软糖 · 五种口味', emoji: '🍬', bg: 'linear-gradient(135deg,#fdf2f2,#f9eaea)', price: 24.9, orig: 42, cat: '糖果巧克力', points: ['五味混装', 'Q弹有嚼劲', '大袋分享'] },
  { id: 'p41', name: '原切薯片 · 海盐味', emoji: '🥔', bg: 'linear-gradient(135deg,#f1f7fa,#e8f1f6)', price: 22.9, orig: 39, cat: '膨化薯片', points: ['整片原切', '非油炸工艺', '厚切脆'] },
  { id: 'p42', name: '番茄味薯条 · 桶装', emoji: '🍟', bg: 'linear-gradient(135deg,#f6f7fb,#eef0f7)', price: 26.9, orig: 45, cat: '膨化薯片', points: ['番茄浓郁', '桶装大容量', '追剧神器'] },
  { id: 'p43', name: '虾片 · 泰式风味', emoji: '🍤', bg: 'linear-gradient(135deg,#fdf6ec,#faf0e2)', price: 18.9, orig: 32, cat: '膨化薯片', points: ['泰式风味', '入口即化', '轻盈不腻'] },
  { id: 'p44', name: '芝士玉米棒 · 家庭桶', emoji: '🌽', bg: 'linear-gradient(135deg,#f2f8f4,#e9f3ee)', price: 29.9, orig: 49, cat: '膨化薯片', points: ['真芝士粉', '家庭桶装', '孩子最爱'] },
  { id: 'p45', name: '爆米花 · 焦糖味桶装', emoji: '🍿', bg: 'linear-gradient(135deg,#f5f4fb,#eeecf8)', price: 25.9, orig: 42, cat: '膨化薯片', points: ['现爆焦糖', '桶装超大份', '观影必备'] },
  { id: 'p46', name: '蔬菜脆片 · 冻干', emoji: '🥕', bg: 'linear-gradient(135deg,#fdf2f2,#f9eaea)', price: 35.9, orig: 59, cat: '膨化薯片', points: ['冻干工艺', '六种蔬菜', '低油低卡'] },
  { id: 'p47', name: '锅巴 · 麻辣小包装', emoji: '🍘', bg: 'linear-gradient(135deg,#f1f7fa,#e8f1f6)', price: 19.9, orig: 33, cat: '膨化薯片', points: ['手工老锅巴', '麻辣过瘾', '独立小包'] },
  { id: 'p48', name: '虾条 · 童年怀旧', emoji: '🍤', bg: 'linear-gradient(135deg,#f6f7fb,#eef0f7)', price: 15.9, orig: 27, cat: '膨化薯片', points: ['怀旧味道', '酥脆轻盈', '大包分享'] },
  { id: 'p49', name: '苔条花生酥 · 海苔味', emoji: '🥜', bg: 'linear-gradient(135deg,#fdf6ec,#faf0e2)', price: 23.9, orig: 39, cat: '膨化薯片', points: ['海苔包裹', '花生酥脆', '江浙风味'] },
  { id: 'p50', name: '玉米片 · 蜂蜜黄油', emoji: '🌽', bg: 'linear-gradient(135deg,#f2f8f4,#e9f3ee)', price: 27.9, orig: 46, cat: '膨化薯片', points: ['蜂蜜黄油', '厚切脆片', '早餐可泡'] },
  { id: 'p51', name: '冻干草莓脆 · 无添加', emoji: '🍓', bg: 'linear-gradient(135deg,#f5f4fb,#eeecf8)', price: 39.9, orig: 69, cat: '果干蜜饯', points: ['冻干锁鲜', '无添加糖', '整颗草莓'] },
  { id: 'p52', name: '芒果干 · 泰国进口', emoji: '🥭', bg: 'linear-gradient(135deg,#fdf2f2,#f9eaea)', price: 32.9, orig: 55, cat: '果干蜜饯', points: ['厚切果肉', '酸甜适口', '独立包装'] },
  { id: 'p53', name: '蓝莓干 · 大兴安岭', emoji: '🫐', bg: 'linear-gradient(135deg,#f1f7fa,#e8f1f6)', price: 45, orig: 78, cat: '果干蜜饯', points: ['野生蓝莓', '低糖工艺', '花青素高'] },
  { id: 'p54', name: '话梅 · 九制陈皮味', emoji: '🍑', bg: 'linear-gradient(135deg,#f6f7fb,#eef0f7)', price: 22.9, orig: 38, cat: '果干蜜饯', points: ['九制工艺', '生津开胃', '罐装'] },
  { id: 'p55', name: '柠檬片 · 冻干泡水', emoji: '🍋', bg: 'linear-gradient(135deg,#fdf6ec,#faf0e2)', price: 25.9, orig: 43, cat: '果干蜜饯', points: ['冻干柠檬', '泡水即饮', '维C补给'] },
  { id: 'p56', name: '无花果干 · 新疆产区', emoji: '🫒', bg: 'linear-gradient(135deg,#f2f8f4,#e9f3ee)', price: 49, orig: 82, cat: '果干蜜饯', points: ['新疆日晒', '自然甜', '颗颗饱满'] },
  { id: 'p57', name: '菠萝蜜干 · 越南工艺', emoji: '🍍', bg: 'linear-gradient(135deg,#f5f4fb,#eeecf8)', price: 36.9, orig: 62, cat: '果干蜜饯', points: ['真空脆片', '果香浓郁', '低温脱水'] },
  { id: 'p58', name: '红枣夹核桃 · 免洗', emoji: '🌰', bg: 'linear-gradient(135deg,#fdf2f2,#f9eaea)', price: 42, orig: 70, cat: '果干蜜饯', points: ['和田大枣', '整颗核桃', '开袋即食'] },
  { id: 'p59', name: '桂圆干 · 去壳免剥', emoji: '🍡', bg: 'linear-gradient(135deg,#f1f7fa,#e8f1f6)', price: 38.9, orig: 65, cat: '果干蜜饯', points: ['去壳免剥', '肉厚核小', '煲汤零食两用'] },
  { id: 'p60', name: '混合水果干 · 七拼', emoji: '🍇', bg: 'linear-gradient(135deg,#f6f7fb,#eef0f7)', price: 46.9, orig: 78, cat: '果干蜜饯', points: ['七种果干', '每日一包', '办公室零食'] },
  { id: 'p61', name: '全麦欧包 · 0 蔗糖', emoji: '🍞', bg: 'linear-gradient(135deg,#fdf6ec,#faf0e2)', price: 39.9, orig: 69, cat: '面包速食', points: ['0 蔗糖', '全麦粗粮', '早餐代餐'] },
  { id: 'p62', name: '奶酪包 · 冷链直发', emoji: '🥐', bg: 'linear-gradient(135deg,#f2f8f4,#e9f3ee)', price: 55, orig: 92, cat: '面包速食', points: ['厚层奶酪', '冷链直发', '爆浆口感'] },
  { id: 'p63', name: '肉松小贝 · 现做', emoji: '🧁', bg: 'linear-gradient(135deg,#f5f4fb,#eeecf8)', price: 45.9, orig: 76, cat: '面包速食', points: ['肉松满配', '现做现发', '下午茶'] },
  { id: 'p64', name: '三明治吐司 · 早餐装', emoji: '🥪', bg: 'linear-gradient(135deg,#fdf2f2,#f9eaea)', price: 29.9, orig: 49, cat: '面包速食', points: ['柔软拉丝', '早餐装', '整箱囤货'] },
  { id: 'p65', name: '自热米饭 · 香菇滑鸡', emoji: '🍚', bg: 'linear-gradient(135deg,#f1f7fa,#e8f1f6)', price: 32.9, orig: 55, cat: '面包速食', points: ['15 分钟自热', '真材实料', '露营应急'] },
  { id: 'p66', name: '自热火锅 · 麻辣牛肉', emoji: '🍲', bg: 'linear-gradient(135deg,#f6f7fb,#eef0f7)', price: 38.9, orig: 65, cat: '面包速食', points: ['自带发热包', '麻辣够味', '出差露营'] },
  { id: 'p67', name: '螺蛳粉 · 广西柳州', emoji: '🍜', bg: 'linear-gradient(135deg,#fdf6ec,#faf0e2)', price: 35.9, orig: 59, cat: '面包速食', points: ['正宗柳州', '酸笋足量', '袋装 3 包'] },
  { id: 'p68', name: '方便面 · 日式豚骨', emoji: '🍜', bg: 'linear-gradient(135deg,#f2f8f4,#e9f3ee)', price: 28.9, orig: 48, cat: '面包速食', points: ['日式豚骨汤', '非油炸面饼', '碗装'] },
  { id: 'p69', name: '蒸蛋糕 · 手撕面包', emoji: '🍰', bg: 'linear-gradient(135deg,#f5f4fb,#eeecf8)', price: 26.9, orig: 45, cat: '面包速食', points: ['松软手撕', '整箱囤货', '早餐加餐'] },
  { id: 'p70', name: '即食燕麦片 · 高纤', emoji: '🥣', bg: 'linear-gradient(135deg,#fdf2f2,#f9eaea)', price: 42.9, orig: 72, cat: '面包速食', points: ['高纤饱腹', '免煮即食', '代餐首选'] },
  { id: 'p71', name: '冻干黑咖啡 · 0 糖', emoji: '☕', bg: 'linear-gradient(135deg,#f1f7fa,#e8f1f6)', price: 59, orig: 98, cat: '冲饮甜品', points: ['冻干工艺', '0 糖 0 脂', '3 秒速溶'] },
  { id: 'p72', name: '厚乳拿铁 · 便携装', emoji: '🥤', bg: 'linear-gradient(135deg,#f6f7fb,#eef0f7)', price: 49.9, orig: 85, cat: '冲饮甜品', points: ['厚乳配方', '便携小袋', '冷热皆宜'] },
  { id: 'p73', name: '桂花酒酿圆子 · 免煮', emoji: '🍡', bg: 'linear-gradient(135deg,#fdf6ec,#faf0e2)', price: 32.9, orig: 55, cat: '冲饮甜品', points: ['免煮即食', '桂花香', '暖胃甜品'] },
  { id: 'p74', name: '芝麻糊 · 黑芝麻现磨', emoji: '🥣', bg: 'linear-gradient(135deg,#f2f8f4,#e9f3ee)', price: 38.9, orig: 65, cat: '冲饮甜品', points: ['现磨黑芝麻', '无添加蔗糖', '暖身早餐'] },
  { id: 'p75', name: '奶茶粉 · 港式丝袜', emoji: '🧋', bg: 'linear-gradient(135deg,#f5f4fb,#eeecf8)', price: 35.9, orig: 62, cat: '冲饮甜品', points: ['港式配方', '茶味浓郁', '独立条装'] },
  { id: 'p76', name: '柠檬红茶固体饮料', emoji: '🍋', bg: 'linear-gradient(135deg,#fdf2f2,#f9eaea)', price: 29.9, orig: 49, cat: '冲饮甜品', points: ['真柠檬冻干', '冷泡即饮', '夏日消暑'] },
  { id: 'p77', name: '热可可粉 · 比利时可可', emoji: '🍫', bg: 'linear-gradient(135deg,#f1f7fa,#e8f1f6)', price: 45.9, orig: 78, cat: '冲饮甜品', points: ['比利时可可', '冬日暖饮', '罐装'] },
  { id: 'p78', name: '银耳羹 · 免炖即食', emoji: '🥣', bg: 'linear-gradient(135deg,#f6f7fb,#eef0f7)', price: 39.9, orig: 68, cat: '冲饮甜品', points: ['免炖即食', '胶质浓稠', '常温保存'] },
  { id: 'p79', name: '绿豆沙冰 · 冲泡装', emoji: '🧊', bg: 'linear-gradient(135deg,#fdf6ec,#faf0e2)', price: 26.9, orig: 45, cat: '冲饮甜品', points: ['解暑绿豆', '冲泡即成', '夏季消暑'] },
  { id: 'p80', name: '姜茶 · 红糖姜块', emoji: '🫖', bg: 'linear-gradient(135deg,#f2f8f4,#e9f3ee)', price: 33.9, orig: 56, cat: '冲饮甜品', points: ['古法红糖', '暖身驱寒', '独立小块'] },
  { id: 'p81', name: '高蛋白鸡胸肉肠 · 低脂', emoji: '🌭', bg: 'linear-gradient(135deg,#f5f4fb,#eeecf8)', price: 49.9, orig: 85, cat: '健康代餐', points: ['每根 12g 蛋白', '低脂低卡', '健身加餐'] },
  { id: 'p82', name: '蛋白棒 · 巧克力味', emoji: '🍫', bg: 'linear-gradient(135deg,#fdf2f2,#f9eaea)', price: 68, orig: 115, cat: '健康代餐', points: ['20g 蛋白', '控糖配方', '代餐饱腹'] },
  { id: 'p83', name: '魔芋爽 · 0 卡辣条', emoji: '🌶️', bg: 'linear-gradient(135deg,#f1f7fa,#e8f1f6)', price: 19.9, orig: 34, cat: '健康代餐', points: ['0 卡魔芋', '辣味解馋', '减脂期救星'] },
  { id: 'p84', name: '无糖豆浆粉 · 现磨', emoji: '🥛', bg: 'linear-gradient(135deg,#f6f7fb,#eef0f7)', price: 42.9, orig: 72, cat: '健康代餐', points: ['无添加蔗糖', '现磨黄豆', '早餐蛋白'] },
  { id: 'p85', name: '低卡蒟蒻果冻 · 混合味', emoji: '🍮', bg: 'linear-gradient(135deg,#fdf6ec,#faf0e2)', price: 29.9, orig: 49, cat: '健康代餐', points: ['每只 8 大卡', '果汁添加', '解馋不胖'] },
  { id: 'p86', name: '全麦饼干 · 粗粮饱腹', emoji: '🍪', bg: 'linear-gradient(135deg,#f2f8f4,#e9f3ee)', price: 32.9, orig: 55, cat: '健康代餐', points: ['全麦粗粮', '高膳食纤维', '控卡零食'] },
  { id: 'p87', name: '无糖酸奶块 · 冻干', emoji: '🥛', bg: 'linear-gradient(135deg,#f5f4fb,#eeecf8)', price: 39.9, orig: 68, cat: '健康代餐', points: ['冻干酸奶', '无添加糖', '益生菌'] },
  { id: 'p88', name: '鹰嘴豆脆 · 高纤零食', emoji: '🫘', bg: 'linear-gradient(135deg,#fdf2f2,#f9eaea)', price: 35.9, orig: 59, cat: '健康代餐', points: ['高蛋白高纤', '非油炸', '健身零食'] },
  { id: 'p89', name: '代餐奶昔 · 3 种口味', emoji: '🥤', bg: 'linear-gradient(135deg,#f1f7fa,#e8f1f6)', price: 89, orig: 148, cat: '健康代餐', points: ['饱腹 4 小时', '膳食纤维', '控卡代餐'] },
  { id: 'p90', name: '海苔卷 · 0 脂', emoji: '🍙', bg: 'linear-gradient(135deg,#f6f7fb,#eef0f7)', price: 22.9, orig: 38, cat: '健康代餐', points: ['0 脂低卡', '原味海苔', '追剧解馋'] },
  { id: 'p91', name: '云南鲜花饼 · 玫瑰馅', emoji: '🌹', bg: 'linear-gradient(135deg,#fdf6ec,#faf0e2)', price: 39.9, orig: 68, cat: '地方特产', points: ['现烤直发', '玫瑰花瓣馅', '云南特产'] },
  { id: 'p92', name: '潮汕牛肉丸 · 手打', emoji: '🍡', bg: 'linear-gradient(135deg,#f2f8f4,#e9f3ee)', price: 59, orig: 99, cat: '地方特产', points: ['手打弹牙', '冷链直发', '火锅必备'] },
  { id: 'p93', name: '新疆和田大枣 · 特级', emoji: '🌰', bg: 'linear-gradient(135deg,#f5f4fb,#eeecf8)', price: 55.9, orig: 92, cat: '地方特产', points: ['特级果', '肉厚核小', '新疆直发'] },
  { id: 'p94', name: '东北冻梨 · 冷链', emoji: '🍐', bg: 'linear-gradient(135deg,#fdf2f2,#f9eaea)', price: 45.9, orig: 76, cat: '地方特产', points: ['冰镇解腻', '冷链直发', '东北风味'] },
  { id: 'p95', name: '湖南糖油粑粑 · 免炸', emoji: '🍡', bg: 'linear-gradient(135deg,#f1f7fa,#e8f1f6)', price: 32.9, orig: 55, cat: '地方特产', points: ['免炸复热', '外脆内糯', '长沙风味'] },
  { id: 'p96', name: '广式腊肠 · 甜味', emoji: '🌭', bg: 'linear-gradient(135deg,#f6f7fb,#eef0f7)', price: 68, orig: 112, cat: '地方特产', points: ['广式甜味', '晒足 30 天', '煲仔饭必备'] },
  { id: 'p97', name: '山西陈醋花生', emoji: '🥜', bg: 'linear-gradient(135deg,#fdf6ec,#faf0e2)', price: 21.9, orig: 36, cat: '地方特产', points: ['陈醋腌渍', '酸香开胃', '佐餐小食'] },
  { id: 'p98', name: '福建肉燕 · 手打燕皮', emoji: '🥟', bg: 'linear-gradient(135deg,#f2f8f4,#e9f3ee)', price: 49.9, orig: 82, cat: '地方特产', points: ['手打燕皮', '汤食两用', '福州风味'] },
  { id: 'p99', name: '四川灯影牛肉丝', emoji: '🥩', bg: 'linear-gradient(135deg,#f5f4fb,#eeecf8)', price: 62, orig: 105, cat: '地方特产', points: ['薄如纸片', '麻辣醇香', '川味经典'] },
  { id: 'p100', name: '天津麻花 · 十八街', emoji: '🥨', bg: 'linear-gradient(135deg,#fdf2f2,#f9eaea)', price: 36.9, orig: 62, cat: '地方特产', points: ['古法麻花', '酥脆掉渣', '老字号'] },
];

/* 热点 → 推荐商品匹配关系(人工标注位;此处按当前商品库预计算,可手工微调) */
const MATCH_MAP = {
  n1: [ { pid: 'p79', score: 94, reason: '热点命中「消暑冷饮」场景,该商品的「绿豆、冰」卖点高度契合' },
        { pid: 'p85', score: 94, reason: '热点命中「高温消暑、消暑冷饮」场景,该商品的「果冻」卖点高度契合' },
        { pid: 'p94', score: 94, reason: '热点命中「消暑冷饮」场景,该商品的「冰、冻梨」卖点高度契合' },
        { pid: 'p55', score: 76, reason: '热点命中「消暑冷饮」场景,该商品的「柠檬」卖点高度契合' } ],
  n2: [ { pid: 'p22', score: 97, reason: '热点命中「观赛聚会、减脂控糖」场景,该商品的「卤、牛肉干」卖点高度契合' },
        { pid: 'p23', score: 94, reason: '热点命中「观赛聚会」场景,该商品的「凤爪、卤」卖点高度契合' },
        { pid: 'p24', score: 94, reason: '热点命中「观赛聚会」场景,该商品的「鸭脖、卤」卖点高度契合' },
        { pid: 'p28', score: 94, reason: '热点命中「观赛聚会」场景,该商品的「鸭翅、卤」卖点高度契合' } ],
  n3: [ { pid: 'p47', score: 97, reason: '热点命中「追剧综艺、熬夜夜宵」场景,该商品的「薯片、锅巴」卖点高度契合' },
        { pid: 'p24', score: 97, reason: '热点命中「追剧综艺、熬夜夜宵」场景,该商品的「追剧、卤」卖点高度契合' },
        { pid: 'p6', score: 94, reason: '热点命中「追剧综艺」场景,该商品的「瓜子、追剧」卖点高度契合' },
        { pid: 'p30', score: 94, reason: '热点命中「熬夜夜宵」场景,该商品的「卤、辣」卖点高度契合' } ],
  n4: [ { pid: 'p25', score: 97, reason: '热点命中「亲子学生、儿童零食」场景,该商品的「儿童、低盐」卖点高度契合' },
        { pid: 'p38', score: 97, reason: '热点命中「亲子学生、儿童零食」场景,该商品的「儿童、棒棒糖」卖点高度契合' },
        { pid: 'p18', score: 76, reason: '热点命中「儿童零食」场景,该商品的「芝士」卖点高度契合' },
        { pid: 'p32', score: 76, reason: '热点命中「儿童零食」场景,该商品的「软糖」卖点高度契合' } ],
  n5: [ { pid: 'p91', score: 97, reason: '热点命中「节日送礼、地方特产品类」场景,该商品的「鲜花饼、特产」卖点高度契合' },
        { pid: 'p96', score: 97, reason: '热点命中「节日送礼、地方特产品类」场景,该商品的「腊肠、特产」卖点高度契合' },
        { pid: 'p38', score: 94, reason: '热点命中「节日送礼」场景,该商品的「礼盒、棒棒糖」卖点高度契合' },
        { pid: 'p92', score: 82, reason: '热点命中「节日送礼、地方特产品类」场景,该商品的「特产、地方特产」卖点高度契合' } ],
  n6: [ { pid: 'p35', score: 88, reason: '热点命中「户外露营、出行囤货」场景,该商品的「便携」卖点高度契合' },
        { pid: 'p65', score: 88, reason: '热点命中「户外露营、出行囤货」场景,该商品的「露营、自热」卖点高度契合' },
        { pid: 'p66', score: 88, reason: '热点命中「户外露营、出行囤货」场景,该商品的「露营、自热」卖点高度契合' },
        { pid: 'p72', score: 88, reason: '热点命中「户外露营、出行囤货」场景,该商品的「便携」卖点高度契合' } ],
};

/* =====================================================================
 * 热点 → 商品 匹配算法
 *
 * MATCH_MAP 是人工标注的匹配关系,只覆盖内置的 6 条 Mock 热点。
 * 接入实时抓取后,热点是任意的,需要按「场景关键词」现算匹配度:
 *   1) 用热点文本命中若干「消费场景」(高温 / 运动 / 户外 / 穿搭…)
 *   2) 场景再去命中商品的名称、卖点、品类
 *   3) 命中权重累加 → 归一化为 0~99 匹配度,并生成可解释的推荐理由
 * 接真实推荐服务(向量检索 / 类目模型)时,替换 matchProducts 即可。
 * ===================================================================== */
const SCENES = [
  { name: '高温消暑', weight: 3,
    /* 注意:关键词一律用 2 字以上词组。单字(如「晒」)会把"晒出户型图"这类无关新闻误判成高温话题 */
    news: ['高温', '酷暑', '炎热', '热浪', '气温', '中暑', '三伏', '暑热', '消暑', '清凉', '空调', '避暑', '暴晒', '晒伤', '紫外线', '防晒', '夏天', '夏日'],
    prod: ['风扇', '冰丝', '凉感', '冰感', '空调被', '夏凉', '冰袖', '防晒', '凉拖', '果冻', '速干', '吨吨杯'] },
  { name: '运动健身', weight: 3,
    news: ['奥运', '运动会', '健身', '跑步', '马拉松', '球赛', '体育', '锻炼', '体测', '体质', '赛事', '夺金', '冠军', '训练'],
    prod: ['跑步鞋', '缓震', '运动', '速干', '跳绳', '透气', '弹力'] },
  { name: '户外露营', weight: 3,
    news: ['露营', '户外', '野餐', '徒步', '公园', '出游', '旅游', '度假', '景区', '踏青', '周末', '自驾'],
    prod: ['露营', '折叠', '便携', '驱蚊', '户外', '收纳'] },
  { name: '穿搭颜值', weight: 2,
    news: ['穿搭', '时尚', '色彩', '多巴胺', '美拉德', '出片', '拍照', '搭配', '新宠', '潮流', '单品'],
    prod: ['帆布包', '撞色', '多巴胺', '出片', '果冻', '配色', 'T 恤', '凉拖'] },
  { name: '国风文创', weight: 3,
    news: ['国风', '文创', '博物馆', '非遗', '汉服', '传统', '文博', '古风', '手作'],
    prod: ['团扇', '国风', '非遗', 'DIY', '手作', '伴手礼'] },
  { name: '亲子学生', weight: 2,
    news: ['学生', '孩子', '家长', '亲子', '儿童', '暑假', '寒假', '开学', '中考', '高考', '校园'],
    prod: ['亲子', '儿童', '跳绳', '手作', '学生'] },
  { name: '驱蚊防虫', weight: 3,
    news: ['蚊虫', '蚊子', '驱蚊', '虫咬', '登革热', '叮咬'],
    prod: ['驱蚊', '植物配方'] },
  { name: '健康补水', weight: 2,
    news: ['喝水', '补水', '健康', '养生', '脱水', '中暑'],
    prod: ['吨吨杯', '喝水', '刻度', '容量'] },

  /* ---------- 零食品类的借势场景 ---------- */
  { name: '追剧综艺', weight: 3,
    news: ['追剧', '综艺', '热播', '开播', '剧集', '收视', '电视剧', '会员', '影院', '上映', '票房', '春晚', '晚会'],
    prod: ['薯片', '薯条', '爆米花', '瓜子', '虾条', '锅巴', '虾片', '海苔', '玉米', '追剧'] },
  { name: '办公加班', weight: 3,
    news: ['加班', '打工人', '上班', '办公室', '通勤', '提神', '996', '职场', '摸鱼', '开会'],
    prod: ['咖啡', '拿铁', '坚果', '巧克力', '苏打饼', '办公室', '独立小包', '能量'] },
  { name: '观赛聚会', weight: 3,
    news: ['球赛', '决赛', '半决赛', '世界杯', '欧洲杯', '亚洲杯', '联赛', '夺冠', '夺金', '奥运', '赛事', '比赛', '开幕', '聚会', '派对', '开黑'],
    prod: ['鸭脖', '鸭翅', '凤爪', '卤', '牛肉干', '鱿鱼', '薯片', '爆米花', '豆干', '分享装'] },
  { name: '节日送礼', weight: 3,
    news: ['中秋', '春节', '年货', '国庆', '端午', '元旦', '礼盒', '送礼', '团圆', '除夕', '拜年', '开学季', '儿童节', '母亲节'],
    prod: ['礼盒', '铁盒', '大礼包', '月饼', '蛋黄酥', '鲜花饼', '腊肠', '特产', '牛轧糖', '棒棒糖'] },
  { name: '减脂控糖', weight: 3,
    news: ['减脂', '减肥', '控糖', '低卡', '轻食', '体重', '健身', '卡路里', '血糖', '身材', '马甲线'],
    prod: ['0 卡', '低卡', '无糖', '0 糖', '高蛋白', '代餐', '魔芋', '全麦', '低脂', '高纤', '鸡胸'] },
  { name: '儿童零食', weight: 3,
    news: ['儿童', '宝宝', '孩子', '幼儿园', '小学', '家长', '开学', '暑假', '亲子', '六一'],
    prod: ['儿童', '低盐', '无添加', '棒棒糖', '软糖', '芝士', '蒸蛋糕', '肉松'] },
  { name: '熬夜夜宵', weight: 3,
    news: ['熬夜', '夜宵', '深夜', '失眠', '通宵', '凌晨', '饿了'],
    prod: ['卤', '鸭脖', '螺蛳粉', '方便面', '自热', '泡面', '锅巴', '辣'] },
  { name: '出行囤货', weight: 2,
    news: ['旅行', '出游', '高铁', '自驾', '春运', '返乡', '出差', '露营', '囤货', '618', '双11', '双十一', '大促'],
    prod: ['便携', '独立包装', '自热', '整箱', '桶装', '家庭装', '小包'] },
  { name: '寒潮暖食', weight: 3,
    news: ['寒潮', '降温', '大雪', '暴雪', '冷空气', '入冬', '低温', '取暖', '结冰'],
    prod: ['热可可', '姜茶', '红糖', '芝麻糊', '银耳', '自热火锅', '暖'] },
  { name: '消暑冷饮', weight: 3,
    news: ['高温', '酷暑', '炎热', '三伏', '消暑', '解暑', '冰镇'],
    prod: ['绿豆', '冰', '柠檬', '冻梨', '冷饮', '果冻', '酸奶'] },
];

/** 商品的可检索文本 */
const productText = p => `${p.name} ${p.cat} ${(p.points || []).join(' ')}`;

/**
 * 为任意热点算出匹配商品
 * @returns [{pid, score, reason}] 与 MATCH_MAP 的结构一致
 */
function matchProducts(newsItem, products = PRODUCTS, topN = 6) {
  const text = `${newsItem.title || ''} ${newsItem.summary || ''} ${(newsItem.topics || []).join(' ')}`;
  const hitScenes = SCENES.filter(s => s.news.some(k => text.includes(k)));

  const scored = products.map(p => {
    const ptext = productText(p);
    let raw = 0;
    const reasons = [];
    hitScenes.forEach(s => {
      const hits = s.prod.filter(k => ptext.includes(k));
      if (!hits.length) return;
      raw += s.weight * Math.min(hits.length, 2);
      reasons.push({ scene: s.name, hits });
    });
    /* 热点原文直接提到商品品类,额外加分 */
    if (text.includes(p.cat)) { raw += 1; reasons.push({ scene: p.cat + '品类', hits: [p.cat] }); }
    return { p, raw, reasons };
  }).filter(x => x.raw > 0);

  /* 匹配度必须是「绝对分」:若按本条新闻内部归一化,再弱的命中也会被拉到高分,
     导致「晒出户型图」这类新闻也能拿到 96 分。这里要求至少完整命中一个场景(raw≥3)。 */
  const MIN_RAW = 3;
  const solid = scored.filter(x => x.raw >= MIN_RAW);
  if (!solid.length) return [];

  return solid
    .sort((a, b) => b.raw - a.raw)
    .slice(0, topN)
    .map(x => ({
      pid: x.p.id,
      /* 绝对分:一次场景命中 ≈ 76,命中越多越高,封顶 97 */
      score: Math.min(97, Math.round(58 + x.raw * 6)),
      reason: `热点命中「${[...new Set(x.reasons.map(r => r.scene))].join('、')}」场景,该商品的「${[...new Set(x.reasons.flatMap(r => r.hits))].slice(0, 2).join('、')}」卖点高度契合`,
    }));
}

/* =====================================================================
 * 商品库读取:后台「商品库管理」保存后,工作台与评测台都要读到最新数据
 * 优先级:服务端 products.json → 浏览器 localStorage → 本文件内置 PRODUCTS
 * ===================================================================== */
async function loadProducts() {
  try {
    const res = await fetch('/api/products', { cache: 'no-store' });
    if (res.ok) {
      const j = await res.json();
      if (j && Array.isArray(j.products) && j.products.length) return { products: j.products, source: 'server' };
    }
  } catch (e) { /* file:// 打开或未启动服务 */ }
  try {
    const s = JSON.parse(localStorage.getItem('hotspot.products') || 'null');
    if (s && Array.isArray(s.products) && s.products.length) return { products: s.products, source: 'local' };
  } catch (e) { /* ignore */ }
  return { products: PRODUCTS, source: 'default' };
}
