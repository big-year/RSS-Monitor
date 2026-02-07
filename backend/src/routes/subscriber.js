const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const emailService = require('../services/emailService');

// 获取所有订阅者
router.get('/', async (req, res) => {
  try {
    const { is_active, search } = req.query;

    let query = `
      SELECT s.*,
        COALESCE(
          json_agg(
            json_build_object('id', c.id, 'name', c.name, 'color', c.color)
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as categories,
        (SELECT COUNT(*) FROM push_logs WHERE subscriber_id = s.id AND status = 'success') as push_count
      FROM subscribers s
      LEFT JOIN subscriber_category sc ON s.id = sc.subscriber_id
      LEFT JOIN categories c ON sc.category_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (is_active !== undefined && is_active !== '') {
      query += ` AND s.is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    if (search) {
      query += ` AND (s.email ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` GROUP BY s.id ORDER BY s.created_at DESC`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ success: false, message: '获取订阅者失败' });
  }
});

// 获取单个订阅者
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT s.*,
        COALESCE(
          json_agg(
            json_build_object('id', c.id, 'name', c.name, 'color', c.color)
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as categories
      FROM subscribers s
      LEFT JOIN subscriber_category sc ON s.id = sc.subscriber_id
      LEFT JOIN categories c ON sc.category_id = c.id
      WHERE s.id = $1
      GROUP BY s.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '订阅者不存在' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching subscriber:', error);
    res.status(500).json({ success: false, message: '获取订阅者失败' });
  }
});

// 添加订阅者
router.post('/', [
  body('email').isEmail().withMessage('请输入有效的邮箱地址'),
  body('push_frequency').optional().isIn(['realtime', 'hourly', 'daily']).withMessage('推送频率无效')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const client = await pool.connect();
  try {
    const { email, name, push_frequency, category_ids } = req.body;

    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO subscribers (email, name, push_frequency)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [email, name || null, push_frequency || 'realtime']);

    const subscriber = result.rows[0];

    // 关联板块
    if (category_ids && category_ids.length > 0) {
      for (const categoryId of category_ids) {
        await client.query(`
          INSERT INTO subscriber_category (subscriber_id, category_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [subscriber.id, categoryId]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: subscriber, message: '订阅者添加成功' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating subscriber:', error);
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: '该邮箱已订阅' });
    }
    res.status(500).json({ success: false, message: '添加订阅者失败' });
  } finally {
    client.release();
  }
});

// 更新订阅者
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { email, name, push_frequency, is_active, category_ids } = req.body;

    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE subscribers
      SET email = COALESCE($1, email),
          name = COALESCE($2, name),
          push_frequency = COALESCE($3, push_frequency),
          is_active = COALESCE($4, is_active)
      WHERE id = $5
      RETURNING *
    `, [email, name, push_frequency, is_active, id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: '订阅者不存在' });
    }

    // 更新板块关联
    if (category_ids !== undefined) {
      await client.query('DELETE FROM subscriber_category WHERE subscriber_id = $1', [id]);
      for (const categoryId of category_ids) {
        await client.query(`
          INSERT INTO subscriber_category (subscriber_id, category_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [id, categoryId]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0], message: '订阅者更新成功' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating subscriber:', error);
    res.status(500).json({ success: false, message: '更新订阅者失败' });
  } finally {
    client.release();
  }
});

// 删除订阅者
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM subscribers WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '订阅者不存在' });
    }

    res.json({ success: true, message: '订阅者删除成功' });
  } catch (error) {
    console.error('Error deleting subscriber:', error);
    res.status(500).json({ success: false, message: '删除订阅者失败' });
  }
});

// 批量启用/禁用订阅者
router.post('/batch/toggle', async (req, res) => {
  try {
    const { ids, is_active } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要操作的订阅者' });
    }

    await pool.query(`
      UPDATE subscribers SET is_active = $1 WHERE id = ANY($2)
    `, [is_active, ids]);

    res.json({ success: true, message: `已${is_active ? '启用' : '禁用'} ${ids.length} 个订阅者` });
  } catch (error) {
    console.error('Error batch toggling subscribers:', error);
    res.status(500).json({ success: false, message: '批量操作失败' });
  }
});

