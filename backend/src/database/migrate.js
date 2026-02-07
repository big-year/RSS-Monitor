const pool = require('../config/database');

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('Starting database migration...');

    await client.query('BEGIN');

    // 创建板块表
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        icon VARCHAR(100),
        color VARCHAR(50) DEFAULT '#409EFF',
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created categories table');

    // 创建RSS源表
    await client.query(`
      CREATE TABLE IF NOT EXISTS rss_sources (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        rss_url VARCHAR(500) NOT NULL UNIQUE,
        site_url VARCHAR(500),
        description TEXT,
        update_interval INT DEFAULT 15,
        is_active BOOLEAN DEFAULT TRUE,
        last_fetch_time TIMESTAMP,
        last_update_time TIMESTAMP,
        error_count INT DEFAULT 0,
        last_error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created rss_sources table');

    // 创建RSS源-板块关联表
    await client.query(`
      CREATE TABLE IF NOT EXISTS rss_category (
        id SERIAL PRIMARY KEY,
        rss_id INT NOT NULL REFERENCES rss_sources(id) ON DELETE CASCADE,
        category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        UNIQUE(rss_id, category_id)
      )
    `);
    console.log('Created rss_category table');

    // 创建文章表
    await client.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        rss_id INT NOT NULL REFERENCES rss_sources(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        link VARCHAR(1000) NOT NULL,
        description TEXT,
        content TEXT,
        author VARCHAR(255),
        pub_date TIMESTAMP,
        guid VARCHAR(500),
        is_read BOOLEAN DEFAULT FALSE,
        is_pushed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created articles table');

    // 创建文章索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON articles(pub_date DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_articles_rss_id ON articles(rss_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_articles_guid ON articles(guid)
    `);
    console.log('Created articles indexes');

    // 创建SMTP配置表
    await client.query(`
      CREATE TABLE IF NOT EXISTS smtp_config (
        id SERIAL PRIMARY KEY,
        host VARCHAR(255) NOT NULL,
        port INT NOT NULL,
        encryption VARCHAR(10) DEFAULT 'SSL',
        username VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        sender_name VARCHAR(255),
        sender_email VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created smtp_config table');

    // 创建订阅者表
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255),
        push_frequency VARCHAR(20) DEFAULT 'realtime',
        is_active BOOLEAN DEFAULT TRUE,
        last_push_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created subscribers table');

    // 创建订阅者-板块关联表
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriber_category (
        id SERIAL PRIMARY KEY,
        subscriber_id INT NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
        category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        UNIQUE(subscriber_id, category_id)
      )
    `);
    console.log('Created subscriber_category table');

    // 创建推送日志表
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_logs (
        id SERIAL PRIMARY KEY,
        subscriber_id INT REFERENCES subscribers(id) ON DELETE SET NULL,
        article_id INT REFERENCES articles(id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created push_logs table');

    // 创建管理员表
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);
    console.log('Created admins table');

    // 创建邮件模板表
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'digest',
        subject VARCHAR(255) NOT NULL,
        header_bg_color VARCHAR(50) DEFAULT '#667eea',
        header_bg_color_end VARCHAR(50) DEFAULT '#764ba2',
        header_title VARCHAR(255) DEFAULT 'RSS 订阅更新',
        header_subtitle VARCHAR(255),
        show_source BOOLEAN DEFAULT TRUE,
        show_date BOOLEAN DEFAULT TRUE,
        show_description BOOLEAN DEFAULT TRUE,
        description_length INT DEFAULT 200,
        button_text VARCHAR(50) DEFAULT '阅读原文',
        button_color VARCHAR(50) DEFAULT '#667eea',
        footer_text TEXT DEFAULT '此邮件由 RSS Monitor 自动发送',
        custom_css TEXT,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created email_templates table');

    await client.query('COMMIT');
    console.log('Database migration completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
