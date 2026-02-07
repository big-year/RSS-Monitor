const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const Parser = require('rss-parser');
const { body, validationResult } = require('express-validator');

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'RSS Monitor/1.0'
  }
});

// 获取所有RSS源
router.get('/', async (req, res) => {
  try {
    const { category_id, is_active, search } = req.query;

    let query = `
      SELECT rs.*,
        COALESCE(
          json_agg(
            json_build_object('id', c.id, 'name', c.name, 'color', c.color)
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as categories,
        (SELECT COUNT(*) FROM articles WHERE rss_id = rs.id) as article_count
      FROM rss_sources rs
      LEFT JOIN rss_category rc ON rs.id = rc.rss_id
      LEFT JOIN categories c ON rc.category_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (category_id) {
      query += ` AND rs.id IN (SELECT rss_id FROM rss_category WHERE category_id = $${paramIndex})`;
      params.push(category_id);
      paramIndex++;
    }

    if (is_active !== undefined && is_active !== '') {
      query += ` AND rs.is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    if (search) {
      query += ` AND (rs.name ILIKE $${paramIndex} OR rs.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` GROUP BY rs.id ORDER BY rs.created_at DESC`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching RSS sources:', error);
    res.status(500).json({ success: false, message: '获取RSS源失败' });
  }
});

// 获取单个RSS源
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT rs.*,
        COALESCE(
          json_agg(
            json_build_object('id', c.id, 'name', c.name, 'color', c.color)
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as categories
      FROM rss_sources rs
      LEFT JOIN rss_category rc ON rs.id = rc.rss_id
      LEFT JOIN categories c ON rc.category_id = c.id
      WHERE rs.id = $1
      GROUP BY rs.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'RSS源不存在' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching RSS source:', error);
    res.status(500).json({ success: false, message: '获取RSS源失败' });
  }
});

// 添加RSS源
router.post('/', [
  body('name').notEmpty().withMessage('名称不能为空'),
  body('rss_url').isURL().withMessage('请输入有效的URL'),
  body('category_ids').optional().isArray()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const client = await pool.connect();
  try {
    const { name, rss_url, site_url, description, update_interval, category_ids } = req.body;

    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO rss_sources (name, rss_url, site_url, description, update_interval)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, rss_url, site_url || null, description || null, update_interval || 15]);

    const rssSource = result.rows[0];

    // 关联板块
    if (category_ids && category_ids.length > 0) {
      for (const categoryId of category_ids) {
        await client.query(`
          INSERT INTO rss_category (rss_id, category_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [rssSource.id, categoryId]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: rssSource, message: 'RSS源添加成功' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating RSS source:', error);
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: '该RSS URL已存在' });
    }
    res.status(500).json({ success: false, message: '添加RSS源失败' });
  } finally {
    client.release();
  }
});

// 更新RSS源
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { name, rss_url, site_url, description, update_interval, is_active, category_ids } = req.body;

    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE rss_sources
      SET name = COALESCE($1, name),
          rss_url = COALESCE($2, rss_url),
          site_url = COALESCE($3, site_url),
          description = COALESCE($4, description),
          update_interval = COALESCE($5, update_interval),
          is_active = COALESCE($6, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [name, rss_url, site_url, description, update_interval, is_active, id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'RSS源不存在' });
    }

    // 更新板块关联
    if (category_ids !== undefined) {
      await client.query('DELETE FROM rss_category WHERE rss_id = $1', [id]);
      for (const categoryId of category_ids) {
        await client.query(`
          INSERT INTO rss_category (rss_id, category_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [id, categoryId]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0], message: 'RSS源更新成功' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating RSS source:', error);
    res.status(500).json({ success: false, message: '更新RSS源失败' });
  } finally {
    client.release();
  }
});

// 删除RSS源
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM rss_sources WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'RSS源不存在' });
    }

    res.json({ success: true, message: 'RSS源删除成功' });
  } catch (error) {
    console.error('Error deleting RSS source:', error);
    res.status(500).json({ success: false, message: '删除RSS源失败' });
  }
});

// 测试RSS源有效性
router.post('/test', [
  body('rss_url').isURL().withMessage('请输入有效的URL')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { rss_url } = req.body;
    const feed = await parser.parseURL(rss_url);

    res.json({
      success: true,
      data: {
        title: feed.title,
        description: feed.description,
        link: feed.link,
        itemCount: feed.items.length,
        lastBuildDate: feed.lastBuildDate,
        items: feed.items.slice(0, 5).map(item => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate
        }))
      },
      message: 'RSS源有效'
    });
  } catch (error) {
    console.error('Error testing RSS source:', error);
    res.status(400).json({ success: false, message: 'RSS源无效或无法访问' });
  }
});

// 手动抓取RSS源
router.post('/:id/fetch', async (req, res) => {
  try {
    const { id } = req.params;
    const rssResult = await pool.query('SELECT * FROM rss_sources WHERE id = $1', [id]);

    if (rssResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'RSS源不存在' });
    }

    const rssSource = rssResult.rows[0];
    const feed = await parser.parseURL(rssSource.rss_url);

    let newArticles = 0;
    for (const item of feed.items) {
      const guid = item.guid || item.id || item.link;

      // 检查文章是否已存在
      const existingArticle = await pool.query(
        'SELECT id FROM articles WHERE guid = $1 OR link = $2',
        [guid, item.link]
      );

      if (existingArticle.rows.length === 0) {
        await pool.query(`
          INSERT INTO articles (rss_id, title, link, description, content, author, pub_date, guid)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          id,
          item.title,
          item.link,
          item.contentSnippet || item.summary || null,
          item.content || item['content:encoded'] || null,
          item.creator || item.author || null,
          item.pubDate ? new Date(item.pubDate) : new Date(),
          guid
        ]);
        newArticles++;
      }
    }

    // 更新RSS源的最后抓取时间
    await pool.query(`
      UPDATE rss_sources
      SET last_fetch_time = CURRENT_TIMESTAMP,
          last_update_time = CURRENT_TIMESTAMP,
          error_count = 0,
          last_error = NULL
      WHERE id = $1
    `, [id]);

    res.json({
      success: true,
      message: `抓取完成，新增 ${newArticles} 篇文章`,
      data: { newArticles, totalItems: feed.items.length }
    });
  } catch (error) {
    console.error('Error fetching RSS source:', error);

    // 记录错误
    await pool.query(`
      UPDATE rss_sources
      SET error_count = error_count + 1,
          last_error = $1
      WHERE id = $2
    `, [error.message, req.params.id]);

    res.status(500).json({ success: false, message: '抓取失败: ' + error.message });
  }
});

// 批量启用/禁用RSS源
router.post('/batch/toggle', async (req, res) => {
  try {
    const { ids, is_active } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要操作的RSS源' });
    }

    await pool.query(`
      UPDATE rss_sources
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($2)
    `, [is_active, ids]);

    res.json({ success: true, message: `已${is_active ? '启用' : '禁用'} ${ids.length} 个RSS源` });
  } catch (error) {
    console.error('Error batch toggling RSS sources:', error);
    res.status(500).json({ success: false, message: '批量操作失败' });
  }
});

// 批量删除RSS源
router.post('/batch/delete', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要删除的RSS源' });
    }

    await pool.query('DELETE FROM rss_sources WHERE id = ANY($1)', [ids]);

    res.json({ success: true, message: `已删除 ${ids.length} 个RSS源` });
  } catch (error) {
    console.error('Error batch deleting RSS sources:', error);
    res.status(500).json({ success: false, message: '批量删除失败' });
  }
});

module.exports = router;
