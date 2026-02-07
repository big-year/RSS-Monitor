<template>
  <div class="page-container">
    <div class="page-header">
      <h2>{{ pageTitle }}</h2>
      <div class="header-actions">
        <el-button @click="batchScore" :disabled="selectedIds.length === 0" :loading="scoring">
          <el-icon><Cpu /></el-icon>
          AI评分 ({{ selectedIds.length }})
        </el-button>
        <el-button @click="markAllRead" :disabled="!articles.length">
          全部标记已读
        </el-button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <el-card class="filter-card">
      <el-row :gutter="20">
        <el-col :span="8">
          <el-input
            v-model="filters.search"
            placeholder="搜索文章标题或内容"
            clearable
            @clear="fetchArticles"
            @keyup.enter="fetchArticles"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </el-col>
        <el-col :span="5" v-if="!categoryId">
          <el-select v-model="filters.category_id" placeholder="选择板块" clearable @change="fetchArticles">
            <el-option
              v-for="cat in categories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            />
          </el-select>
        </el-col>
        <el-col :span="5">
          <el-select v-model="filters.rss_id" placeholder="选择RSS源" clearable @change="fetchArticles">
            <el-option
              v-for="rss in rssSources"
              :key="rss.id"
              :label="rss.name"
              :value="rss.id"
            />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            @change="handleDateChange"
          />
        </el-col>
      </el-row>
    </el-card>

    <!-- 文章列表 -->
    <div class="article-list" v-loading="loading">
      <el-card
        v-for="article in articles"
        :key="article.id"
        class="article-card"
        :class="{ 'is-read': article.is_read, 'is-selected': selectedIds.includes(article.id) }"
      >
        <div class="article-header">
          <div class="article-meta">
            <el-checkbox
              :model-value="selectedIds.includes(article.id)"
              @change="toggleSelect(article.id)"
              @click.stop
            />
            <el-tag
              v-for="cat in article.categories"
              :key="cat.id"
              :color="cat.color"
              size="small"
              effect="dark"
              class="category-tag"
            >
              {{ cat.name }}
            </el-tag>
            <span class="source">{{ article.source_name }}</span>
            <span class="time">{{ formatTime(article.pub_date) }}</span>
            <el-tag
              v-if="article.ai_score !== null"
              :type="getScoreType(article.ai_score)"
              size="small"
              class="score-tag"
            >
              AI: {{ article.ai_score }}分
            </el-tag>
          </div>
          <el-dropdown @command="handleCommand($event, article)">
            <el-icon class="more-btn"><MoreFilled /></el-icon>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :command="article.is_read ? 'unread' : 'read'">
                  {{ article.is_read ? '标记未读' : '标记已读' }}
                </el-dropdown-item>
                <el-dropdown-item command="score">AI评分</el-dropdown-item>
                <el-dropdown-item command="manual_score">手动评分</el-dropdown-item>
                <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <h3 class="article-title">
          <a :href="article.link" target="_blank" @click="markAsRead(article)">
            {{ article.title }}
          </a>
        </h3>

        <p class="article-description" v-if="article.description">
          {{ truncateText(article.description, 200) }}
        </p>

        <div class="article-footer">
          <a :href="article.link" target="_blank" class="read-more" @click="markAsRead(article)">
            阅读原文 <el-icon><Right /></el-icon>
          </a>
        </div>
      </el-card>

      <!-- 空状态 -->
      <el-empty v-if="articles.length === 0 && !loading" description="暂无文章" />
    </div>

    <!-- 分页 -->
    <div class="pagination-wrapper" v-if="pagination.total > 0">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.limit"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="fetchArticles"
        @current-change="fetchArticles"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import api from '@/api'

const route = useRoute()

const loading = ref(false)
const scoring = ref(false)
const articles = ref([])
const categories = ref([])
const rssSources = ref([])
const dateRange = ref(null)
const selectedIds = ref([])

const filters = ref({
  search: '',
  category_id: '',
  rss_id: '',
  start_date: '',
  end_date: ''
})

const pagination = ref({
  page: 1,
  limit: 20,
  total: 0
})

const categoryId = computed(() => route.params.id)

const pageTitle = computed(() => {
  if (categoryId.value) {
    const cat = categories.value.find(c => c.id === parseInt(categoryId.value))
    return cat ? `${cat.name} - 内容` : '板块内容'
  }
  return '内容聚合'
})

const formatTime = (time) => dayjs(time).format('YYYY-MM-DD HH:mm')

const truncateText = (text, length) => {
  if (!text) return ''
  // 移除HTML标签
  const plainText = text.replace(/<[^>]+>/g, '')
  return plainText.length > length ? plainText.substring(0, length) + '...' : plainText
}

const fetchArticles = async () => {
  loading.value = true
  try {
    const params = {
      ...filters.value,
      page: pagination.value.page,
      limit: pagination.value.limit
    }

    if (categoryId.value) {
      params.category_id = categoryId.value
    }

    const res = await api.get('/articles', { params })
    if (res.success) {
      articles.value = res.data
      pagination.value.total = res.pagination.total
    }
  } catch (error) {
    console.error('Failed to fetch articles:', error)
  } finally {
    loading.value = false
  }
}

const fetchCategories = async () => {
  try {
    const res = await api.get('/categories')
    if (res.success) {
      categories.value = res.data
    }
  } catch (error) {
    console.error('Failed to fetch categories:', error)
  }
}

const fetchRssSources = async () => {
  try {
    const res = await api.get('/rss')
    if (res.success) {
      rssSources.value = res.data
    }
  } catch (error) {
    console.error('Failed to fetch RSS sources:', error)
  }
}

