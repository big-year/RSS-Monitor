const nodemailer = require('nodemailer');
const pool = require('../config/database');

class EmailService {
  constructor() {
    this.transporter = null;
  }

  async getTransporter() {
    // 获取SMTP配置
    const result = await pool.query(`
      SELECT * FROM smtp_config WHERE is_active = true LIMIT 1
    `);

    if (result.rows.length === 0) {
      throw new Error('SMTP未配置');
    }

    const config = result.rows[0];

    const transportConfig = {
      host: config.host,
      port: config.port,
      secure: config.encryption === 'SSL',
      auth: {
        user: config.username,
        pass: config.password
      }
    };

    if (config.encryption === 'TLS') {
      transportConfig.secure = false;
      transportConfig.requireTLS = true;
    }

    return {
      transporter: nodemailer.createTransport(transportConfig),
      config
    };
  }

  async getTemplate(type) {
    // 获取默认模板
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

    return result.rows[0] || null;
  }

  async sendArticleEmail(subscriber, article, source) {
    try {
      const { transporter, config } = await this.getTransporter();
      const template = await this.getTemplate('single');

      const html = this.generateArticleHtml(article, source, template);
      const subject = this.parseSubject(template?.subject || '[RSS更新] {title}', {
        title: article.title,
        source: source.name,
        date: new Date().toLocaleDateString('zh-CN')
      });

      await transporter.sendMail({
        from: `"${config.sender_name || 'RSS Monitor'}" <${config.sender_email || config.username}>`,
        to: subscriber.email,
        subject,
        html
      });

      // 记录推送日志
      await pool.query(`
        INSERT INTO push_logs (subscriber_id, article_id, status)
        VALUES ($1, $2, 'success')
      `, [subscriber.id, article.id]);

      console.log(`Email sent to ${subscriber.email}: ${article.title}`);
    } catch (error) {
      console.error(`Error sending email to ${subscriber.email}:`, error.message);

      // 记录失败日志
      await pool.query(`
        INSERT INTO push_logs (subscriber_id, article_id, status, error_message)
        VALUES ($1, $2, 'failed', $3)
      `, [subscriber.id, article.id, error.message]);
    }
  }

  async sendDigestEmail(subscriber, articles) {
    try {
      const { transporter, config } = await this.getTransporter();
      const template = await this.getTemplate('digest');

      const html = this.generateDigestHtml(articles, template);
      const subject = this.parseSubject(template?.subject || '[RSS摘要] {count}篇新文章 - {date}', {
        count: articles.length,
        date: new Date().toLocaleDateString('zh-CN')
      });

      await transporter.sendMail({
        from: `"${config.sender_name || 'RSS Monitor'}" <${config.sender_email || config.username}>`,
        to: subscriber.email,
        subject,
        html
      });

      // 记录推送日志
      await pool.query(`
        INSERT INTO push_logs (subscriber_id, status)
        VALUES ($1, 'success')
      `, [subscriber.id]);

      console.log(`Digest email sent to ${subscriber.email}: ${articles.length} articles`);
    } catch (error) {
      console.error(`Error sending digest email to ${subscriber.email}:`, error.message);

      await pool.query(`
        INSERT INTO push_logs (subscriber_id, status, error_message)
        VALUES ($1, 'failed', $2)
      `, [subscriber.id, error.message]);
    }
  }

