const pool = require('../config/database');

class AIService {
  constructor() {
    this.batchProgress = {}; // 存储批量评分进度
  }

  // 获取启用的 AI 提供商
  async getActiveProvider() {
    const result = await pool.query(
      'SELECT * FROM ai_providers WHERE is_active = true LIMIT 1'
    );
    if (result.rows.length === 0) {
      throw new Error('没有启用的AI提供商，请先在AI设置中配置并启用');
    }
    return result.rows[0];
  }

  // 获取默认提示词
  async getDefaultPrompt(type = 'scoring') {
    const result = await pool.query(
      'SELECT * FROM ai_prompts WHERE prompt_type = $1 AND is_default = true LIMIT 1',
      [type]
    );
    if (result.rows.length === 0) {
      // 返回默认提示词
      return {
        content: `你是一个文章质量评估助手。请对以下文章进行质量评分（0-100分）。

文章标题：{title}
文章摘要：{description}
文章来源：{source}

请只返回一个0-100之间的整数分数，不要返回任何其他内容。`
      };
    }
    return result.rows[0];
  }

  // 获取系统设置
  async getSetting(key) {
    const result = await pool.query(
      'SELECT value FROM system_settings WHERE key = $1',
      [key]
    );
    return result.rows.length > 0 ? result.rows[0].value : null;
  }

  // 调用 AI API
  async callAI(provider, prompt) {
    const { provider_type, api_key, api_base_url, model } = provider;

    switch (provider_type) {
      case 'openai':
      case 'deepseek':
      case 'moonshot':
        return await this.callOpenAICompatible(api_base_url, api_key, model, prompt);
      case 'claude':
        return await this.callClaude(api_base_url, api_key, model, prompt);
      case 'glm':
        return await this.callGLM(api_base_url, api_key, model, prompt);
      case 'qwen':
        return await this.callQwen(api_base_url, api_key, model, prompt);
      default:
        // 默认尝试 OpenAI 兼容接口
        return await this.callOpenAICompatible(api_base_url, api_key, model, prompt);
    }
  }

  // OpenAI 兼容接口（OpenAI、DeepSeek、Moonshot 等）
  async callOpenAICompatible(baseUrl, apiKey, model, prompt) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 50
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API请求失败: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  // Claude API
  async callClaude(baseUrl, apiKey, model, prompt) {
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 50,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API请求失败: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.content[0].text.trim();
  }

  // 智谱 GLM API
  async callGLM(baseUrl, apiKey, model, prompt) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 50
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API请求失败: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  // 通义千问 API
  async callQwen(baseUrl, apiKey, model, prompt) {
    const response = await fetch(`${baseUrl}/services/aigc/text-generation/generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        input: {
          messages: [{ role: 'user', content: prompt }]
        },
        parameters: {
          temperature: 0.3,
          max_tokens: 50
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API请求失败: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.output.text.trim();
  }

  // 测试连接
  async testConnection(provider) {
    const testPrompt = '请回复数字 42';
    const result = await this.callAI(provider, testPrompt);
    return { response: result };
  }

  // 评分单篇文章
  async scoreArticle(article) {
    const provider = await this.getActiveProvider();
    const promptTemplate = await this.getDefaultPrompt('scoring');

    // 替换提示词中的变量
    const prompt = promptTemplate.content
      .replace('{title}', article.title || '')
      .replace('{description}', article.description || '无摘要')
      .replace('{source}', article.source_name || '未知来源');

    const result = await this.callAI(provider, prompt);

    // 提取分数
    const score = this.extractScore(result);
    return score;
  }

  // 从 AI 响应中提取分数
  extractScore(response) {
    // 尝试提取数字
    const match = response.match(/\d+/);
    if (match) {
      const score = parseInt(match[0], 10);
      // 确保分数在 0-100 范围内
      return Math.min(100, Math.max(0, score));
    }
    // 如果无法提取，返回默认分数
    return 50;
  }

  // 批量评分文章（逐个评分）
  async batchScoreArticles(articleIds, taskId) {
    this.batchProgress[taskId] = {
      total: articleIds.length,
      completed: 0,
      failed: 0,
      current: null,
      status: 'running',
      results: []
    };

    try {
      for (let i = 0; i < articleIds.length; i++) {
        const articleId = articleIds[i];

        try {
          // 获取文章信息
          const articleResult = await pool.query(`
            SELECT a.*, rs.name as source_name
            FROM articles a
            JOIN rss_sources rs ON a.rss_id = rs.id
            WHERE a.id = $1
          `, [articleId]);

          if (articleResult.rows.length === 0) {
            this.batchProgress[taskId].failed++;
            continue;
          }

          const article = articleResult.rows[0];
          this.batchProgress[taskId].current = article.title;

          // 评分
          const score = await this.scoreArticle(article);

          // 保存分数
          await pool.query(`
            UPDATE articles SET ai_score = $1, ai_scored_at = CURRENT_TIMESTAMP WHERE id = $2
          `, [score, articleId]);

          this.batchProgress[taskId].completed++;
          this.batchProgress[taskId].results.push({
            id: articleId,
            title: article.title,
            score: score
          });

          // 添加延迟，避免 API 限流
          await this.sleep(500);

        } catch (error) {
          console.error(`Error scoring article ${articleId}:`, error.message);
          this.batchProgress[taskId].failed++;
        }
      }

      this.batchProgress[taskId].status = 'completed';
      this.batchProgress[taskId].current = null;

    } catch (error) {
      console.error('Batch scoring error:', error);
      this.batchProgress[taskId].status = 'error';
      this.batchProgress[taskId].error = error.message;
    }
  }

  // 获取批量评分进度
  getBatchProgress(taskId) {
    return this.batchProgress[taskId] || { status: 'not_found' };
  }

  // 延迟函数
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new AIService();
