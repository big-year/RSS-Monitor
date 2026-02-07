const pool = require('../config/database');

async function migrateAI() {
  const client = await pool.connect();

  try {
    console.log('Creating AI related tables...');

    await client.query('BEGIN');

    // AI 提供商配置表
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_providers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        provider_type VARCHAR(50) NOT NULL,
        api_key VARCHAR(500),
        api_base_url VARCHAR(500),
        model VARCHAR(100),
        is_active BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created ai_providers table');

    // 提示词管理表
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_prompts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        prompt_type VARCHAR(50) NOT NULL DEFAULT 'scoring',
        content TEXT NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created ai_prompts table');

    // 系统设置表（用于存储推送阈值等）
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) NOT NULL UNIQUE,
        value TEXT,
        description VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created system_settings table');

    // 给 articles 表添加 AI 评分字段
    await client.query(`
      ALTER TABLE articles
      ADD COLUMN IF NOT EXISTS ai_score INT DEFAULT NULL
    `);
    await client.query(`
      ALTER TABLE articles
      ADD COLUMN IF NOT EXISTS ai_scored_at TIMESTAMP DEFAULT NULL
    `);
    console.log('Added ai_score columns to articles table');

    // 插入默认设置
    await client.query(`
      INSERT INTO system_settings (key, value, description)
      VALUES
        ('ai_score_threshold', '60', '推送文章的最低AI评分（0-100）'),
        ('ai_scoring_enabled', 'false', '是否启用AI自动评分'),
        ('max_articles_per_push', '20', '每次推送的最大文章数')
      ON CONFLICT (key) DO NOTHING
    `);
    console.log('Inserted default settings');

    // 插入默认提示词
    await client.query(`
      INSERT INTO ai_prompts (name, prompt_type, content, is_default)
      VALUES (
        '默认评分提示词',
        'scoring',
        '你是一个文章质量评估助手。请对以下文章进行质量评分（0-100分）。

评分标准：
- 90-100分：重大新闻、深度分析、行业突破、独家报道
- 70-89分：有价值的资讯、实用教程、专业见解
- 50-69分：一般性内容、常规更新、普通新闻
- 30-49分：价值较低、内容空洞、标题党
- 0-29分：广告软文、重复内容、无意义信息

文章标题：{title}
文章摘要：{description}
文章来源：{source}

请只返回一个0-100之间的整数分数，不要返回任何其他内容。',
        true
      )
      ON CONFLICT DO NOTHING
    `);
    console.log('Inserted default prompt');

    // 插入预设的 AI 提供商（不含 API Key）
    await client.query(`
      INSERT INTO ai_providers (name, provider_type, api_base_url, model, is_active)
      VALUES
        ('OpenAI', 'openai', 'https://api.openai.com/v1', 'gpt-3.5-turbo', false),
        ('Claude', 'claude', 'https://api.anthropic.com/v1', 'claude-3-haiku-20240307', false),
        ('DeepSeek', 'deepseek', 'https://api.deepseek.com/v1', 'deepseek-chat', false),
        ('智谱GLM', 'glm', 'https://open.bigmodel.cn/api/paas/v4', 'glm-4-flash', false),
        ('通义千问', 'qwen', 'https://dashscope.aliyuncs.com/api/v1', 'qwen-turbo', false),
        ('Moonshot', 'moonshot', 'https://api.moonshot.cn/v1', 'moonshot-v1-8k', false)
      ON CONFLICT DO NOTHING
    `);
    console.log('Inserted preset AI providers');

    await client.query('COMMIT');
    console.log('AI migration completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateAI().catch(console.error);
