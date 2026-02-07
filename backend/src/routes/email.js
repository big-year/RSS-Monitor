const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');

// 获取SMTP配置
router.get('/smtp', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, host, port, encryption, username, sender_name, sender_email, is_active, created_at, updated_at
      FROM smtp_config
      ORDER BY created_at DESC
      LIMIT 1
    `);

    res.json({
      success: true,
      data: result.rows[0] || null
    });
  } catch (error) {
    console.error('Error fetching SMTP config:', error);
    res.status(500).json({ success: false, message: '获取SMTP配置失败' });
  }
});

// 保存SMTP配置
router.post('/smtp', [
  body('host').notEmpty().withMessage('SMTP服务器地址不能为空'),
  body('port').isInt({ min: 1, max: 65535 }).withMessage('端口号无效'),
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { host, port, encryption, username, password, sender_name, sender_email } = req.body;

    // 检查是否已有配置
    const existing = await pool.query('SELECT id FROM smtp_config LIMIT 1');

    let result;
    if (existing.rows.length > 0) {
      // 更新现有配置
      result = await pool.query(`
        UPDATE smtp_config
        SET host = $1, port = $2, encryption = $3, username = $4, password = $5,
            sender_name = $6, sender_email = $7, updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
        RETURNING id, host, port, encryption, username, sender_name, sender_email, is_active
      `, [host, port, encryption || 'SSL', username, password, sender_name, sender_email || username, existing.rows[0].id]);
    } else {
      // 创建新配置
      result = await pool.query(`
        INSERT INTO smtp_config (host, port, encryption, username, password, sender_name, sender_email)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, host, port, encryption, username, sender_name, sender_email, is_active
      `, [host, port, encryption || 'SSL', username, password, sender_name, sender_email || username]);
    }

    res.json({ success: true, data: result.rows[0], message: 'SMTP配置保存成功' });
  } catch (error) {
    console.error('Error saving SMTP config:', error);
    res.status(500).json({ success: false, message: '保存SMTP配置失败' });
  }
});

// 测试SMTP连接
router.post('/smtp/test', async (req, res) => {
  try {
    const { host, port, encryption, username, password, test_email } = req.body;

    if (!test_email) {
      return res.status(400).json({ success: false, message: '请提供测试邮箱地址' });
    }

    const transportConfig = {
      host,
      port: parseInt(port),
      secure: encryption === 'SSL',
      auth: {
        user: username,
        pass: password
      }
    };

    if (encryption === 'TLS') {
      transportConfig.secure = false;
      transportConfig.requireTLS = true;
    }

    const transporter = nodemailer.createTransport(transportConfig);

    // 验证连接
    await transporter.verify();

    // 发送测试邮件
    await transporter.sendMail({
      from: `"RSS Monitor" <${username}>`,
      to: test_email,
      subject: 'RSS Monitor - 测试邮件',
      html: `
        <h2>测试邮件</h2>
        <p>如果您收到这封邮件，说明SMTP配置正确。</p>
        <p>发送时间: ${new Date().toLocaleString('zh-CN')}</p>
      `
    });

    res.json({ success: true, message: '测试邮件发送成功' });
  } catch (error) {
    console.error('Error testing SMTP:', error);
    res.status(400).json({ success: false, message: 'SMTP测试失败: ' + error.message });
  }
});

// 获取推送日志
router.get('/logs', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, subscriber_id } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT pl.*,
        s.email as subscriber_email,
        a.title as article_title
      FROM push_logs pl
      LEFT JOIN subscribers s ON pl.subscriber_id = s.id
      LEFT JOIN articles a ON pl.article_id = a.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND pl.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (subscriber_id) {
      query += ` AND pl.subscriber_id = $${paramIndex}`;
      params.push(subscriber_id);
      paramIndex++;
    }

    // 获取总数
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM push_logs pl WHERE 1=1 ${status ? 'AND pl.status = $1' : ''} ${subscriber_id ? `AND pl.subscriber_id = $${status ? 2 : 1}` : ''}`,
      params.slice(0, paramIndex - 1)
    );

    query += ` ORDER BY pl.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching push logs:', error);
    res.status(500).json({ success: false, message: '获取推送日志失败' });
  }
});

// 获取推送统计
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'success') as success_count,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as today_count,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours' AND status = 'success') as today_success
      FROM push_logs
    `);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching push stats:', error);
    res.status(500).json({ success: false, message: '获取推送统计失败' });
  }
});

module.exports = router;
