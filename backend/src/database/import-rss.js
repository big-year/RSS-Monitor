const pool = require('../config/database');
require('dotenv').config();

// RSS源数据，按分类整理
const rssData = {
  // 科技类
  '科技': [
    { name: '少数派', rss_url: 'https://sspai.com/feed', site_url: 'https://sspai.com', description: '高效工作，品质生活' },
    { name: '36氪', rss_url: 'https://36kr.com/feed', site_url: 'https://36kr.com', description: '让创业更简单' },
    { name: 'V2EX', rss_url: 'https://v2ex.com/index.xml', site_url: 'https://v2ex.com', description: '创意工作者社区' },
    { name: '爱范儿', rss_url: 'https://www.ifanr.com/feed', site_url: 'https://www.ifanr.com', description: '让未来触手可及' },
    { name: '虎嗅网', rss_url: 'https://www.huxiu.com/rss/0.xml', site_url: 'https://www.huxiu.com', description: '有视角的商业资讯' },
    { name: 'IT之家', rss_url: 'https://www.ithome.com/rss/', site_url: 'https://www.ithome.com', description: 'IT资讯' },
    { name: '极客公园', rss_url: 'http://www.geekpark.net/rss', site_url: 'https://www.geekpark.net', description: '极客公园' },
    { name: '奇客Solidot', rss_url: 'https://www.solidot.org/index.rss', site_url: 'https://www.solidot.org', description: '传递最新科技情报' },
    { name: '小众软件', rss_url: 'https://www.appinn.com/feed/', site_url: 'https://www.appinn.com', description: '分享免费、小巧、实用软件' },
    { name: '异次元软件世界', rss_url: 'http://feed.iplaysoft.com/', site_url: 'https://www.iplaysoft.com', description: '软件改变生活' },
    { name: 'Engadget 中国', rss_url: 'https://cn.engadget.com/rss.xml', site_url: 'https://cn.engadget.com', description: '科技新闻' },
    { name: '数字尾巴', rss_url: 'https://plink.anyfeeder.com/dgtle', site_url: 'https://www.dgtle.com', description: '分享美好数字生活' },
    { name: '品玩', rss_url: 'https://plink.anyfeeder.com/pingwest', site_url: 'https://www.pingwest.com', description: '有品好玩的科技' },
    { name: '雷峰网', rss_url: 'https://plink.anyfeeder.com/leiphone', site_url: 'https://www.leiphone.com', description: '读懂智能&未来' },
    { name: 'cnBeta', rss_url: 'https://plink.anyfeeder.com/cnbeta', site_url: 'https://www.cnbeta.com', description: '中文业界资讯站' },
    { name: '超能网', rss_url: 'https://plink.anyfeeder.com/expreview', site_url: 'https://www.expreview.com', description: '专业硬件评测' },
    { name: 'Readhub 热门话题', rss_url: 'https://plink.anyfeeder.com/readhub/topic', site_url: 'https://readhub.cn', description: '每日热门科技话题' },
    { name: 'Readhub 开发者资讯', rss_url: 'https://plink.anyfeeder.com/readhub/technews', site_url: 'https://readhub.cn', description: '开发者资讯' },
  ],

  // 开发技术类
  '技术': [
    { name: '阮一峰的网络日志', rss_url: 'https://www.ruanyifeng.com/blog/atom.xml', site_url: 'https://www.ruanyifeng.com', description: '阮一峰的个人博客' },
    { name: '美团技术团队', rss_url: 'https://tech.meituan.com/feed', site_url: 'https://tech.meituan.com', description: '美团技术博客' },
    { name: '酷壳 CoolShell', rss_url: 'http://coolshell.cn/feed', site_url: 'https://coolshell.cn', description: '陈皓的技术博客' },
    { name: '掘金 前端', rss_url: 'https://rsshub.app/juejin/category/frontend', site_url: 'https://juejin.cn', description: '掘金前端热门' },
    { name: '云风的BLOG', rss_url: 'http://blog.codingnow.com/atom.xml', site_url: 'https://blog.codingnow.com', description: '云风的技术博客' },
    { name: 'Python工匠', rss_url: 'https://www.zlovezl.cn/feeds/latest/', site_url: 'https://www.zlovezl.cn', description: 'Python技术博客' },
    { name: '张鑫旭', rss_url: 'https://www.zhangxinxu.com/wordpress/feed/', site_url: 'https://www.zhangxinxu.com', description: '前端技术博客' },
    { name: 'HelloGitHub', rss_url: 'http://hellogithub.com/rss', site_url: 'https://hellogithub.com', description: '分享GitHub上有趣的项目' },
    { name: 'CSS-Tricks', rss_url: 'https://css-tricks.com/feed/', site_url: 'https://css-tricks.com', description: 'CSS技巧' },
    { name: 'web.dev', rss_url: 'https://web.dev/feed.xml', site_url: 'https://web.dev', description: 'Google Web开发' },
    { name: 'Dan Abramov', rss_url: 'https://overreacted.io/rss.xml', site_url: 'https://overreacted.io', description: 'React核心开发者博客' },
    { name: 'DIYGod', rss_url: 'https://diygod.me/atom.xml', site_url: 'https://diygod.me', description: 'RSSHub作者博客' },
    { name: '二丫讲梵', rss_url: 'https://wiki.eryajf.net/rss.xml', site_url: 'https://wiki.eryajf.net', description: '运维开发博客' },
    { name: '开源中国-软件更新', rss_url: 'https://rsshub.app/oschina/news/project', site_url: 'https://www.oschina.net', description: '开源软件更新资讯' },
    { name: '码农周刊', rss_url: 'https://rsshub.app/manong-weekly', site_url: 'https://weekly.manong.io', description: '码农周刊' },
    { name: '潮流周刊', rss_url: 'https://weekly.tw93.fun/rss.xml', site_url: 'https://weekly.tw93.fun', description: 'Tw93的潮流周刊' },
    { name: 'Tony Bai', rss_url: 'http://tonybai.com/feed/', site_url: 'https://tonybai.com', description: 'Go语言博客' },
    { name: 'Anthony Fu', rss_url: 'https://antfu.me/feed.xml', site_url: 'https://antfu.me', description: 'Vue/Vite核心成员博客' },
    { name: '有赞技术团队', rss_url: 'https://tech.youzan.com/rss/', site_url: 'https://tech.youzan.com', description: '有赞技术博客' },
    { name: '字节跳动技术团队', rss_url: 'https://rsshub.app/juejin/posts/1838039172387262', site_url: 'https://juejin.cn', description: '字节跳动技术专栏' },
  ],

  // 新闻时政类
  '新闻': [
    { name: '知乎热榜', rss_url: 'https://rsshub.app/zhihu/hotlist', site_url: 'https://www.zhihu.com', description: '知乎热门话题' },
    { name: '知乎日报', rss_url: 'https://rsshub.app/zhihu/daily', site_url: 'https://daily.zhihu.com', description: '每日精选' },
    { name: '微博热搜榜', rss_url: 'https://rsshub.app/weibo/search/hot', site_url: 'https://weibo.com', description: '微博热搜' },
    { name: '联合早报-中港台', rss_url: 'https://plink.anyfeeder.com/zaobao/realtime/china', site_url: 'https://www.zaobao.com', description: '联合早报中港台新闻' },
    { name: '联合早报-国际', rss_url: 'https://plink.anyfeeder.com/zaobao/realtime/world', site_url: 'https://www.zaobao.com', description: '联合早报国际新闻' },
    { name: '南方周末', rss_url: 'https://rsshub.app/infzm/2', site_url: 'https://www.infzm.com', description: '南方周末新闻' },
    { name: 'BBC中文', rss_url: 'https://plink.anyfeeder.com/bbc/cn', site_url: 'https://www.bbc.com/zhongwen', description: 'BBC中文网' },
    { name: '纽约时报中文网', rss_url: 'http://cn.nytimes.com/rss/news.xml', site_url: 'https://cn.nytimes.com', description: '纽约时报中文版' },
    { name: '华尔街日报', rss_url: 'https://cn.wsj.com/zh-hans/rss', site_url: 'https://cn.wsj.com', description: '华尔街日报中文版' },
    { name: '路透中文', rss_url: 'https://plink.anyfeeder.com/reuters/cn', site_url: 'https://www.reuters.com', description: '路透社中文' },
    { name: '端传媒', rss_url: 'https://plink.anyfeeder.com/initium/latest', site_url: 'https://theinitium.com', description: '端传媒最新' },
    { name: '澎湃新闻', rss_url: 'https://plink.anyfeeder.com/thepaper', site_url: 'https://www.thepaper.cn', description: '澎湃新闻首页' },
    { name: '新京报', rss_url: 'https://plink.anyfeeder.com/bjnews', site_url: 'https://www.bjnews.com.cn', description: '新京报' },
    { name: '人民日报', rss_url: 'https://plink.anyfeeder.com/people-daily', site_url: 'http://www.people.com.cn', description: '人民日报' },
    { name: '新华社', rss_url: 'https://plink.anyfeeder.com/newscn/whxw', site_url: 'http://www.xinhuanet.com', description: '新华社新闻' },
    { name: '美国之音', rss_url: 'https://plink.anyfeeder.com/voa/chinese', site_url: 'https://www.voachinese.com', description: '美国之音中文' },
    { name: '法广', rss_url: 'https://plink.anyfeeder.com/rfi/cn', site_url: 'https://www.rfi.fr/cn', description: '法国国际广播电台' },
    { name: 'ZAKER精读', rss_url: 'https://rsshub.app/zaker/focusread', site_url: 'https://www.zaker.cn', description: 'ZAKER精读新闻' },
  ],

  // 财经类
  '财经': [
    { name: '财富中文网', rss_url: 'https://plink.anyfeeder.com/fortunechina', site_url: 'https://www.fortunechina.com', description: '财富中文网' },
    { name: '华尔街见闻', rss_url: 'https://plink.anyfeeder.com/weixin/wallstreetcn', site_url: 'https://wallstreetcn.com', description: '华尔街见闻' },
    { name: '雪球今日话题', rss_url: 'https://plink.anyfeeder.com/xueqiu/hot', site_url: 'https://xueqiu.com', description: '雪球热门话题' },
    { name: '第一财经', rss_url: 'https://plink.anyfeeder.com/weixin/CBNweekly2008', site_url: 'https://www.yicai.com', description: '第一财经周刊' },
    { name: '经济观察网', rss_url: 'https://plink.anyfeeder.com/eeo', site_url: 'http://www.eeo.com.cn', description: '经济观察网' },
    { name: '21世纪经济报道', rss_url: 'https://plink.anyfeeder.com/weixin/jjbd21', site_url: 'https://www.21jingji.com', description: '21世纪经济报道' },
    { name: '叶檀财经', rss_url: 'https://plink.anyfeeder.com/weixin/tancaijing', site_url: '', description: '叶檀财经公众号' },
    { name: '吴晓波频道', rss_url: 'https://plink.anyfeeder.com/weixin/wuxiaobopd', site_url: '', description: '吴晓波频道' },
    { name: '央视财经', rss_url: 'https://plink.anyfeeder.com/weixin/cctvyscj', site_url: '', description: '央视财经' },
    { name: '新财富', rss_url: 'https://plink.anyfeeder.com/weixin/newfortune', site_url: '', description: '新财富杂志' },
    { name: '经济日报', rss_url: 'https://plink.anyfeeder.com/jingjiribao', site_url: 'http://www.ce.cn', description: '经济日报' },
  ],

  // 生活阅读类
  '阅读': [
    { name: '左岸读书', rss_url: 'http://www.zreading.cn/feed', site_url: 'http://www.zreading.cn', description: '左岸读书' },
    { name: '「ONE·一个」', rss_url: 'https://rsshub.app/one', site_url: 'http://wufazhuce.com', description: '一个' },
    { name: '十点读书', rss_url: 'https://plink.anyfeeder.com/weixin/duhaoshu', site_url: '', description: '十点读书公众号' },
    { name: '书单来了', rss_url: 'https://plink.anyfeeder.com/weixin/shudanlaile', site_url: '', description: '书单推荐' },
    { name: '读库小报', rss_url: 'https://plink.anyfeeder.com/weixin/dukuxiaobao', site_url: '', description: '读库' },
    { name: '青年文摘', rss_url: 'https://plink.anyfeeder.com/weixin/qnwzwx', site_url: '', description: '青年文摘' },
    { name: '三联生活周刊', rss_url: 'https://plink.anyfeeder.com/weixin/lifeweek', site_url: '', description: '三联生活周刊' },
    { name: '新京报书评周刊', rss_url: 'https://plink.anyfeeder.com/weixin/ibookreview', site_url: '', description: '书评周刊' },
    { name: '单读', rss_url: 'https://plink.anyfeeder.com/weixin/dandureading', site_url: '', description: '单读' },
    { name: '看理想', rss_url: 'https://plink.anyfeeder.com/weixin/ikanlixiang', site_url: '', description: '看理想' },
    { name: '观止·每日一文', rss_url: 'https://plink.anyfeeder.com/meiriyiwen', site_url: 'https://meiriyiwen.com', description: '每日一文' },
    { name: '豆瓣最受欢迎书评', rss_url: 'https://www.douban.com/feed/review/book', site_url: 'https://book.douban.com', description: '豆瓣书评' },
  ],

  // 娱乐游戏类
  '娱乐': [
    { name: '机核', rss_url: 'https://www.gcores.com/rss', site_url: 'https://www.gcores.com', description: '不止是游戏' },
    { name: '游戏研究社', rss_url: 'https://www.yystv.cn/rss/feed', site_url: 'https://www.yystv.cn', description: '游戏研究社' },
    { name: '煎蛋热榜', rss_url: 'https://rsshub.app/jandan/top', site_url: 'https://jandan.net', description: '煎蛋网热门' },
    { name: '抽屉新热榜', rss_url: 'https://rsshub.app/chouti/top/168', site_url: 'https://dig.chouti.com', description: '抽屉168小时热榜' },
    { name: '酷安新鲜图文', rss_url: 'https://rsshub.app/coolapk/tuwen-xinxian', site_url: 'https://www.coolapk.com', description: '酷安图文' },
    { name: '触乐', rss_url: 'http://www.chuapp.com/feed', site_url: 'http://www.chuapp.com', description: '触乐游戏媒体' },
    { name: '稚晖君B站动态', rss_url: 'https://rsshub.app/bilibili/user/dynamic/20259914', site_url: 'https://space.bilibili.com/20259914', description: '稚晖君' },
  ],

  // 产品设计类
  '产品': [
    { name: '人人都是产品经理', rss_url: 'https://www.woshipm.com/feed', site_url: 'https://www.woshipm.com', description: '产品经理社区' },
    { name: '优设UISDC', rss_url: 'http://www.uisdc.com/feed', site_url: 'https://www.uisdc.com', description: '设计师交流平台' },
    { name: '理想生活实验室', rss_url: 'https://www.toodaylab.com/feed', site_url: 'https://www.toodaylab.com', description: '理想生活实验室' },
    { name: 'Decohack', rss_url: 'https://www.decohack.com/feed', site_url: 'https://www.decohack.com', description: '独立开发者灵感周刊' },
    { name: '构建我的被动收入', rss_url: 'https://www.bmpi.dev/index.xml', site_url: 'https://www.bmpi.dev', description: '被动收入博客' },
    { name: '透明创业实验', rss_url: 'https://blog.t9t.io/atom.xml', site_url: 'https://blog.t9t.io', description: '透明创业' },
    { name: 'ezindie独立开发变现', rss_url: 'https://www.ezindie.com/feed/rss.xml', site_url: 'https://www.ezindie.com', description: '独立开发变现' },
  ],

  // 博客个人类
  '博客': [
    { name: '土木坛子', rss_url: 'https://tumutanzi.com/feed', site_url: 'https://tumutanzi.com', description: '土木坛子博客' },
    { name: '胡涂说', rss_url: 'https://hutusi.com/feed.xml', site_url: 'https://hutusi.com', description: '胡涂说博客' },
    { name: '太隐', rss_url: 'https://wangyurui.com/feed.xml', site_url: 'https://wangyurui.com', description: '太隐博客' },
    { name: 'Randy\'s Blog', rss_url: 'https://lutaonan.com/rss.xml', site_url: 'https://lutaonan.com', description: 'Randy博客' },
    { name: 'GeekPlux', rss_url: 'https://geekplux.com/feed.xml', site_url: 'https://geekplux.com', description: 'GeekPlux博客' },
    { name: '卡瓦邦噶', rss_url: 'https://www.kawabangga.com/feed', site_url: 'https://www.kawabangga.com', description: '卡瓦邦噶博客' },
    { name: '月光博客', rss_url: 'http://www.williamlong.info/rss.xml', site_url: 'https://www.williamlong.info', description: '月光博客' },
    { name: 'oldj\'s blog', rss_url: 'https://oldj.net/feed', site_url: 'https://oldj.net', description: 'oldj博客' },
    { name: '王登科DK博客', rss_url: 'https://greatdk.com/feed', site_url: 'https://greatdk.com', description: 'DK博客' },
    { name: '阳志平的网志', rss_url: 'https://www.yangzhiping.com/feed.xml', site_url: 'https://www.yangzhiping.com', description: '阳志平博客' },
    { name: '刘未鹏Mind Hacks', rss_url: 'http://mindhacks.cn/feed/', site_url: 'http://mindhacks.cn', description: '刘未鹏博客' },
  ],
};

