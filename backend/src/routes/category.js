const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');

// 获取所有板块
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM rss_category WHERE category_id = c.id) as rss_count,
        (SELECT COUNT(*) FROM articles a
         JOIN rss_category rc ON a.rss_id = rc.rss_id
         WHERE rc.category_id = c.id) as article_count
      FROM categories c
      ORDER BY c.sort_order, c.created_at
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: '获取板块失败' });
  }
});

// 获取单个板块
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM rss_category WHERE category_id = c.id) as rss_count
      FROM categories c
      WHERE c.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '板块不存在' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ success: false, message: '获取板块失败' });
  }
});

// 获取板块下的RSS源
router.get('/:id/rss', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT rs.*
      FROM rss_sources rs
      JOIN rss_category rc ON rs.id = rc.rss_id
      WHERE rc.category_id = $1
      ORDER BY rs.name
    `, [id]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching category RSS sources:', error);
    res.status(500).json({ success: false, message: '获取板块RSS源失败' });
  }
});

// 创建板块
router.post('/', [
  body('name').notEmpty().withMessage('板块名称不能为空'),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('颜色格式不正确')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, description, icon, color, sort_order } = req.body;

    const result = await pool.query(`
      INSERT INTO categories (name, description, icon, color, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, description || null, icon || null, color || '#409EFF', sort_order || 0]);

    res.status(201).json({ success: true, data: result.rows[0], message: '板块创建成功' });
  } catch (error) {
    console.error('Error creating category:', error);
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: '板块名称已存在' });
    }
    res.status(500).json({ success: false, message: '创建板块失败' });
  }
});

// 更新板块
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, color, sort_order } = req.body;

    const result = await pool.query(`
      UPDATE categories
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          icon = COALESCE($3, icon),
          color = COALESCE($4, color),
          sort_order = COALESCE($5, sort_order)
      WHERE id = $6
      RETURNING *
    `, [name, description, icon, color, sort_order, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '板块不存在' });
    }

    res.json({ success: true, data: result.rows[0], message: '板块更新成功' });
  } catch (error) {
    console.error('Error updating category:', error);
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: '板块名称已存在' });
    }
    res.status(500).json({ success: false, message: '更新板块失败' });
  }
});

// 删除板块
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查是否有关联的RSS源
    const rssCheck = await pool.query(
      'SELECT COUNT(*) FROM rss_category WHERE category_id = $1',
      [id]
    );

    if (parseInt(rssCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: '该板块下还有RSS源，请先移除关联的RSS源'
      });
    }

    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '板块不存在' });
    }

    res.json({ success: true, message: '板块删除成功' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ success: false, message: '删除板块失败' });
  }
});

// 更新板块排序
router.post('/reorder', async (req, res) => {
  const client = await pool.connect();
  try {
    const { orders } = req.body; // [{ id: 1, sort_order: 0 }, { id: 2, sort_order: 1 }]

    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ success: false, message: '参数格式错误' });
    }

    await client.query('BEGIN');

    for (const item of orders) {
      await client.query(
        'UPDATE categories SET sort_order = $1 WHERE id = $2',
        [item.sort_order, item.id]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: '排序更新成功' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reordering categories:', error);
    res.status(500).json({ success: false, message: '更新排序失败' });
  } finally {
    client.release();
  }
});

module.exports = router;
