const express = require('express');
const cors = require('cors');
require('dotenv').config();

const rssRoutes = require('./routes/rss');
const categoryRoutes = require('./routes/category');
const articleRoutes = require('./routes/article');
const emailRoutes = require('./routes/email');
const subscriberRoutes = require('./routes/subscriber');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');
const templateRoutes = require('./routes/template');
const aiRoutes = require('./routes/ai');
const scheduler = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/rss', rssRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/subscribers', subscriberRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/ai', aiRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // 启动定时任务
  scheduler.start();
});

module.exports = app;
