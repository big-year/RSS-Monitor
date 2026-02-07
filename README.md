# RSS实时监控推送系统

一个功能完整的RSS监控和邮件推送系统，支持多RSS源管理、板块分类、内容聚合展示和邮件推送。

## 技术栈

- **后端**: Node.js + Express + PostgreSQL
- **前端**: Vue 3 + Element Plus + Vite
- **定时任务**: node-cron
- **RSS解析**: rss-parser
- **邮件发送**: nodemailer

## 功能特性

- RSS源的增删改查管理
- 板块分类管理（支持多板块）
- 实时监控RSS更新
- 邮件推送新内容（支持实时/每小时/每天）
- Web界面聚合展示
- 推送日志记录

## 快速开始

### 1. 环境要求

- Node.js 18+
- PostgreSQL 14+

### 2. 创建数据库

```sql
CREATE DATABASE rss_monitor;
```

### 3. 后端配置

```bash
cd backend

# 复制环境变量配置
cp .env.example .env

# 编辑 .env 文件，配置数据库连接
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=rss_monitor
# DB_USER=postgres
# DB_PASSWORD=your_password

# 安装依赖
npm install

# 运行数据库迁移
npm run db:migrate

# 运行数据库种子（创建默认管理员和示例数据）
npm run db:seed

# 启动后端服务
npm run dev
```

### 4. 前端配置

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 5. 访问系统

- 前端地址: http://localhost:5173
- 后端API: http://localhost:3000/api
- 默认管理员账号: admin / admin123

## 项目结构

```
├── backend/                 # 后端代码
│   ├── src/
│   │   ├── app.js          # 应用入口
│   │   ├── config/         # 配置文件
│   │   ├── database/       # 数据库迁移和种子
│   │   ├── routes/         # API路由
│   │   └── services/       # 业务服务
│   └── package.json
│
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── api/           # API请求
│   │   ├── layouts/       # 布局组件
│   │   ├── router/        # 路由配置
│   │   ├── stores/        # Pinia状态管理
│   │   ├── styles/        # 全局样式
│   │   └── views/         # 页面组件
│   └── package.json
│
└── README.md
```

## API接口

### 认证
- POST `/api/auth/login` - 登录
- POST `/api/auth/change-password` - 修改密码
- GET `/api/auth/me` - 获取当前用户信息

### RSS源管理
- GET `/api/rss` - 获取RSS源列表
- POST `/api/rss` - 添加RSS源
- PUT `/api/rss/:id` - 更新RSS源
- DELETE `/api/rss/:id` - 删除RSS源
- POST `/api/rss/test` - 测试RSS源有效性
- POST `/api/rss/:id/fetch` - 手动抓取RSS源

### 板块管理
- GET `/api/categories` - 获取板块列表
- POST `/api/categories` - 创建板块
- PUT `/api/categories/:id` - 更新板块
- DELETE `/api/categories/:id` - 删除板块

### 文章
- GET `/api/articles` - 获取文章列表
- GET `/api/articles/:id` - 获取文章详情
- PUT `/api/articles/:id/read` - 标记已读/未读

### 订阅者
- GET `/api/subscribers` - 获取订阅者列表
- POST `/api/subscribers` - 添加订阅者
- PUT `/api/subscribers/:id` - 更新订阅者
- DELETE `/api/subscribers/:id` - 删除订阅者

### 邮件配置
- GET `/api/email/smtp` - 获取SMTP配置
- POST `/api/email/smtp` - 保存SMTP配置
- POST `/api/email/smtp/test` - 测试SMTP连接
- GET `/api/email/logs` - 获取推送日志

### 仪表盘
- GET `/api/dashboard/stats` - 获取统计数据
- GET `/api/dashboard/recent-articles` - 获取最近文章
- GET `/api/dashboard/source-status` - 获取RSS源状态
- GET `/api/dashboard/category-stats` - 获取板块统计

## 定时任务

系统自动执行以下定时任务：

- **每分钟**: 检查并抓取需要更新的RSS源
- **每小时**: 向"每小时"频率的订阅者发送摘要邮件
- **每天8点**: 向"每天"频率的订阅者发送摘要邮件
- **每天凌晨2点**: 清理30天前的旧文章

## 生产部署

### 构建前端

```bash
cd frontend
npm run build
```

构建产物在 `frontend/dist` 目录，可以使用 Nginx 部署。

### Nginx配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 使用PM2管理后端进程

```bash
npm install -g pm2
cd backend
pm2 start src/app.js --name rss-monitor
pm2 save
```

## 许可证

MIT
