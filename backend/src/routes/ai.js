const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 获取所有 AI 提供商
router.get('/providers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, provider_type, api_base_url, model, is_active,
             CASE WHEN api_key IS NOT NULL AND api_key != '' THEN '******' ELSE '' END as api_key_masked,
             created_at, updated_at
      FROM ai_providers
      ORDER BY id
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching AI providers:', error);
    res.status(500).json({ success: false, message: '获取AI提供商失败' });
  }
});

// 获取单个 AI 提供商
router.get('/providers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT id, name, provider_type, api_base_url, model, is_active,
             CASE WHEN api_key IS NOT NULL AND api_key != '' THEN '******' ELSE '' END as api_key_masked,
             created_at, updated_at
      FROM ai_providers WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '提供商不存在' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching AI provider:', error);
    res.status(500).json({ success: false, message: '获取AI提供商失败' });
  }
});

// 添加 AI 提供商
router.post('/providers', async (req, res) => {
  try {
    const { name, provider_type, api_key, api_base_url, model } = req.body;

    const result = await pool.query(`
      INSERT INTO ai_providers (name, provider_type, api_key, api_base_url, model)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, provider_type, api_base_url, model, is_active
    `, [name, provider_type, api_key, api_base_url, model]);

    res.status(201).json({ success: true, data: result.rows[0], message: 'AI提供商添加成功' });
  } catch (error) {
    console.error('Error creating AI provider:', error);
    res.status(500).json({ success: false, message: '添加AI提供商失败' });
  }
});

// 更新 AI 提供商
router.put('/providers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, provider_type, api_key, api_base_url, model, is_active } = req.body;

    // 如果启用此提供商，先禁用其他所有提供商
    if (is_active) {
      await pool.query('UPDATE ai_providers SET is_active = false WHERE id != $1', [id]);
    }

    // 如果 api_key 是 '******'，不更新 api_key
    let query, params;
    if (api_key && api_key !== '******') {
      query = `
        UPDATE ai_providers
        SET name = COALESCE($1, name),
            provider_type = COALESCE($2, provider_type),
            api_key = $3,
            api_base_url = COALESCE($4, api_base_url),
            model = COALESCE($5, model),
            is_active = COALESCE($6, is_active),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING id, name, provider_type, api_base_url, model, is_active
      `;
      params = [name, provider_type, api_key, api_base_url, model, is_active, id];
    } else {
      query = `
        UPDATE ai_providers
        SET name = COALESCE($1, name),
            provider_type = COALESCE($2, provider_type),
            api_base_url = COALESCE($3, api_base_url),
            model = COALESCE($4, model),
            is_active = COALESCE($5, is_active),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING id, name, provider_type, api_base_url, model, is_active
      `;
      params = [name, provider_type, api_base_url, model, is_active, id];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '提供商不存在' });
    }

    res.json({ success: true, data: result.rows[0], message: 'AI提供商更新成功' });
  } catch (error) {
    console.error('Error updating AI provider:', error);
    res.status(500).json({ success: false, message: '更新AI提供商失败' });
  }
});

// 删除 AI 提供商
router.delete('/providers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM ai_providers WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '提供商不存在' });
    }

    res.json({ success: true, message: 'AI提供商删除成功' });
  } catch (error) {
    console.error('Error deleting AI provider:', error);
    res.status(500).json({ success: false, message: '删除AI提供商失败' });
  }
});

// 测试 AI 提供商连接
router.post('/providers/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM ai_providers WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '提供商不存在' });
    }

    const provider = result.rows[0];
    if (!provider.api_key) {
      return res.status(400).json({ success: false, message: '请先配置API Key' });
    }

    const aiService = require('../services/aiService');
    const testResult = await aiService.testConnection(provider);

    res.json({ success: true, message: '连接测试成功', data: testResult });
  } catch (error) {
    console.error('Error testing AI provider:', error);
    res.status(500).json({ success: false, message: '连接测试失败: ' + error.message });
  }
});

// ==================== 提示词管理 ====================

// 获取所有提示词
router.get('/prompts', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM ai_prompts ORDER BY is_default DESC, created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ success: false, message: '获取提示词失败' });
  }
});

// 获取单个提示词
router.get('/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM ai_prompts WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '提示词不存在' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching prompt:', error);
    res.status(500).json({ success: false, message: '获取提示词失败' });
  }
});

