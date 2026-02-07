<template>
  <div class="page-container">
    <div class="page-header">
      <h2>订阅者管理</h2>
      <el-button type="primary" @click="showAddDialog">
        <el-icon><Plus /></el-icon>
        添加订阅者
      </el-button>
    </div>

    <!-- 搜索 -->
    <el-card class="filter-card">
      <el-row :gutter="20">
        <el-col :span="8">
          <el-input
            v-model="filters.search"
            placeholder="搜索邮箱或名称"
            clearable
            @clear="fetchSubscribers"
            @keyup.enter="fetchSubscribers"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </el-col>
        <el-col :span="4">
          <el-select v-model="filters.is_active" placeholder="状态" clearable @change="fetchSubscribers">
            <el-option label="启用" value="true" />
            <el-option label="禁用" value="false" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-button @click="fetchSubscribers">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 批量操作 -->
    <div v-if="selectedIds.length > 0" class="batch-actions">
      <span>已选择 {{ selectedIds.length }} 项</span>
      <el-button size="small" @click="batchToggle(true)">批量启用</el-button>
      <el-button size="small" @click="batchToggle(false)">批量禁用</el-button>
    </div>

    <!-- 订阅者列表 -->
    <el-card>
      <el-table
        :data="subscribers"
        v-loading="loading"
        @selection-change="handleSelectionChange"
        style="width: 100%"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="email" label="邮箱" min-width="200">
          <template #default="{ row }">
            <div class="subscriber-info">
              <span class="status-dot" :class="row.is_active ? 'active' : 'inactive'"></span>
              <span>{{ row.email }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" width="120">
          <template #default="{ row }">
            {{ row.name || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="categories" label="订阅板块" min-width="200">
          <template #default="{ row }">
            <el-tag
              v-for="cat in row.categories"
              :key="cat.id"
              :color="cat.color"
              size="small"
              effect="dark"
              class="category-tag"
            >
              {{ cat.name }}
            </el-tag>
            <span v-if="!row.categories?.length" class="no-category">未订阅任何板块</span>
          </template>
        </el-table-column>
        <el-table-column prop="push_frequency" label="推送频率" width="100">
          <template #default="{ row }">
            <el-tag :type="getFrequencyType(row.push_frequency)" size="small">
              {{ getFrequencyLabel(row.push_frequency) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="push_count" label="推送次数" width="100" align="center" />
        <el-table-column prop="last_push_time" label="最后推送" width="160">
          <template #default="{ row }">
            {{ row.last_push_time ? formatTime(row.last_push_time) : '从未' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button text type="warning" size="small" @click="showScheduledPushDialog(row)">
              一键推送
            </el-button>
            <el-button text type="success" size="small" @click="showPushDialog(row)">
              测试推送
            </el-button>
            <el-button text type="primary" size="small" @click="showEditDialog(row)">
              编辑
            </el-button>
            <el-button text type="danger" size="small" @click="deleteSubscriber(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingSubscriber ? '编辑订阅者' : '添加订阅者'"
      width="500px"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="订阅者邮箱" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="订阅者名称（可选）" />
        </el-form-item>
        <el-form-item label="订阅板块" prop="category_ids">
          <el-select v-model="form.category_ids" multiple placeholder="选择要订阅的板块" style="width: 100%">
            <el-option
              v-for="cat in categories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="推送频率">
          <el-radio-group v-model="form.push_frequency">
            <el-radio value="realtime">实时推送</el-radio>
            <el-radio value="hourly">每小时</el-radio>
            <el-radio value="daily">每天</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="editingSubscriber" label="状态">
          <el-switch v-model="form.is_active" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 手动推送对话框 -->
    <el-dialog v-model="pushDialogVisible" title="手动推送测试" width="600px">
      <el-form :model="pushForm" label-width="100px">
        <el-form-item label="订阅者">
          <el-tag>{{ pushingSubscriber?.email }}</el-tag>
        </el-form-item>
        <el-form-item label="推送类型">
          <el-radio-group v-model="pushForm.type">
            <el-radio value="single">单篇推送</el-radio>
            <el-radio value="digest">汇总推送</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="选择文章">
          <el-select
            v-model="pushForm.article_ids"
            :multiple="pushForm.type === 'digest'"
            placeholder="选择要推送的文章"
            style="width: 100%"
            filterable
            remote
            :remote-method="searchArticles"
            :loading="articlesLoading"
          >
            <el-option
              v-for="article in articleOptions"
              :key="article.id"
              :label="article.title"
              :value="article.id"
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 350px;">{{ article.title }}</span>
                <el-tag size="small" type="info">{{ article.source_name }}</el-tag>
              </div>
            </el-option>
          </el-select>
          <div class="form-tip">输入关键词搜索文章，汇总推送可选择多篇</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pushDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="sendTestPush" :loading="pushing">
          <el-icon><Promotion /></el-icon>
          发送推送
        </el-button>
      </template>
    </el-dialog>

    <!-- 一键推送对话框 -->
    <el-dialog v-model="scheduledPushDialogVisible" title="一键推送" width="700px">
      <el-alert type="info" :closable="false" style="margin-bottom: 15px;">
        模拟定时推送，将按照系统设置（AI评分阈值、最大文章数）推送待发送的文章
      </el-alert>

      <el-descriptions :column="2" border v-if="scheduledPushPreview">
        <el-descriptions-item label="订阅者">{{ scheduledPushPreview.subscriber?.email }}</el-descriptions-item>
        <el-descriptions-item label="推送频率">{{ getFrequencyLabel(scheduledPushPreview.subscriber?.push_frequency) }}</el-descriptions-item>
        <el-descriptions-item label="上次推送">{{ scheduledPushPreview.subscriber?.last_push_time ? formatTime(scheduledPushPreview.subscriber.last_push_time) : '从未' }}</el-descriptions-item>
        <el-descriptions-item label="AI评分">{{ scheduledPushPreview.settings?.ai_scoring_enabled ? `已启用 (≥${scheduledPushPreview.settings.score_threshold}分)` : '未启用' }}</el-descriptions-item>
        <el-descriptions-item label="待推送文章" :span="2">
          <el-tag type="success" size="large">{{ scheduledPushPreview.total }} 篇</el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <div v-if="scheduledPushPreview?.articles?.length > 0" style="margin-top: 15px;">
        <h4>文章列表：</h4>
        <el-table :data="scheduledPushPreview.articles" max-height="300" size="small">
          <el-table-column prop="title" label="标题" show-overflow-tooltip />
          <el-table-column prop="source_name" label="来源" width="120" />
          <el-table-column prop="ai_score" label="AI评分" width="80" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.ai_score !== null" :type="getScoreType(row.ai_score)" size="small">
                {{ row.ai_score }}
              </el-tag>
              <span v-else class="no-score">未评分</span>
            </template>
          </el-table-column>
          <el-table-column prop="pub_date" label="发布时间" width="150">
            <template #default="{ row }">
              {{ formatTime(row.pub_date) }}
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-empty v-else-if="scheduledPushPreview && scheduledPushPreview.total === 0" description="没有待推送的文章" />

      <template #footer>
        <el-button @click="scheduledPushDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          @click="sendScheduledPush"
          :loading="scheduledPushing"
          :disabled="!scheduledPushPreview || scheduledPushPreview.total === 0"
        >
          <el-icon><Promotion /></el-icon>
          确认推送 ({{ scheduledPushPreview?.total || 0 }} 篇)
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import api from '@/api'

const loading = ref(false)
const submitting = ref(false)
const subscribers = ref([])
const categories = ref([])
const selectedIds = ref([])
const dialogVisible = ref(false)
const editingSubscriber = ref(null)
const formRef = ref(null)

// 推送相关
const pushDialogVisible = ref(false)
const pushingSubscriber = ref(null)
const pushing = ref(false)
const articlesLoading = ref(false)
const articleOptions = ref([])
const pushForm = ref({
  type: 'single',
  article_ids: null
})

// 一键推送相关
const scheduledPushDialogVisible = ref(false)
const scheduledPushPreview = ref(null)
const scheduledPushing = ref(false)

const filters = ref({
  search: '',
  is_active: ''
})

const form = ref({
  email: '',
  name: '',
  category_ids: [],
  push_frequency: 'realtime',
  is_active: true
})

const rules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }
  ],
  category_ids: [
    { required: true, message: '请选择至少一个板块', trigger: 'change', type: 'array', min: 1 }
  ]
}

const formatTime = (time) => dayjs(time).format('YYYY-MM-DD HH:mm')

const getFrequencyLabel = (freq) => {
  const labels = { realtime: '实时', hourly: '每小时', daily: '每天' }
  return labels[freq] || freq
}

const getFrequencyType = (freq) => {
  const types = { realtime: 'danger', hourly: 'warning', daily: 'info' }
  return types[freq] || ''
}

const fetchSubscribers = async () => {
  loading.value = true
  try {
    const res = await api.get('/subscribers', { params: filters.value })
    if (res.success) {
      subscribers.value = res.data
    }
  } catch (error) {
    console.error('Failed to fetch subscribers:', error)
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

const handleSelectionChange = (selection) => {
  selectedIds.value = selection.map(item => item.id)
}

const showAddDialog = () => {
  editingSubscriber.value = null
  form.value = {
    email: '',
    name: '',
    category_ids: [],
    push_frequency: 'realtime',
    is_active: true
  }
  dialogVisible.value = true
}

const showEditDialog = (subscriber) => {
  editingSubscriber.value = subscriber
  form.value = {
    email: subscriber.email,
    name: subscriber.name || '',
    category_ids: subscriber.categories?.map(c => c.id) || [],
    push_frequency: subscriber.push_frequency,
    is_active: subscriber.is_active
  }
  dialogVisible.value = true
}

const submitForm = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    let res
    if (editingSubscriber.value) {
      res = await api.put(`/subscribers/${editingSubscriber.value.id}`, form.value)
    } else {
      res = await api.post('/subscribers', form.value)
    }

    if (res.success) {
      ElMessage.success(res.message)
      dialogVisible.value = false
      fetchSubscribers()
    }
  } catch (error) {
    // Error handled by interceptor
  } finally {
    submitting.value = false
  }
}

const deleteSubscriber = async (subscriber) => {
  try {
    await ElMessageBox.confirm(`确定要删除订阅者 "${subscriber.email}" 吗？`, '确认删除', {
      type: 'warning'
    })

    const res = await api.delete(`/subscribers/${subscriber.id}`)
    if (res.success) {
      ElMessage.success(res.message)
      fetchSubscribers()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete subscriber:', error)
    }
  }
}

const batchToggle = async (isActive) => {
  try {
    const res = await api.post('/subscribers/batch/toggle', {
      ids: selectedIds.value,
      is_active: isActive
    })
    if (res.success) {
      ElMessage.success(res.message)
      fetchSubscribers()
    }
  } catch (error) {
    // Error handled by interceptor
  }
}

// 推送相关方法
const showPushDialog = (subscriber) => {
  pushingSubscriber.value = subscriber
  pushForm.value = {
    type: 'single',
    article_ids: null
  }
  articleOptions.value = []
  pushDialogVisible.value = true
  // 加载最近文章
  searchArticles('')
}

const searchArticles = async (query) => {
  articlesLoading.value = true
  try {
    const res = await api.get('/articles', {
      params: {
        search: query,
        limit: 20
      }
    })
    if (res.success) {
      articleOptions.value = res.data.articles || res.data
    }
  } catch (error) {
    console.error('Failed to search articles:', error)
  } finally {
    articlesLoading.value = false
  }
}

const sendTestPush = async () => {
  if (!pushForm.value.article_ids ||
      (Array.isArray(pushForm.value.article_ids) && pushForm.value.article_ids.length === 0)) {
    ElMessage.warning('请选择要推送的文章')
    return
  }

  pushing.value = true
  try {
    const articleIds = Array.isArray(pushForm.value.article_ids)
      ? pushForm.value.article_ids
      : [pushForm.value.article_ids]

    const res = await api.post('/subscribers/push-test', {
      subscriber_id: pushingSubscriber.value.id,
      type: pushForm.value.type,
      article_ids: articleIds
    })

    if (res.success) {
      ElMessage.success('推送成功！请检查邮箱')
      pushDialogVisible.value = false
      fetchSubscribers()
    }
  } catch (error) {
    // Error handled by interceptor
  } finally {
    pushing.value = false
  }
}

// 监听推送类型变化，重置选择
watch(() => pushForm.value.type, (newType) => {
  pushForm.value.article_ids = newType === 'digest' ? [] : null
})

// 一键推送相关方法
const showScheduledPushDialog = async (subscriber) => {
  pushingSubscriber.value = subscriber
  scheduledPushPreview.value = null
  scheduledPushDialogVisible.value = true

  // 获取预览数据
  try {
    const res = await api.post('/subscribers/push-preview', {
      subscriber_id: subscriber.id
    })
    if (res.success) {
      scheduledPushPreview.value = res.data
    }
  } catch (error) {
    console.error('Failed to get push preview:', error)
  }
}

const sendScheduledPush = async () => {
  scheduledPushing.value = true
  try {
    const res = await api.post('/subscribers/push-scheduled', {
      subscriber_id: pushingSubscriber.value.id
    })

    if (res.success) {
      ElMessage.success(res.message)
      scheduledPushDialogVisible.value = false
      fetchSubscribers()
    }
  } catch (error) {
    // Error handled by interceptor
  } finally {
    scheduledPushing.value = false
  }
}

const getScoreType = (score) => {
  if (score >= 70) return 'success'
  if (score >= 50) return 'warning'
  return 'danger'
}

onMounted(() => {
  fetchSubscribers()
  fetchCategories()
})
</script>

<style lang="scss" scoped>
.filter-card {
  margin-bottom: 20px;
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 15px;
  background: #ecf5ff;
  border-radius: 4px;
  margin-bottom: 15px;
}

.subscriber-info {
  display: flex;
  align-items: center;
}

.category-tag {
  margin-right: 4px;
  margin-bottom: 2px;
}

.no-category {
  color: #c0c4cc;
  font-size: 13px;
}

.no-score {
  color: #c0c4cc;
  font-size: 12px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}
</style>
