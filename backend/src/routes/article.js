const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 获取文章列表
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category_id,
      rss_id,
      search,
      start_date,
      end_date,
      is_read
    } = req.query;

    const offset = (page - 1) * limit;
    let query = `
      SELECT a.*,
        rs.name as source_name,
        rs.site_url as source_url,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'color', c.color)
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as categories
      FROM articles a
      JOIN rss_sources rs ON a.rss_id = rs.id
      LEFT JOIN rss_category rc ON rs.id = rc.rss_id
      LEFT JOIN categories c ON rc.category_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (category_id) {
      query += ` AND rc.category_id = $${paramIndex}`;
      params.push(category_id);
      paramIndex++;
    }

    if (rss_id) {
      query += ` AND a.rss_id = $${paramIndex}`;
      params.push(rss_id);
      paramIndex++;
    }

    if (search) {
      query += ` AND (a.title ILIKE $${paramIndex} OR a.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (start_date) {
      query += ` AND a.pub_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND a.pub_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    if (is_read !== undefined) {
      query += ` AND a.is_read = $${paramIndex}`;
      params.push(is_read === 'true');
      paramIndex++;
    }

    query += ` GROUP BY a.id, rs.name, rs.site_url ORDER BY a.pub_date DESC`;

    // 获取总数
    const countQuery = `
      SELECT COUNT(DISTINCT a.id) as total
      FROM articles a
      JOIN rss_sources rs ON a.rss_id = rs.id
      LEFT JOIN rss_category rc ON rs.id = rc.rss_id
      LEFT JOIN categories c ON rc.category_id = c.id
      WHERE 1=1
      ${category_id ? `AND rc.category_id = $1` : ''}
      ${rss_id ? `AND a.rss_id = $${category_id ? 2 : 1}` : ''}
    `;

    const countParams = [];
    if (category_id) countParams.push(category_id);
    if (rss_id) countParams.push(rss_id);

    const countResult = await pool.query(
      countQuery.replace(/\$\d+/g, (match, offset) => `$${countParams.indexOf(countParams[parseInt(match.slice(1)) - 1]) + 1}`),
      countParams
    );

    // 添加分页
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0]?.total || 0),
        totalPages: Math.ceil((countResult.rows[0]?.total || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ success: false, message: '获取文章列表失败' });
  }
});

// 获取单篇文章
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT a.*,
        rs.name as source_name,
        rs.site_url as source_url,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'color', c.color)
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as categories
      FROM articles a
      JOIN rss_sources rs ON a.rss_id = rs.id
      LEFT JOIN rss_category rc ON rs.id = rc.rss_id
      LEFT JOIN categories c ON rc.category_id = c.id
      WHERE a.id = $1
      GROUP BY a.id, rs.name, rs.site_url
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '文章不存在' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ success: false, message: '获取文章失败' });
  }
});

// 标记文章为已读/未读
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_read } = req.body;

    const result = await pool.query(`
      UPDATE articles SET is_read = $1 WHERE id = $2 RETURNING *
    `, [is_read !== false, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '文章不存在' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating article read status:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 批量标记已读
router.post('/batch/read', async (req, res) => {
  try {
    const { ids, is_read } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要操作的文章' });
    }

    await pool.query(`
      UPDATE articles SET is_read = $1 WHERE id = ANY($2)
    `, [is_read !== false, ids]);

    res.json({ success: true, message: `已标记 ${ids.length} 篇文章` });
  } catch (error) {
    console.error('Error batch marking articles:', error);
    res.status(500).json({ success: false, message: '批量操作失败' });
  }
});

// 删除文章
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM articles WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '文章不存在' });
    }

    res.json({ success: true, message: '文章删除成功' });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ success: false, message: '删除文章失败' });
  }
});

// 清理旧文章
router.post('/cleanup', async (req, res) => {
  try {
    const { days = 30 } = req.body;

    const result = await pool.query(`
      DELETE FROM articles
      WHERE created_at < NOW() - INTERVAL '${parseInt(days)} days'
      RETURNING id
    `);

    res.json({
      success: true,
      message: `已清理 ${result.rowCount} 篇旧文章`
    });
  } catch (error) {
    console.error('Error cleaning up articles:', error);
    res.status(500).json({ success: false, message: '清理失败' });
  }
});

module.exports = router;