  parseSubject(template, vars) {
    let subject = template;
    for (const [key, value] of Object.entries(vars)) {
      subject = subject.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return subject;
  }

  generateArticleHtml(article, source, template) {
    const pubDate = new Date(article.pub_date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // 使用模板配置或默认值
    const t = template || {};
    const headerBgColor = t.header_bg_color || '#667eea';
    const headerBgColorEnd = t.header_bg_color_end || '#764ba2';
    const headerTitle = t.header_title || 'RSS 订阅更新';
    const showSource = t.show_source !== false;
    const showDate = t.show_date !== false;
    const showDescription = t.show_description !== false;
    const descriptionLength = t.description_length || 200;
    const buttonText = t.button_text || '阅读原文';
    const buttonColor = t.button_color || headerBgColor;
    const footerText = t.footer_text || '此邮件由 RSS Monitor 自动发送\n如需退订，请登录系统管理订阅设置';

    const gradientStyle = `linear-gradient(135deg, ${headerBgColor} 0%, ${headerBgColorEnd} 100%)`;
    const description = article.description ? article.description.substring(0, descriptionLength) : '暂无摘要内容，请点击下方按钮查看原文。';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f5f7; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
                <!-- Header -->
                <tr>
                  <td style="background: ${gradientStyle}; padding: 30px 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="display: inline-block; background: rgba(255,255,255,0.2); color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-bottom: 12px;">📰 ${this.escapeHtml(headerTitle)}</span>
                          <h1 style="margin: 12px 0 0 0; font-size: 22px; font-weight: 600; color: #ffffff; line-height: 1.4;">${this.escapeHtml(article.title)}</h1>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${showSource || showDate ? `
                <!-- Meta Info -->
                <tr>
                  <td style="padding: 20px 40px; background: #f8f9fa; border-bottom: 1px solid #eee;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #666; font-size: 14px;">
                          ${showSource ? `<span style="display: inline-block; margin-right: 20px;">📌 <strong>${this.escapeHtml(source.name)}</strong></span>` : ''}
                          ${showDate ? `<span style="display: inline-block; color: #999;">🕐 ${pubDate}</span>` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : ''}
                ${showDescription ? `
                <!-- Content -->
                <tr>
                  <td style="padding: 30px 40px;">
                    <div style="color: #444; font-size: 15px; line-height: 1.8;">
                      ${this.escapeHtml(description)}
                    </div>
                  </td>
                </tr>
                ` : ''}
                <!-- Button -->
                <tr>
                  <td style="padding: ${showDescription ? '0' : '30px'} 40px 40px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background: ${buttonColor}; border-radius: 8px;">
                          <a href="${article.link}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 500;">
                            ${this.escapeHtml(buttonText)} →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 40px; background: #f8f9fa; border-top: 1px solid #eee;">
                    <p style="margin: 0; font-size: 12px; color: #999; text-align: center;">
                      ${this.escapeHtml(footerText).replace(/\n/g, '<br>')}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        ${t.custom_css ? `<style>${t.custom_css}</style>` : ''}
      </body>
      </html>
    `;
  }

  generateDigestHtml(articles, template) {
    const today = new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // 使用模板配置或默认值
    const t = template || {};
    const headerBgColor = t.header_bg_color || '#667eea';
    const headerBgColorEnd = t.header_bg_color_end || '#764ba2';
    const headerTitle = t.header_title || 'RSS 每日摘要';
    const headerSubtitle = t.header_subtitle || `${today} · 共 ${articles.length} 篇新文章`;
    const showSource = t.show_source !== false;
    const showDate = t.show_date !== false;
    const showDescription = t.show_description !== false;
    const descriptionLength = t.description_length || 200;
    const footerText = t.footer_text || '此邮件由 RSS Monitor 自动发送\n如需退订，请登录系统管理订阅设置';

    const gradientStyle = `linear-gradient(135deg, ${headerBgColor} 0%, ${headerBgColorEnd} 100%)`;

    const articleList = articles.map((article, index) => {
      const pubDate = new Date(article.pub_date).toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const buttonText = t.button_text || '阅读原文';
      const buttonColor = t.button_color || headerBgColor;

      return `
        <tr>
          <td style="padding: 20px 0; border-bottom: 1px solid #eee;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" valign="top">
                  <span style="display: inline-block; width: 28px; height: 28px; background: ${gradientStyle}; color: #fff; border-radius: 50%; text-align: center; line-height: 28px; font-size: 12px; font-weight: 600;">${index + 1}</span>
                </td>
                <td>
                  <a href="${article.link}" target="_blank" style="display: block; font-size: 16px; font-weight: 600; color: #333; text-decoration: none; margin-bottom: 6px; line-height: 1.4;">
                    ${this.escapeHtml(article.title)}
                  </a>
                  ${showSource || showDate ? `
                  <div style="font-size: 12px; color: #999; margin-bottom: 8px;">
                    ${showSource ? `<span style="margin-right: 12px;">📌 ${this.escapeHtml(article.source_name)}</span>` : ''}
                    ${showDate ? `<span>🕐 ${pubDate}</span>` : ''}
                  </div>
                  ` : ''}
                  ${showDescription ? `
                  <p style="margin: 0 0 12px 0; font-size: 14px; color: #666; line-height: 1.6;">
                    ${this.escapeHtml(article.description ? article.description.substring(0, descriptionLength) + '...' : '暂无摘要')}
                  </p>
                  ` : ''}
                  <a href="${article.link}" target="_blank" style="display: inline-block; padding: 6px 16px; background: ${buttonColor}; color: #fff; text-decoration: none; font-size: 13px; border-radius: 4px;">
                    ${this.escapeHtml(buttonText)} →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f5f7; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
                <!-- Header -->
                <tr>
                  <td style="background: ${gradientStyle}; padding: 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #ffffff;">📬 ${this.escapeHtml(headerTitle)}</h1>
                          <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.85);">${this.escapeHtml(headerSubtitle)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Article List -->
                <tr>
                  <td style="padding: 20px 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${articleList}
                    </table>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding: 25px 40px; background: #f8f9fa; border-top: 1px solid #eee;">
                    <p style="margin: 0; font-size: 12px; color: #999; text-align: center;">
                      ${this.escapeHtml(footerText).replace(/\n/g, '<br>')}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        ${t.custom_css ? `<style>${t.custom_css}</style>` : ''}
      </body>
      </html>
    `;
  }

  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

module.exports = new EmailService();
