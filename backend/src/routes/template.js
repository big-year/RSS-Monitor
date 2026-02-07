const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');

// 获取所有模板
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM email_templates ORDER BY is_default DESC, created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, message: '获取模板失败' });
  }
});

// 获取单个模板
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM email_templates WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ success: false, message: '获取模板失败' });
  }
});

// 获取默认模板
router.get('/default/:type', async (req, res) => {
  try {
    const { type } = req.params;
    let result = await pool.query(
      'SELECT * FROM email_templates WHERE type = $1 AND is_default = true LIMIT 1',
      [type]
    );

    // 如果没有默认模板，返回该类型的第一个模板
    if (result.rows.length === 0) {
      result = await pool.query(
        'SELECT * FROM email_templates WHERE type = $1 ORDER BY created_at LIMIT 1',
        [type]
      );
    }

    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    console.error('Error fetching default template:', error);
    res.status(500).json({ success: false, message: '获取默认模板失败' });
  }
});

// 创建模板
router.post('/', [
  body('name').notEmpty().withMessage('模板名称不能为空'),
  body('type').isIn(['single', 'digest']).withMessage('模板类型无效'),
  body('subject').notEmpty().withMessage('邮件主题不能为空')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const {
      name, type, subject, header_bg_color, header_bg_color_end,
      header_title, header_subtitle, show_source, show_date,
      show_description, description_length, button_text, button_color,
      footer_text, custom_css, is_default
    } = req.body;

    // 如果设为默认，先取消其他同类型的默认
    if (is_default) {
      await pool.query(
        'UPDATE email_templates SET is_default = false WHERE type = $1',
        [type]
      );
    }

    const result = await pool.query(`
      INSERT INTO email_templates (
        name, type, subject, header_bg_color, header_bg_color_end,
        header_title, header_subtitle, show_source, show_date,
        show_description, description_length, button_text, button_color,
        footer_text, custom_css, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      name, type, subject,
      header_bg_color || '#667eea',
      header_bg_color_end || '#764ba2',
      header_title || 'RSS 订阅更新',
      header_subtitle || '',
      show_source !== false,
      show_date !== false,
      show_description !== false,
      description_length || 200,
      button_text || '阅读原文',
      button_color || '#667eea',
      footer_text || '此邮件由 RSS Monitor 自动发送',
      custom_css || '',
      is_default || false
    ]);

    res.status(201).json({ success: true, data: result.rows[0], message: '模板创建成功' });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ success: false, message: '创建模板失败' });
  }
});

// 更新模板
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, type, subject, header_bg_color, header_bg_color_end,
      header_title, header_subtitle, show_source, show_date,
      show_description, description_length, button_text, button_color,
      footer_text, custom_css, is_default
    } = req.body;

    // 如果设为默认，先取消其他同类型的默认
    if (is_default) {
      const currentTemplate = await pool.query('SELECT type FROM email_templates WHERE id = $1', [id]);
      if (currentTemplate.rows.length > 0) {
        await pool.query(
          'UPDATE email_templates SET is_default = false WHERE type = $1 AND id != $2',
          [type || currentTemplate.rows[0].type, id]
        );
      }
    }

    const result = await pool.query(`
      UPDATE email_templates SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        subject = COALESCE($3, subject),
        header_bg_color = COALESCE($4, header_bg_color),
        header_bg_color_end = COALESCE($5, header_bg_color_end),
        header_title = COALESCE($6, header_title),
        header_subtitle = COALESCE($7, header_subtitle),
        show_source = COALESCE($8, show_source),
        show_date = COALESCE($9, show_date),
        show_description = COALESCE($10, show_description),
        description_length = COALESCE($11, description_length),
        button_text = COALESCE($12, button_text),
        button_color = COALESCE($13, button_color),
        footer_text = COALESCE($14, footer_text),
        custom_css = COALESCE($15, custom_css),
        is_default = COALESCE($16, is_default),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $17
      RETURNING *
    `, [
      name, type, subject, header_bg_color, header_bg_color_end,
      header_title, header_subtitle, show_source, show_date,
      show_description, description_length, button_text, button_color,
      footer_text, custom_css, is_default, id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }

    res.json({ success: true, data: result.rows[0], message: '模板更新成功' });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ success: false, message: '更新模板失败' });
  }
});

// 删除模板
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM email_templates WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }

    res.json({ success: true, message: '模板删除成功' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ success: false, message: '删除模板失败' });
  }
});

// 预览模板
router.post('/preview', async (req, res) => {
  try {
    const template = req.body;

    // 生成示例数据
    const sampleArticles = [
      {
        title: '示例文章标题 - 这是一篇测试文章',
        link: 'https://example.com/article1',
        description: '这是文章的摘要内容，用于展示模板效果。RSS Monitor 是一个功能强大的 RSS 订阅管理和推送系统。',
        source_name: '示例来源',
        pub_date: new Date().toISOString()
      },
      {
        title: '第二篇示例文章 - 展示多篇文章效果',
        link: 'https://example.com/article2',
        description: '这是第二篇文章的摘要，用于展示汇总模式下多篇文章的显示效果。',
        source_name: '另一个来源',
        pub_date: new Date(Date.now() - 3600000).toISOString()
      },
      {
        title: '第三篇示例文章',
        link: 'https://example.com/article3',
        description: '第三篇文章的摘要内容。',
        source_name: '示例来源',
        pub_date: new Date(Date.now() - 7200000).toISOString()
      }
    ];

    const html = generatePreviewHtml(template, sampleArticles);
    res.json({ success: true, data: { html } });
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({ success: false, message: '生成预览失败' });
  }
});

// 生成预览HTML
function generatePreviewHtml(template, articles) {
  const escapeHtml = (text) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const gradientStyle = `linear-gradient(135deg, ${template.header_bg_color || '#667eea'} 0%, ${template.header_bg_color_end || '#764ba2'} 100%)`;

  if (template.type === 'single') {
    const article = articles[0];
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f5f7; padding: 40px 20px;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              <tr><td style="background: ${gradientStyle}; padding: 30px 40px;">
                <span style="display: inline-block; background: rgba(255,255,255,0.2); color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-bottom: 12px;">📰 ${escapeHtml(template.header_title || 'RSS 更新')}</span>
                <h1 style="margin: 12px 0 0 0; font-size: 22px; font-weight: 600; color: #ffffff; line-height: 1.4;">${escapeHtml(article.title)}</h1>
              </td></tr>
              ${template.show_source || template.show_date ? `
              <tr><td style="padding: 20px 40px; background: #f8f9fa; border-bottom: 1px solid #eee;">
                <span style="color: #666; font-size: 14px;">
                  ${template.show_source ? `<span style="margin-right: 20px;">📌 <strong>${escapeHtml(article.source_name)}</strong></span>` : ''}
                  ${template.show_date ? `<span style="color: #999;">🕐 ${formatDate(article.pub_date)}</span>` : ''}
                </span>
              </td></tr>` : ''}
              ${template.show_description ? `
              <tr><td style="padding: 30px 40px;">
                <div style="color: #444; font-size: 15px; line-height: 1.8;">${escapeHtml(article.description?.substring(0, template.description_length || 200) || '暂无摘要')}</div>
              </td></tr>` : ''}
              <tr><td style="padding: 0 40px 40px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background: ${template.button_color || gradientStyle}; border-radius: 8px;">
                    <a href="${article.link}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 500;">${escapeHtml(template.button_text || '阅读原文')} →</a>
                  </td>
                </tr></table>
              </td></tr>
              <tr><td style="padding: 20px 40px; background: #f8f9fa; border-top: 1px solid #eee;">
                <p style="margin: 0; font-size: 12px; color: #999; text-align: center;">${escapeHtml(template.footer_text || '此邮件由 RSS Monitor 自动发送')}</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
        ${template.custom_css ? `<style>${template.custom_css}</style>` : ''}
      </body>
      </html>
    `;
  } else {
    // 汇总模式
    const buttonText = template.button_text || '阅读原文';
    const buttonColor = template.button_color || template.header_bg_color || '#667eea';

    const articleList = articles.map((article, index) => `
      <tr><td style="padding: 20px 0; border-bottom: 1px solid #eee;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="40" valign="top">
            <span style="display: inline-block; width: 28px; height: 28px; background: ${gradientStyle}; color: #fff; border-radius: 50%; text-align: center; line-height: 28px; font-size: 12px; font-weight: 600;">${index + 1}</span>
          </td>
          <td>
            <a href="${article.link}" style="display: block; font-size: 16px; font-weight: 600; color: #333; text-decoration: none; margin-bottom: 6px; line-height: 1.4;">${escapeHtml(article.title)}</a>
            <div style="font-size: 12px; color: #999; margin-bottom: 8px;">
              ${template.show_source ? `<span style="margin-right: 12px;">📌 ${escapeHtml(article.source_name)}</span>` : ''}
              ${template.show_date ? `<span>🕐 ${formatDate(article.pub_date)}</span>` : ''}
            </div>
            ${template.show_description ? `<p style="margin: 0 0 12px 0; font-size: 14px; color: #666; line-height: 1.6;">${escapeHtml(article.description?.substring(0, template.description_length || 200) || '暂无摘要')}...</p>` : ''}
            <a href="${article.link}" style="display: inline-block; padding: 6px 16px; background: ${buttonColor}; color: #fff; text-decoration: none; font-size: 13px; border-radius: 4px;">${escapeHtml(buttonText)} →</a>
          </td>
        </tr></table>
      </td></tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f5f7; padding: 40px 20px;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              <tr><td style="background: ${gradientStyle}; padding: 40px;">
                <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #ffffff;">📬 ${escapeHtml(template.header_title || 'RSS 每日摘要')}</h1>
                <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.85);">${template.header_subtitle || today + ' · 共 ' + articles.length + ' 篇新文章'}</p>
              </td></tr>
              <tr><td style="padding: 20px 40px;">
                <table width="100%" cellpadding="0" cellspacing="0">${articleList}</table>
              </td></tr>
              <tr><td style="padding: 25px 40px; background: #f8f9fa; border-top: 1px solid #eee;">
                <p style="margin: 0; font-size: 12px; color: #999; text-align: center;">${escapeHtml(template.footer_text || '此邮件由 RSS Monitor 自动发送')}</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
        ${template.custom_css ? `<style>${template.custom_css}</style>` : ''}
      </body>
      </html>
    `;
  }
}

module.exports = router;
