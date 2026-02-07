<template>
  <div class="page-container">
    <div class="page-header">
      <h2>仪表盘</h2>
      <el-button type="primary" @click="refreshData" :loading="loading">
        <el-icon><Refresh /></el-icon>
        刷新数据
      </el-button>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-row">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #409EFF;">
            <el-icon size="24"><Connection /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.total_sources || 0 }}</div>
            <div class="stat-label">RSS源总数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #67C23A;">
            <el-icon size="24"><Document /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.total_articles || 0 }}</div>
            <div class="stat-label">文章总数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #E6A23C;">
            <el-icon size="24"><TrendCharts /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.today_articles || 0 }}</div>
            <div class="stat-label">今日新增</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #F56C6C;">
            <el-icon size="24"><User /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.active_subscribers || 0 }}</div>
            <div class="stat-label">活跃订阅者</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <!-- 最近文章 -->
      <el-col :span="14">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最近文章</span>
              <el-button text type="primary" @click="$router.push('/articles')">查看全部</el-button>
            </div>
          </template>
          <el-table :data="recentArticles" style="width: 100%" max-height="400">
            <el-table-column prop="title" label="标题" min-width="200">
              <template #default="{ row }">
                <a :href="row.link" target="_blank" class="article-link">{{ row.title }}</a>
              </template>
            </el-table-column>
            <el-table-column prop="source_name" label="来源" width="120" />
            <el-table-column prop="created_at" label="时间" width="160">
              <template #default="{ row }">
                {{ formatTime(row.created_at) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <!-- 板块统计 -->
      <el-col :span="10">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>板块统计</span>
              <el-button text type="primary" @click="$router.push('/categories')">管理板块</el-button>
            </div>
          </template>
          <div class="category-list">
            <div
              v-for="cat in categoryStats"
              :key="cat.id"
              class="category-item"
              @click="$router.push(`/articles/category/${cat.id}`)"
            >
              <div class="category-info">
                <span class="category-color" :style="{ background: cat.color }"></span>
                <span class="category-name">{{ cat.name }}</span>
              </div>
              <div class="category-stats">
                <span class="today">今日 {{ cat.today_count || 0 }}</span>
                <span class="total">共 {{ cat.article_count || 0 }} 篇</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- RSS源状态 -->
    <el-card style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>RSS源状态</span>
          <el-button text type="primary" @click="$router.push('/rss')">管理RSS源</el-button>
        </div>
      </template>
      <el-table :data="sourceStatus" style="width: 100%">
        <el-table-column prop="name" label="名称" min-width="150" />
        <el-table-column prop="is_active" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
              {{ row.is_active ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="article_count" label="文章数" width="100" />
        <el-table-column prop="today_count" label="今日新增" width="100" />
        <el-table-column prop="last_fetch_time" label="最后抓取" width="160">
          <template #default="{ row }">
            {{ row.last_fetch_time ? formatTime(row.last_fetch_time) : '从未' }}
          </template>
        </el-table-column>
        <el-table-column prop="error_count" label="错误" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.error_count > 0" type="danger" size="small">
              {{ row.error_count }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="last_error" label="错误信息" min-width="200">
          <template #default="{ row }">
            <el-tooltip v-if="row.last_error" :content="row.last_error" placement="top">
              <span class="error-text">{{ row.last_error }}</span>
            </el-tooltip>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import dayjs from 'dayjs'
import api from '@/api'

const loading = ref(false)
const stats = ref({})
const recentArticles = ref([])
const categoryStats = ref([])
const sourceStatus = ref([])

const formatTime = (time) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

const fetchStats = async () => {
  try {
    const res = await api.get('/dashboard/stats')
    if (res.success) {
      stats.value = res.data
    }
  } catch (error) {
    console.error('Failed to fetch stats:', error)
  }
}

const fetchRecentArticles = async () => {
  try {
    const res = await api.get('/dashboard/recent-articles', { params: { limit: 10 } })
    if (res.success) {
      recentArticles.value = res.data
    }
  } catch (error) {
    console.error('Failed to fetch recent articles:', error)
  }
}

const fetchCategoryStats = async () => {
  try {
    const res = await api.get('/dashboard/category-stats')
    if (res.success) {
      categoryStats.value = res.data
    }
  } catch (error) {
    console.error('Failed to fetch category stats:', error)
  }
}

const fetchSourceStatus = async () => {
  try {
    const res = await api.get('/dashboard/source-status')
    if (res.success) {
      sourceStatus.value = res.data
    }
  } catch (error) {
    console.error('Failed to fetch source status:', error)
  }
}

const refreshData = async () => {
  loading.value = true
  await Promise.all([
    fetchStats(),
    fetchRecentArticles(),
    fetchCategoryStats(),
    fetchSourceStatus()
  ])
  loading.value = false
}

onMounted(() => {
  refreshData()
})
</script>

<style lang="scss" scoped>
.stat-row {
  .stat-card {
    display: flex;
    align-items: center;
    gap: 15px;
    background: #fff;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }

    .stat-content {
      .stat-value {
        font-size: 28px;
        font-weight: 600;
        color: #303133;
      }

      .stat-label {
        font-size: 14px;
        color: #909399;
        margin-top: 4px;
      }
    }
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.article-link {
  color: #409EFF;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.category-list {
  .category-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #ebeef5;
    cursor: pointer;
    transition: background 0.2s;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: #f5f7fa;
      margin: 0 -20px;
      padding: 12px 20px;
    }

    .category-info {
      display: flex;
      align-items: center;
      gap: 10px;

      .category-color {
        width: 12px;
        height: 12px;
        border-radius: 3px;
      }

      .category-name {
        font-weight: 500;
      }
    }

    .category-stats {
      display: flex;
      gap: 15px;
      font-size: 13px;

      .today {
        color: #67c23a;
      }

      .total {
        color: #909399;
      }
    }
  }
}

.error-text {
  color: #f56c6c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
  max-width: 200px;
}
</style>
