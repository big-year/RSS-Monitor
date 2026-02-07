const pool = require('../config/database');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();

  try {
    console.log('Starting database seeding...');

    await client.query('BEGIN');

    // 创建默认管理员账户
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO admins (username, password, email)
      VALUES ('admin', $1, 'admin@example.com')
      ON CONFLICT (username) DO NOTHING
    `, [hashedPassword]);
    console.log('Created default admin user (username: admin, password: admin123)');

    // 创建默认板块
    const categories = [
      { name: '科技', description: '科技新闻和技术资讯', icon: 'Monitor', color: '#409EFF' },
      { name: '财经', description: '财经新闻和市场动态', icon: 'TrendCharts', color: '#67C23A' },
      { name: '政治', description: '政治新闻和时事评论', icon: 'Document', color: '#E6A23C' },
      { name: '娱乐', description: '娱乐新闻和明星八卦', icon: 'VideoCamera', color: '#F56C6C' },
      { name: '体育', description: '体育新闻和赛事报道', icon: 'Trophy', color: '#909399' },
    ];

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      await client.query(`
        INSERT INTO categories (name, description, icon, color, sort_order)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (name) DO NOTHING
      `, [cat.name, cat.description, cat.icon, cat.color, i]);
    }
    console.log('Created default categories');

    // 添加一些示例RSS源
    const rssSources = [
      {
        name: '36氪',
        rss_url: 'https://36kr.com/feed',
        site_url: 'https://36kr.com',
        description: '36氪 - 让创业更简单',
        category: '科技'
      },
      {
        name: 'Hacker News',
        rss_url: 'https://hnrss.org/frontpage',
        site_url: 'https://news.ycombinator.com',
        description: 'Hacker News RSS Feed',
        category: '科技'
      },
      {
        name: 'BBC News',
        rss_url: 'http://feeds.bbci.co.uk/news/rss.xml',
        site_url: 'https://www.bbc.com/news',
        description: 'BBC News - World',
        category: '政治'
      }
    ];

    for (const source of rssSources) {
      const result = await client.query(`
        INSERT INTO rss_sources (name, rss_url, site_url, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (rss_url) DO NOTHING
        RETURNING id
      `, [source.name, source.rss_url, source.site_url, source.description]);

      if (result.rows.length > 0) {
        const rssId = result.rows[0].id;
        const catResult = await client.query(
          'SELECT id FROM categories WHERE name = $1',
          [source.category]
        );
        if (catResult.rows.length > 0) {
          await client.query(`
            INSERT INTO rss_category (rss_id, category_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [rssId, catResult.rows[0].id]);
        }
      }
    }
    console.log('Created sample RSS sources');

    await client.query('COMMIT');
    console.log('Database seeding completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