// 添加提示词
router.post('/prompts', async (req, res) => {
  try {
    const { name, prompt_type, content, is_default } = req.body;

    // 如果设为默认，先取消其他同类型的默认
    if (is_default) {
      await pool.query(
        'UPDATE ai_prompts SET is_default = false WHERE prompt_type = $1',
        [prompt_type || 'scoring']
      );
    }

    const result = await pool.query(`
      INSERT INTO ai_prompts (name, prompt_type, content, is_default)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, prompt_type || 'scoring', content, is_default || false]);

    res.status(201).json({ success: true, data: result.rows[0], message: '提示词添加成功' });
  } catch (error) {
    console.error('Error creating prompt:', error);
    res.status(500).json({ success: false, message: '添加提示词失败' });
  }
});

// 更新提示词
router.put('/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, prompt_type, content, is_default } = req.body;

    // 如果设为默认，先取消其他同类型的默认
    if (is_default) {
      const currentPrompt = await pool.query('SELECT prompt_type FROM ai_prompts WHERE id = $1', [id]);
      if (currentPrompt.rows.length > 0) {
        await pool.query(
          'UPDATE ai_prompts SET is_default = false WHERE prompt_type = $1 AND id != $2',
          [prompt_type || currentPrompt.rows[0].prompt_type, id]
        );
      }
    }

    const result = await pool.query(`
      UPDATE ai_prompts
      SET name = COALESCE($1, name),
          prompt_type = COALESCE($2, prompt_type),
          content = COALESCE($3, content),
          is_default = COALESCE($4, is_default),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [name, prompt_type, content, is_default, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '提示词不存在' });
    }

    res.json({ success: true, data: result.rows[0], message: '提示词更新成功' });
  } catch (error) {
    console.error('Error updating prompt:', error);
    res.status(500).json({ success: false, message: '更新提示词失败' });
  }
});

// 删除提示词
router.delete('/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM ai_prompts WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '提示词不存在' });
    }

    res.json({ success: true, message: '提示词删除成功' });
  } catch (error) {
    console.error('Error deleting prompt:', error);
    res.status(500).json({ success: false, message: '删除提示词失败' });
  }
});

// ==================== 系统设置 ====================

// 获取所有设置
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM system_settings ORDER BY key');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, message: '获取设置失败' });
  }
});

// 更新设置
router.put('/settings', async (req, res) => {
  try {
    const settings = req.body; // { key: value, ... }

    for (const [key, value] of Object.entries(settings)) {
      await pool.query(`
        INSERT INTO system_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
      `, [key, value]);
    }

    res.json({ success: true, message: '设置更新成功' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, message: '更新设置失败' });
  }
});

// ==================== 文章评分 ====================

// 手动评分单篇文章
router.post('/score/article/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { manual_score } = req.body;

    // 如果提供了手动分数，直接使用
    if (manual_score !== undefined) {
      await pool.query(`
        UPDATE articles SET ai_score = $1, ai_scored_at = CURRENT_TIMESTAMP WHERE id = $2
      `, [manual_score, id]);
      return res.json({ success: true, message: '评分成功', data: { score: manual_score } });
    }

    // 否则使用 AI 评分
    const articleResult = await pool.query(`
      SELECT a.*, rs.name as source_name
      FROM articles a
      JOIN rss_sources rs ON a.rss_id = rs.id
      WHERE a.id = $1
    `, [id]);

    if (articleResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '文章不存在' });
    }

    const article = articleResult.rows[0];
    const aiService = require('../services/aiService');
    const score = await aiService.scoreArticle(article);

    await pool.query(`
      UPDATE articles SET ai_score = $1, ai_scored_at = CURRENT_TIMESTAMP WHERE id = $2
    `, [score, id]);

    res.json({ success: true, message: '评分成功', data: { score } });
  } catch (error) {
    console.error('Error scoring article:', error);
    res.status(500).json({ success: false, message: '评分失败: ' + error.message });
  }
});

// 批量评分文章（逐个评分）
router.post('/score/batch', async (req, res) => {
  try {
    const { article_ids } = req.body;

    if (!article_ids || article_ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要评分的文章' });
    }

    // 返回任务ID，前端可以轮询进度
    const taskId = Date.now().toString();

    // 异步执行评分
    const aiService = require('../services/aiService');
    aiService.batchScoreArticles(article_ids, taskId);

    res.json({
      success: true,
      message: '批量评分任务已启动',
      data: { taskId, total: article_ids.length }
    });
  } catch (error) {
    console.error('Error starting batch scoring:', error);
    res.status(500).json({ success: false, message: '启动批量评分失败' });
  }
});

// 获取批量评分进度
router.get('/score/batch/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const aiService = require('../services/aiService');
    const progress = aiService.getBatchProgress(taskId);

    res.json({ success: true, data: progress });
  } catch (error) {
    console.error('Error getting batch progress:', error);
    res.status(500).json({ success: false, message: '获取进度失败' });
  }
});

// 获取未评分文章列表
router.get('/articles/unscored', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const result = await pool.query(`
      SELECT a.id, a.title, a.description, a.pub_date, a.ai_score, rs.name as source_name
      FROM articles a
      JOIN rss_sources rs ON a.rss_id = rs.id
      WHERE a.ai_score IS NULL
      ORDER BY a.pub_date DESC
      LIMIT $1
    `, [limit]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching unscored articles:', error);
    res.status(500).json({ success: false, message: '获取未评分文章失败' });
  }
});

module.exports = router;
