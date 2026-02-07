<template>
  <div class="page-container">
    <div class="page-header">
      <h2>RSS源管理</h2>
      <div class="header-actions">
        <el-button @click="showTestDialog">
          <el-icon><Link /></el-icon>
          测试RSS
        </el-button>
        <el-button type="primary" @click="showAddDialog">
          <el-icon><Plus /></el-icon>
          添加RSS源
        </el-button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <el-card class="filter-card">
      <el-row :gutter="20">
        <el-col :span="8">
          <el-input
            v-model="filters.search"
            placeholder="搜索RSS源名称或描述"
            clearable
            @clear="fetchRssSources"
            @keyup.enter="fetchRssSources"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </el-col>
        <el-col :span="6">
          <el-select v-model="filters.category_id" placeholder="选择板块" clearable @change="fetchRssSources">
            <el-option
              v-for="cat in categories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select v-model="filters.is_active" placeholder="状态" clearable @change="fetchRssSources">
            <el-option label="启用" value="true" />
            <el-option label="禁用" value="false" />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-button @click="fetchRssSources">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 批量操作 -->
    <div v-if="selectedIds.length > 0" class="batch-actions">
      <span>已选择 {{ selectedIds.length }} 项</span>
      <el-button size="small" @click="batchToggle(true)">批量启用</el-button>
      <el-button size="small" @click="batchToggle(false)">批量禁用</el-button>
      <el-button size="small" type="danger" @click="batchDelete">批量删除</el-button>
    </div>

    <!-- RSS源列表 -->
    <el-card>
      <el-table
        :data="rssSources"
        v-loading="loading"
        @selection-change="handleSelectionChange"
        style="width: 100%"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="name" label="名称" min-width="150">
          <template #default="{ row }">
            <div class="source-name">
              <span class="status-dot" :class="row.is_active ? 'active' : 'inactive'"></span>
              {{ row.name }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="rss_url" label="RSS地址" min-width="200">
          <template #default="{ row }">
            <el-tooltip :content="row.rss_url" placement="top">
              <span class="url-text">{{ row.rss_url }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="categories" label="板块" width="180">
          <template #default="{ row }">
            <el-tag
              v-for="cat in row.categories"
              :key="cat.id"
              :color="cat.color"
              size="small"
              class="category-tag"
              effect="dark"
            >
              {{ cat.name }}
            </el-tag>
            <span v-if="!row.categories?.length" class="no-category">未分类</span>
          </template>
        </el-table-column>
        <el-table-column prop="article_count" label="文章数" width="80" align="center" />
        <el-table-column prop="update_interval" label="更新间隔" width="100" align="center">
          <template #default="{ row }">
            {{ row.update_interval }}分钟
          </template>
        </el-table-column>
        <el-table-column prop="last_fetch_time" label="最后抓取" width="160">
          <template #default="{ row }">
            {{ row.last_fetch_time ? formatTime(row.last_fetch_time) : '从未' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="fetchNow(row)">
              抓取
            </el-button>
            <el-button text type="primary" size="small" @click="showEditDialog(row)">
              编辑
            </el-button>
            <el-button text type="danger" size="small" @click="deleteSource(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingSource ? '编辑RSS源' : '添加RSS源'"
      width="600px"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="RSS源名称" />
        </el-form-item>
        <el-form-item label="RSS地址" prop="rss_url">
          <el-input v-model="form.rss_url" placeholder="https://example.com/feed.xml" />
        </el-form-item>
        <el-form-item label="网站地址">
          <el-input v-model="form.site_url" placeholder="https://example.com" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="RSS源描述" />
        </el-form-item>
        <el-form-item label="所属板块">
          <el-select v-model="form.category_ids" multiple placeholder="选择板块" style="width: 100%">
            <el-option
              v-for="cat in categories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="更新间隔">
          <el-input-number v-model="form.update_interval" :min="5" :max="1440" />
          <span style="margin-left: 10px; color: #909399;">分钟</span>
        </el-form-item>
        <el-form-item v-if="editingSource" label="状态">
          <el-switch v-model="form.is_active" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 测试RSS对话框 -->
    <el-dialog v-model="testDialogVisible" title="测试RSS源" width="700px">
      <el-form @submit.prevent="testRss">
        <el-form-item>
          <el-input
            v-model="testUrl"
            placeholder="输入RSS地址进行测试"
            clearable
          >
            <template #append>
              <el-button @click="testRss" :loading="testing">测试</el-button>
            </template>
          </el-input>
        </el-form-item>
      </el-form>

      <div v-if="testResult" class="test-result">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="标题">{{ testResult.title }}</el-descriptions-item>
          <el-descriptions-item label="条目数">{{ testResult.itemCount }}</el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">{{ testResult.description || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 15px 0 10px;">最新条目预览</h4>
        <el-table :data="testResult.items" size="small">
          <el-table-column prop="title" label="标题" />
          <el-table-column prop="pubDate" label="发布时间" width="180" />
        </el-table>

        <div style="margin-top: 15px; text-align: right;">
          <el-button type="primary" @click="useTestResult">使用此RSS源</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import api from '@/api'

const loading = ref(false)
const submitting = ref(false)
const testing = ref(false)
const rssSources = ref([])
const categories = ref([])
const selectedIds = ref([])
const dialogVisible = ref(false)
const testDialogVisible = ref(false)
const editingSource = ref(null)
const testUrl = ref('')
const testResult = ref(null)
const formRef = ref(null)

const filters = ref({
  search: '',
  category_id: '',
  is_active: ''
})

const form = ref({
  name: '',
  rss_url: '',
  site_url: '',
  description: '',
  category_ids: [],
  update_interval: 15,
  is_active: true
})

const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  rss_url: [
    { required: true, message: '请输入RSS地址', trigger: 'blur' },
    { type: 'url', message: '请输入有效的URL', trigger: 'blur' }
  ]
}

const formatTime = (time) => dayjs(time).format('YYYY-MM-DD HH:mm')

const fetchRssSources = async () => {
  loading.value = true
  try {
    const res = await api.get('/rss', { params: filters.value })
    if (res.success) {
      rssSources.value = res.data
    }
  } catch (error) {
    console.error('Failed to fetch RSS sources:', error)
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

const resetFilters = () => {
  filters.value = { search: '', category_id: '', is_active: '' }
  fetchRssSources()
}

const handleSelectionChange = (selection) => {
  selectedIds.value = selection.map(item => item.id)
}

const showAddDialog = () => {
  editingSource.value = null
  form.value = {
    name: '',
    rss_url: '',
    site_url: '',
    description: '',
    category_ids: [],
    update_interval: 15,
    is_active: true
  }
  dialogVisible.value = true
}

const showEditDialog = (source) => {
  editingSource.value = source
  form.value = {
    name: source.name,
    rss_url: source.rss_url,
    site_url: source.site_url || '',
    description: source.description || '',
    category_ids: source.categories?.map(c => c.id) || [],
    update_interval: source.update_interval,
    is_active: source.is_active
  }
  dialogVisible.value = true
}

const submitForm = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    let res
    if (editingSource.value) {
      res = await api.put(`/rss/${editingSource.value.id}`, form.value)
    } else {
      res = await api.post('/rss', form.value)
    }

    if (res.success) {
      ElMessage.success(res.message)
      dialogVisible.value = false
      fetchRssSources()
    }
  } catch (error) {
    // Error handled by interceptor
  } finally {
    submitting.value = false
  }
}

const deleteSource = async (source) => {
  try {
    await ElMessageBox.confirm(`确定要删除 "${source.name}" 吗？`, '确认删除', {
      type: 'warning'
    })

    const res = await api.delete(`/rss/${source.id}`)
    if (res.success) {
      ElMessage.success(res.message)
      fetchRssSources()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete source:', error)
    }
  }
}

const fetchNow = async (source) => {
  try {
    ElMessage.info(`正在抓取 ${source.name}...`)
    const res = await api.post(`/rss/${source.id}/fetch`)
    if (res.success) {
      ElMessage.success(res.message)
      fetchRssSources()
    }
  } catch (error) {
    // Error handled by interceptor
  }
}

const batchToggle = async (isActive) => {
  try {
    const res = await api.post('/rss/batch/toggle', {
      ids: selectedIds.value,
      is_active: isActive
    })
    if (res.success) {
      ElMessage.success(res.message)
      fetchRssSources()
    }
  } catch (error) {
    // Error handled by interceptor
  }
}

const batchDelete = async () => {
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedIds.value.length} 个RSS源吗？`, '确认删除', {
      type: 'warning'
    })

    const res = await api.post('/rss/batch/delete', { ids: selectedIds.value })
    if (res.success) {
      ElMessage.success(res.message)
      fetchRssSources()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to batch delete:', error)
    }
  }
}

const showTestDialog = () => {
  testUrl.value = ''
  testResult.value = null
  testDialogVisible.value = true
}

const testRss = async () => {
  if (!testUrl.value) {
    ElMessage.warning('请输入RSS地址')
    return
  }

  testing.value = true
  testResult.value = null
  try {
    const res = await api.post('/rss/test', { rss_url: testUrl.value })
    if (res.success) {
      testResult.value = res.data
      ElMessage.success('RSS源有效')
    }
  } catch (error) {
    // Error handled by interceptor
  } finally {
    testing.value = false
  }
}

const useTestResult = () => {
  if (!testResult.value) return

  testDialogVisible.value = false
  form.value = {
    name: testResult.value.title || '',
    rss_url: testUrl.value,
    site_url: testResult.value.link || '',
    description: testResult.value.description || '',
    category_ids: [],
    update_interval: 15,
    is_active: true
  }
  dialogVisible.value = true
}

onMounted(() => {
  fetchRssSources()
  fetchCategories()
})
</script>

<style lang="scss" scoped>
.header-actions {
  display: flex;
  gap: 10px;
}

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

.source-name {
  display: flex;
  align-items: center;
}

.url-text {
  display: block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #909399;
  font-size: 13px;
}

.category-tag {
  margin-right: 4px;
  margin-bottom: 2px;
}

.no-category {
  color: #c0c4cc;
  font-size: 13px;
}

.test-result {
  margin-top: 20px;
}
</style>
