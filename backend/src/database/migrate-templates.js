const pool = require('../config/database');

async function migrateTemplates() {
  const client = await pool.connect();

  try {
    console.log('Creating email_templates table...');

    await client.query('BEGIN');

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
    console.log('Migration completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateTemplates().catch(console.error);