async function importRss() {
  const client = await pool.connect();

  try {
    console.log('开始导入RSS源...\n');

    await client.query('BEGIN');

    let totalImported = 0;
    let totalSkipped = 0;

    for (const [categoryName, sources] of Object.entries(rssData)) {
      // 获取或创建分类
      let categoryResult = await client.query(
        'SELECT id FROM categories WHERE name = $1',
        [categoryName]
      );

      let categoryId;
      if (categoryResult.rows.length === 0) {
        // 创建新分类
        const colors = {
          '科技': '#409EFF',
          '技术': '#67C23A',
          '新闻': '#E6A23C',
          '财经': '#F56C6C',
          '阅读': '#909399',
          '娱乐': '#E040FB',
          '产品': '#00BCD4',
          '博客': '#795548'
        };
        const icons = {
          '科技': 'Monitor',
          '技术': 'Cpu',
          '新闻': 'Document',
          '财经': 'TrendCharts',
          '阅读': 'Reading',
          '娱乐': 'VideoCamera',
          '产品': 'Goods',
          '博客': 'User'
        };

        categoryResult = await client.query(`
          INSERT INTO categories (name, description, icon, color, sort_order)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [categoryName, `${categoryName}相关RSS源`, icons[categoryName] || 'Folder', colors[categoryName] || '#409EFF', Object.keys(rssData).indexOf(categoryName)]);
        categoryId = categoryResult.rows[0].id;
        console.log(`✓ 创建分类: ${categoryName}`);
      } else {
        categoryId = categoryResult.rows[0].id;
      }

      // 导入该分类下的RSS源
      for (const source of sources) {
        try {
          // 检查是否已存在
          const existingResult = await client.query(
            'SELECT id FROM rss_sources WHERE rss_url = $1',
            [source.rss_url]
          );

          if (existingResult.rows.length > 0) {
            // 已存在，只添加分类关联
            const rssId = existingResult.rows[0].id;
            await client.query(`
              INSERT INTO rss_category (rss_id, category_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
            `, [rssId, categoryId]);
            totalSkipped++;
          } else {
            // 插入新RSS源
            const insertResult = await client.query(`
              INSERT INTO rss_sources (name, rss_url, site_url, description, update_interval)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING id
            `, [source.name, source.rss_url, source.site_url || null, source.description || null, 15]);

            const rssId = insertResult.rows[0].id;

            // 添加分类关联
            await client.query(`
              INSERT INTO rss_category (rss_id, category_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
            `, [rssId, categoryId]);

            totalImported++;
            console.log(`  + ${source.name}`);
          }
        } catch (err) {
          console.error(`  ✗ 导入失败: ${source.name} - ${err.message}`);
        }
      }

      console.log(`\n[${categoryName}] 导入完成\n`);
    }

    await client.query('COMMIT');

    console.log('========================================');
    console.log(`导入完成!`);
    console.log(`新增: ${totalImported} 个RSS源`);
    console.log(`跳过(已存在): ${totalSkipped} 个RSS源`);
    console.log('========================================');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('导入失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importRss().catch(console.error);