// 手动推送测试
router.post('/push-test', async (req, res) => {
  try {
    const { subscriber_id, type, article_ids } = req.body;

    if (!subscriber_id || !article_ids || article_ids.length === 0) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }

    // 获取订阅者信息
    const subscriberResult = await pool.query('SELECT * FROM subscribers WHERE id = $1', [subscriber_id]);
    if (subscriberResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '订阅者不存在' });
    }
    const subscriber = subscriberResult.rows[0];

    // 获取文章信息
    const articlesResult = await pool.query(`
      SELECT a.*, rs.name as source_name
      FROM articles a
      JOIN rss_sources rs ON a.rss_id = rs.id
      WHERE a.id = ANY($1)
      ORDER BY a.pub_date DESC
    `, [article_ids]);

    if (articlesResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '文章不存在' });
    }

    const articles = articlesResult.rows;

    if (type === 'single') {
      // 单篇推送 - 只推送第一篇
      const article = articles[0];
      const source = { name: article.source_name };
      await emailService.sendArticleEmail(subscriber, article, source);
    } else {
      // 汇总推送
      await emailService.sendDigestEmail(subscriber, articles);
    }

    // 更新最后推送时间
    await pool.query('UPDATE subscribers SET last_push_time = CURRENT_TIMESTAMP WHERE id = $1', [subscriber_id]);

    res.json({ success: true, message: '推送成功' });
  } catch (error) {
    console.error('Error sending test push:', error);
    res.status(500).json({ success: false, message: '推送失败: ' + error.message });
  }
});

// 一键推送（模拟定时推送）
router.post('/push-scheduled', async (req, res) => {
  try {
    const { subscriber_id, frequency } = req.body;

    if (!subscriber_id) {
      return res.status(400).json({ success: false, message: '请指定订阅者' });
    }

    // 获取订阅者信息及其订阅的板块
    const subscriberResult = await pool.query(`
      SELECT s.*,
        array_agg(sc.category_id) as category_ids
      FROM subscribers s
      JOIN subscriber_category sc ON s.id = sc.subscriber_id
      WHERE s.id = $1
      GROUP BY s.id
    `, [subscriber_id]);

    if (subscriberResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '订阅者不存在或未订阅任何板块' });
    }

    const subscriber = subscriberResult.rows[0];
    const pushFrequency = frequency || subscriber.push_frequency;

    // 获取系统设置
    const settingsResult = await pool.query(`
      SELECT key, value FROM system_settings WHERE key IN ('ai_score_threshold', 'max_articles_per_push', 'ai_scoring_enabled')
    `);
    const settings = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = row.value;
    });

    const aiScoringEnabled = settings.ai_scoring_enabled === 'true';
    const scoreThreshold = parseInt(settings.ai_score_threshold) || 60;
    const maxArticles = parseInt(settings.max_articles_per_push) || 20;

    // 获取上次推送后的新文章（与定时推送逻辑一致）
    const lastPushTime = subscriber.last_push_time || new Date(0);

    let articleQuery = `
      SELECT a.*, rs.name as source_name
      FROM articles a
      JOIN rss_sources rs ON a.rss_id = rs.id
      JOIN rss_category rc ON rs.id = rc.rss_id
      WHERE rc.category_id = ANY($1)
      AND a.created_at > $2
      AND a.is_pushed = false
    `;

    // 如果启用了AI评分则过滤低分文章
    if (aiScoringEnabled) {
      articleQuery += ` AND (a.ai_score IS NULL OR a.ai_score >= ${scoreThreshold})`;
    }

    articleQuery += ` ORDER BY a.pub_date DESC LIMIT $3`;

    const articleResult = await pool.query(articleQuery, [
      subscriber.category_ids,
      lastPushTime,
      maxArticles
    ]);

    const articles = articleResult.rows;

    if (articles.length === 0) {
      return res.json({
        success: true,
        message: '没有待推送的文章',
        data: { articleCount: 0 }
      });
    }

    // 根据推送频率决定推送方式
    if (pushFrequency === 'realtime') {
      // 实时推送：逐篇发送
      for (const article of articles) {
        const source = { name: article.source_name };
        await emailService.sendArticleEmail(subscriber, article, source);
      }
    } else {
      // 汇总推送
      await emailService.sendDigestEmail(subscriber, articles);
    }

    // 更新订阅者的最后推送时间
    await pool.query(`
      UPDATE subscribers SET last_push_time = CURRENT_TIMESTAMP WHERE id = $1
    `, [subscriber_id]);

    // 标记文章为已推送
    const articleIds = articles.map(a => a.id);
    await pool.query(`
      UPDATE articles SET is_pushed = true WHERE id = ANY($1)
    `, [articleIds]);

    res.json({
      success: true,
      message: `推送成功，共 ${articles.length} 篇文章`,
      data: {
        articleCount: articles.length,
        articles: articles.map(a => ({ id: a.id, title: a.title, score: a.ai_score }))
      }
    });
  } catch (error) {
    console.error('Error in scheduled push:', error);
    res.status(500).json({ success: false, message: '推送失败: ' + error.message });
  }
});

