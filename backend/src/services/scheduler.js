const cron = require('node-cron');
const pool = require('../config/database');
const Parser = require('rss-parser');
const emailService = require('./emailService');
const aiService = require('./aiService');

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'RSS Monitor/1.0'
  }
});

class Scheduler {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
  }

  start() {
    console.log('Starting scheduler...');

    // 每分钟检查需要抓取的RSS源
    const fetchJob = cron.schedule('* * * * *', async () => {
      if (this.isRunning) {
        console.log('Previous fetch job still running, skipping...');
        return;
      }
      await this.fetchRssSources();
    });
    this.jobs.push(fetchJob);

    // 每小时执行批量推送（hourly订阅者）
    const hourlyPushJob = cron.schedule('0 * * * *', async () => {
      await this.sendBatchPush('hourly');
    });
    this.jobs.push(hourlyPushJob);

    // 每天早上8点执行每日推送
    const dailyPushJob = cron.schedule('0 8 * * *', async () => {
      await this.sendBatchPush('daily');
    });
    this.jobs.push(dailyPushJob);

    // 每天凌晨2点清理30天前的旧文章
    const cleanupJob = cron.schedule('0 2 * * *', async () => {
      await this.cleanupOldArticles();
    });
    this.jobs.push(cleanupJob);

    console.log('Scheduler started with jobs:', this.jobs.length);
  }

  stop() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    console.log('Scheduler stopped');
  }

  async fetchRssSources() {
    this.isRunning = true;
    try {
      // 获取需要抓取的RSS源（根据更新间隔）
      const result = await pool.query(`
        SELECT * FROM rss_sources
        WHERE is_active = true
        AND (
          last_fetch_time IS NULL
          OR last_fetch_time < NOW() - (update_interval || ' minutes')::INTERVAL
        )
        ORDER BY last_fetch_time NULLS FIRST
        LIMIT 10
      `);

      const sources = result.rows;
      if (sources.length === 0) {
        this.isRunning = false;
        return;
      }

      console.log(`Fetching ${sources.length} RSS sources...`);

      for (const source of sources) {
        await this.fetchSingleSource(source);
      }
    } catch (error) {
      console.error('Error in fetchRssSources:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async fetchSingleSource(source) {
    try {
      console.log(`Fetching: ${source.name} (${source.rss_url})`);
      const feed = await parser.parseURL(source.rss_url);

      let newArticles = [];
      for (const item of feed.items) {
        const guid = item.guid || item.id || item.link;

        // 检查文章是否已存在
        const existingArticle = await pool.query(
          'SELECT id FROM articles WHERE guid = $1 OR link = $2',
          [guid, item.link]
        );

        if (existingArticle.rows.length === 0) {
          const articleResult = await pool.query(`
            INSERT INTO articles (rss_id, title, link, description, content, author, pub_date, guid)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
          `, [
            source.id,
            item.title,
            item.link,
            item.contentSnippet || item.summary || null,
            item.content || item['content:encoded'] || null,
            item.creator || item.author || null,
            item.pubDate ? new Date(item.pubDate) : new Date(),
            guid
          ]);
          newArticles.push(articleResult.rows[0]);
        }
      }

      // 更新RSS源状态
      await pool.query(`
        UPDATE rss_sources
        SET last_fetch_time = CURRENT_TIMESTAMP,
            last_update_time = CASE WHEN $1 > 0 THEN CURRENT_TIMESTAMP ELSE last_update_time END,
            error_count = 0,
            last_error = NULL
        WHERE id = $2
      `, [newArticles.length, source.id]);

      console.log(`Fetched ${source.name}: ${newArticles.length} new articles`);

      // 自动 AI 评分
      if (newArticles.length > 0) {
        await this.autoScoreArticles(newArticles, source);
      }

      // 触发实时推送
      if (newArticles.length > 0) {
        await this.triggerRealtimePush(source, newArticles);
      }

    } catch (error) {
      console.error(`Error fetching ${source.name}:`, error.message);

      // 记录错误
      await pool.query(`
        UPDATE rss_sources
        SET last_fetch_time = CURRENT_TIMESTAMP,
            error_count = error_count + 1,
            last_error = $1
        WHERE id = $2
      `, [error.message, source.id]);
    }
  }

  // 自动 AI 评分
  async autoScoreArticles(articles, source) {
    try {
      // 检查是否启用了自动评分
      const settingResult = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'ai_scoring_enabled'"
      );
      const aiScoringEnabled = settingResult.rows.length > 0 && settingResult.rows[0].value === 'true';

      if (!aiScoringEnabled) {
        return;
      }

      // 检查是否有启用的 AI 提供商
      const providerResult = await pool.query(
        'SELECT id FROM ai_providers WHERE is_active = true LIMIT 1'
      );
      if (providerResult.rows.length === 0) {
        console.log('AI scoring enabled but no active provider configured');
        return;
      }

      console.log(`Auto scoring ${articles.length} articles from ${source.name}...`);

      for (const article of articles) {
        try {
          // 添加 source_name 用于评分
          article.source_name = source.name;
          const score = await aiService.scoreArticle(article);

          await pool.query(
            'UPDATE articles SET ai_score = $1, ai_scored_at = CURRENT_TIMESTAMP WHERE id = $2',
            [score, article.id]
          );

          // 更新内存中的文章对象，供后续实时推送使用
          article.ai_score = score;

          console.log(`Scored article "${article.title.substring(0, 30)}...": ${score}`);

          // 添加延迟避免 API 限流
          await this.sleep(300);
        } catch (error) {
          console.error(`Error scoring article ${article.id}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error in autoScoreArticles:', error);
    }
  }

  // 延迟函数
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async triggerRealtimePush(source, articles) {
    try {
      // 获取系统设置
      const settingsResult = await pool.query(`
        SELECT key, value FROM system_settings WHERE key IN ('ai_score_threshold', 'ai_scoring_enabled')
      `);
      const settings = {};
      settingsResult.rows.forEach(row => {
        settings[row.key] = row.value;
      });

      const aiScoringEnabled = settings.ai_scoring_enabled === 'true';
      const scoreThreshold = parseInt(settings.ai_score_threshold) || 60;

      // 获取该RSS源所属的板块
      const categoryResult = await pool.query(`
        SELECT category_id FROM rss_category WHERE rss_id = $1
      `, [source.id]);

      if (categoryResult.rows.length === 0) return;

      const categoryIds = categoryResult.rows.map(r => r.category_id);

      // 获取订阅了这些板块且设置为实时推送的订阅者
      const subscriberResult = await pool.query(`
        SELECT DISTINCT s.*
        FROM subscribers s
        JOIN subscriber_category sc ON s.id = sc.subscriber_id
        WHERE s.is_active = true
        AND s.push_frequency = 'realtime'
        AND sc.category_id = ANY($1)
      `, [categoryIds]);

      const subscribers = subscriberResult.rows;
      if (subscribers.length === 0) return;

      console.log(`Sending realtime push to ${subscribers.length} subscribers...`);

      for (const subscriber of subscribers) {
        for (const article of articles) {
          // 如果启用了 AI 评分，检查分数是否达标
          if (aiScoringEnabled && article.ai_score !== null && article.ai_score < scoreThreshold) {
            console.log(`Skipping article "${article.title.substring(0, 30)}..." (score: ${article.ai_score} < ${scoreThreshold})`);
            continue;
          }

          // 检查是否已经推送过该文章给该订阅者
          const existingPush = await pool.query(`
            SELECT id FROM push_logs
            WHERE subscriber_id = $1 AND article_id = $2 AND status = 'success'
          `, [subscriber.id, article.id]);

          if (existingPush.rows.length === 0) {
            await emailService.sendArticleEmail(subscriber, article, source);
          }
        }
      }

      // 标记文章为已推送（实时推送也要标记）
      const articleIds = articles.map(a => a.id);
      await pool.query(`
        UPDATE articles SET is_pushed = true WHERE id = ANY($1)
      `, [articleIds]);

    } catch (error) {
      console.error('Error in triggerRealtimePush:', error);
    }
  }

  async sendBatchPush(frequency) {
    try {
      console.log(`Starting ${frequency} batch push...`);

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

      // 获取需要推送的订阅者
      const subscriberResult = await pool.query(`
        SELECT s.*,
          array_agg(sc.category_id) as category_ids
        FROM subscribers s
        JOIN subscriber_category sc ON s.id = sc.subscriber_id
        WHERE s.is_active = true
        AND s.push_frequency = $1
        GROUP BY s.id
      `, [frequency]);

      const subscribers = subscriberResult.rows;
      if (subscribers.length === 0) {
        console.log(`No ${frequency} subscribers to push`);
        return;
      }

      for (const subscriber of subscribers) {
        // 获取上次推送后的新文章
        const lastPushTime = subscriber.last_push_time || new Date(0);

        // 构建查询，如果启用了AI评分则过滤低分文章
        let articleQuery = `
          SELECT a.*, rs.name as source_name
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

        const articles = articleResult.rows;
        if (articles.length === 0) continue;

        // 发送摘要邮件
        await emailService.sendDigestEmail(subscriber, articles);

        // 更新订阅者的最后推送时间
        await pool.query(`
          UPDATE subscribers SET last_push_time = CURRENT_TIMESTAMP WHERE id = $1
        `, [subscriber.id]);

        // 标记文章为已推送
        const articleIds = articles.map(a => a.id);
        await pool.query(`
          UPDATE articles SET is_pushed = true WHERE id = ANY($1)
        `, [articleIds]);
      }

      console.log(`${frequency} batch push completed`);
    } catch (error) {
      console.error(`Error in ${frequency} batch push:`, error);
    }
  }

  async cleanupOldArticles() {
    try {
      const result = await pool.query(`
        DELETE FROM articles
        WHERE created_at < NOW() - INTERVAL '30 days'
        RETURNING id
      `);
      console.log(`Cleaned up ${result.rowCount} old articles`);
    } catch (error) {
      console.error('Error cleaning up old articles:', error);
    }
  }
}

module.exports = new Scheduler();
