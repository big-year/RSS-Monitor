const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 获取仪表盘统计数据
router.get('/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM rss_sources) as total_sources,
        (SELECT COUNT(*) FROM rss_sources WHERE is_active = true) as active_sources,
        (SELECT COUNT(*) FROM categories) as total_categories,
        (SELECT COUNT(*) FROM articles) as total_articles,
        (SELECT COUNT(*) FROM articles WHERE created_at > NOW() - INTERVAL '24 hours') as today_articles,
        (SELECT COUNT(*) FROM subscribers) as total_subscribers,
        (SELECT COUNT(*) FROM subscribers WHERE is_active = true) as active_subscribers,
        (SELECT COUNT(*) FROM push_logs WHERE created_at > NOW() - INTERVAL '24 hours') as today_pushes,
        (SELECT COUNT(*) FROM push_logs WHERE created_at > NOW() - INTERVAL '24 hours' AND status = 'success') as today_success_pushes
    `);

    res.json({ success: true, data: stats.rows[0] });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: '获取统计数据失败' });
  }
});

// 获取最近文章
router.get('/recent-articles', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const result = await pool.query(`
      SELECT a.id, a.title, a.link, a.pub_date, a.created_at,
        rs.name as source_name
      FROM articles a
      JOIN rss_sources rs ON a.rss_id = rs.id
      ORDER BY a.created_at DESC
      LIMIT $1
    `, [parseInt(limit)]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching recent articles:', error);
    res.status(500).json({ success: false, message: '获取最近文章失败' });
  }
});

// 获取RSS源状态概览
router.get('/source-status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        rs.id,
        rs.name,
        rs.is_active,
        rs.last_fetch_time,
        rs.error_count,
        rs.last_error,
        (SELECT COUNT(*) FROM articles WHERE rss_id = rs.id) as article_count,
        (SELECT COUNT(*) FROM articles WHERE rss_id = rs.id AND created_at > NOW() - INTERVAL '24 hours') as today_count
      FROM rss_sources rs
      ORDER BY rs.error_count DESC, rs.last_fetch_time DESC NULLS LAST
      LIMIT 10
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching source status:', error);
    res.status(500).json({ success: false, message: '获取RSS源状态失败' });
  }
});

// 获取板块文章统计
router.get('/category-stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.color,
        COUNT(DISTINCT rc.rss_id) as source_count,
        COUNT(DISTINCT a.id) as article_count,
        COUNT(DISTINCT a.id) FILTER (WHERE a.created_at > NOW() - INTERVAL '24 hours') as today_count
      FROM categories c
      LEFT JOIN rss_category rc ON c.id = rc.category_id
      LEFT JOIN articles a ON rc.rss_id = a.rss_id
      GROUP BY c.id
      ORDER BY c.sort_order, article_count DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching category stats:', error);
    res.status(500).json({ success: false, message: '获取板块统计失败' });
  }
});

// 获取文章趋势（最近7天）
router.get('/article-trend', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM articles
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching article trend:', error);
    res.status(500).json({ success: false, message: '获取文章趋势失败' });
  }
});

module.exports = router;