// 预览待推送内容（不实际发送）
router.post('/push-preview', async (req, res) => {
  try {
    const { subscriber_id } = req.body;

    if (!subscriber_id) {
      return res.status(400).json({ success: false, message: '请指定订阅者' });
    }

    // 获取订阅者信息及其订阅的板块
    const subscriberResult = await pool.query(`
      SELECT s.*,
        array_agg(sc.category_id) as category_ids
      FROM subscribers s
      JOIN subscriber_category sc ON s.id = sc.subscriber_id
      WHERE s.id = $1
      GROUP BY s.id
    `, [subscriber_id]);

    if (subscriberResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '订阅者不存在或未订阅任何板块' });
    }

    const subscriber = subscriberResult.rows[0];

    // 获取系统设置
    const settingsResult = await pool.query(`
      SELECT key, value FROM system_settings WHERE key IN ('ai_score_threshold', 'max_articles_per_push', 'ai_scoring_enabled')
    `);
    const settings = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = row.value;
    });

    const aiScoringEnabled = settings.ai_scoring_enabled === 'true';
    const scoreThreshold = parseInt(settings.ai_score_threshold) || 60;
    const maxArticles = parseInt(settings.max_articles_per_push) || 20;

    const lastPushTime = subscriber.last_push_time || new Date(0);

    let articleQuery = `
      SELECT a.id, a.title, a.pub_date, a.ai_score, rs.name as source_name
      FROM articles a
      JOIN rss_sources rs ON a.rss_id = rs.id
      JOIN rss_category rc ON rs.id = rc.rss_id
      WHERE rc.category_id = ANY($1)
      AND a.created_at > $2
      AND a.is_pushed = false
    `;

    if (aiScoringEnabled) {
      articleQuery += ` AND (a.ai_score IS NULL OR a.ai_score >= ${scoreThreshold})`;
    }

    articleQuery += ` ORDER BY a.pub_date DESC LIMIT $3`;

    const articleResult = await pool.query(articleQuery, [
      subscriber.category_ids,
      lastPushTime,
      maxArticles
    ]);

    res.json({
      success: true,
      data: {
        subscriber: {
          id: subscriber.id,
          email: subscriber.email,
          push_frequency: subscriber.push_frequency,
          last_push_time: subscriber.last_push_time
        },
        settings: {
          ai_scoring_enabled: aiScoringEnabled,
          score_threshold: scoreThreshold,
          max_articles: maxArticles
        },
        articles: articleResult.rows,
        total: articleResult.rows.length
      }
    });
  } catch (error) {
    console.error('Error in push preview:', error);
    res.status(500).json({ success: false, message: '预览失败: ' + error.message });
  }
});

module.exports = router;
