const pool = require('../config/database');

async function seedTemplates() {
  const client = await pool.connect();

  try {
    console.log('Seeding email templates...');

    await client.query('BEGIN');

    // 检查是否已有模板
    const existing = await client.query('SELECT COUNT(*) FROM email_templates');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log('Templates already exist, skipping seed.');
      await client.query('ROLLBACK');
      return;
    }

    // 默认单篇推送模板
    await client.query(`
      INSERT INTO email_templates (
        name, type, subject, header_bg_color, header_bg_color_end,
        header_title, header_subtitle, show_source, show_date,
        show_description, description_length, button_text, button_color,
        footer_text, is_default
      ) VALUES (
        '默认单篇模板', 'single', '[RSS更新] {title}',
        '#667eea', '#764ba2',
        'RSS 订阅更新', '',
        true, true, true, 200,
        '阅读原文', '#667eea',
        '此邮件由 RSS Monitor 自动发送\n如需退订，请登录系统管理订阅设置',
        true
      )
    `);

    // 默认汇总推送模板
    await client.query(`
      INSERT INTO email_templates (
        name, type, subject, header_bg_color, header_bg_color_end,
        header_title, header_subtitle, show_source, show_date,
        show_description, description_length, button_text, button_color,
        footer_text, is_default
      ) VALUES (
        '默认汇总模板', 'digest', '[RSS摘要] {count}篇新文章 - {date}',
        '#667eea', '#764ba2',
        'RSS 每日摘要', '',
        true, true, true, 200,
        '阅读原文', '#667eea',
        '此邮件由 RSS Monitor 自动发送\n如需退订，请登录系统管理订阅设置',
        true
      )
    `);

    // 简洁风格单篇模板
    await client.query(`
      INSERT INTO email_templates (
        name, type, subject, header_bg_color, header_bg_color_end,
        header_title, header_subtitle, show_source, show_date,
        show_description, description_length, button_text, button_color,
        footer_text, is_default
      ) VALUES (
        '简洁单篇模板', 'single', '{title}',
        '#2c3e50', '#3498db',
        '新文章推送', '',
        false, true, false, 100,
        '查看详情', '#3498db',
        'RSS Monitor',
        false
      )
    `);

    // 科技风格汇总模板
    await client.query(`
      INSERT INTO email_templates (
        name, type, subject, header_bg_color, header_bg_color_end,
        header_title, header_subtitle, show_source, show_date,
        show_description, description_length, button_text, button_color,
        footer_text, is_default
      ) VALUES (
        '科技风格汇总', 'digest', '📰 今日资讯 - {count}篇精选',
        '#0f2027', '#2c5364',
        '科技资讯速递', '',
        true, true, true, 150,
        '立即阅读', '#00d2ff',
        '感谢订阅 RSS Monitor\n每日为您精选优质内容',
        false
      )
    `);

    await client.query('COMMIT');
    console.log('Email templates seeded successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedTemplates().catch(console.error);