const handleDateChange = (val) => {
  if (val) {
    filters.value.start_date = val[0]
    filters.value.end_date = val[1]
  } else {
    filters.value.start_date = ''
    filters.value.end_date = ''
  }
  fetchArticles()
}

const markAsRead = async (article) => {
  if (article.is_read) return

  try {
    await api.put(`/articles/${article.id}/read`, { is_read: true })
    article.is_read = true
  } catch (error) {
    console.error('Failed to mark as read:', error)
  }
}

const markAllRead = async () => {
  try {
    await ElMessageBox.confirm('确定要将当前页所有文章标记为已读吗？', '确认', {
      type: 'info'
    })

    const ids = articles.value.filter(a => !a.is_read).map(a => a.id)
    if (ids.length === 0) {
      ElMessage.info('没有未读文章')
      return
    }

    await api.post('/articles/batch/read', { ids, is_read: true })
    articles.value.forEach(a => a.is_read = true)
    ElMessage.success('已全部标记为已读')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to mark all as read:', error)
    }
  }
}

const handleCommand = async (command, article) => {
  if (command === 'read' || command === 'unread') {
    try {
      await api.put(`/articles/${article.id}/read`, { is_read: command === 'read' })
      article.is_read = command === 'read'
      ElMessage.success(command === 'read' ? '已标记为已读' : '已标记为未读')
    } catch (error) {
      // Error handled by interceptor
    }
  } else if (command === 'score') {
    try {
      ElMessage.info('正在评分...')
      const res = await api.post(`/ai/score/article/${article.id}`)
      if (res.success) {
        article.ai_score = res.data.score
        ElMessage.success(`评分完成: ${res.data.score}分`)
      }
    } catch (error) {
      // Error handled by interceptor
    }
  } else if (command === 'manual_score') {
    try {
      const { value } = await ElMessageBox.prompt('请输入分数（0-100）', '手动评分', {
        inputPattern: /^([0-9]|[1-9][0-9]|100)$/,
        inputErrorMessage: '请输入0-100之间的整数'
      })
      const res = await api.post(`/ai/score/article/${article.id}`, { manual_score: parseInt(value) })
      if (res.success) {
        article.ai_score = res.data.score
        ElMessage.success(`评分已设置: ${res.data.score}分`)
      }
    } catch (error) {
      if (error !== 'cancel') {
        console.error('Failed to set score:', error)
      }
    }
  } else if (command === 'delete') {
    try {
      await ElMessageBox.confirm('确定要删除这篇文章吗？', '确认删除', {
        type: 'warning'
      })

      await api.delete(`/articles/${article.id}`)
      ElMessage.success('删除成功')
      fetchArticles()
    } catch (error) {
      if (error !== 'cancel') {
        console.error('Failed to delete article:', error)
      }
    }
  }
}

const toggleSelect = (id) => {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(id)
  }
}

const getScoreType = (score) => {
  if (score >= 70) return 'success'
  if (score >= 50) return 'warning'
  return 'danger'
}

const batchScore = async () => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请先选择要评分的文章')
    return
  }

  scoring.value = true
  try {
    const res = await api.post('/ai/score/batch', { article_ids: selectedIds.value })
    if (res.success) {
      ElMessage.success(`批量评分任务已启动，共 ${res.data.total} 篇文章`)
      // 轮询进度
      pollBatchProgress(res.data.taskId)
    }
  } catch (error) {
    scoring.value = false
  }
}

const pollBatchProgress = async (taskId) => {
  const poll = async () => {
    try {
      const res = await api.get(`/ai/score/batch/${taskId}`)
      if (res.success) {
        const { status, completed, total, failed } = res.data
        if (status === 'completed') {
          scoring.value = false
          selectedIds.value = []
          ElMessage.success(`评分完成！成功 ${completed} 篇，失败 ${failed} 篇`)
          fetchArticles()
        } else if (status === 'error') {
          scoring.value = false
          ElMessage.error('评分任务出错')
        } else {
          // 继续轮询
          setTimeout(poll, 2000)
        }
      }
    } catch (error) {
      scoring.value = false
    }
  }
  poll()
}

watch(categoryId, () => {
  pagination.value.page = 1
  fetchArticles()
})

onMounted(() => {
  fetchArticles()
  fetchCategories()
  fetchRssSources()
})
</script>

<style lang="scss" scoped>
.filter-card {
  margin-bottom: 20px;
}

.article-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.article-card {
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }

  &.is-read {
    opacity: 0.7;

    .article-title a {
      color: #909399;
    }
  }

  &.is-selected {
    border-color: #409EFF;
    background: #ecf5ff;
  }

  .article-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;

    .article-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: #909399;

      .category-tag {
        margin-right: 0;
      }

      .source {
        font-weight: 500;
        color: #606266;
      }

      .score-tag {
        margin-left: 5px;
      }
    }

    .more-btn {
      cursor: pointer;
      padding: 5px;
      border-radius: 4px;

      &:hover {
        background: #f5f7fa;
      }
    }
  }

  .article-title {
    margin: 0 0 10px;
    font-size: 18px;
    line-height: 1.4;

    a {
      color: #303133;
      text-decoration: none;

      &:hover {
        color: #409EFF;
      }
    }
  }

  .article-description {
    margin: 0 0 15px;
    color: #606266;
    font-size: 14px;
    line-height: 1.6;
  }

  .article-footer {
    .read-more {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #409EFF;
      font-size: 14px;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
</style>
