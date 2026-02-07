<template>
  <div class="page-container">
    <div class="page-header">
      <h2>板块管理</h2>
      <el-button type="primary" @click="showAddDialog">
        <el-icon><Plus /></el-icon>
        添加板块
      </el-button>
    </div>

    <!-- 板块卡片 -->
    <el-row :gutter="20" v-loading="loading">
      <el-col :span="6" v-for="category in categories" :key="category.id">
        <el-card class="category-card" :body-style="{ padding: '0' }">
          <div class="card-header" :style="{ background: category.color }">
            <el-icon size="32"><component :is="category.icon || 'Folder'" /></el-icon>
            <h3>{{ category.name }}</h3>
          </div>
          <div class="card-body">
            <p class="description">{{ category.description || '暂无描述' }}</p>
            <div class="stats">
              <div class="stat-item">
                <span class="value">{{ category.rss_count || 0 }}</span>
                <span class="label">RSS源</span>
              </div>
              <div class="stat-item">
                <span class="value">{{ category.article_count || 0 }}</span>
                <span class="label">文章</span>
              </div>
            </div>
          </div>
          <div class="card-footer">
            <el-button text type="primary" @click="$router.push(`/articles/category/${category.id}`)">
              查看内容
            </el-button>
            <el-button text type="primary" @click="showEditDialog(category)">
              编辑
            </el-button>
            <el-button text type="danger" @click="deleteCategory(category)">
              删除
            </el-button>
          </div>
        </el-card>
      </el-col>

      <!-- 空状态 -->
      <el-col :span="24" v-if="categories.length === 0 && !loading">
        <el-empty description="暂无板块，点击上方按钮添加" />
      </el-col>
    </el-row>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingCategory ? '编辑板块' : '添加板块'"
      width="500px"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="板块名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="板块描述" />
        </el-form-item>
        <el-form-item label="图标">
          <el-select v-model="form.icon" placeholder="选择图标" clearable style="width: 100%">
            <el-option
              v-for="icon in iconOptions"
              :key="icon"
              :label="icon"
              :value="icon"
            >
              <el-icon><component :is="icon" /></el-icon>
              <span style="margin-left: 10px;">{{ icon }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="颜色">
          <el-color-picker v-model="form.color" />
          <span style="margin-left: 10px; color: #909399;">{{ form.color }}</span>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort_order" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'

const loading = ref(false)
const submitting = ref(false)
const categories = ref([])
const dialogVisible = ref(false)
const editingCategory = ref(null)
const formRef = ref(null)

const iconOptions = [
  'Monitor', 'TrendCharts', 'Document', 'VideoCamera', 'Trophy',
  'Folder', 'Star', 'Flag', 'Bell', 'Calendar', 'Camera', 'ChatDotRound',
  'Coin', 'CreditCard', 'DataAnalysis', 'Files', 'Film', 'Football',
  'Goods', 'Headset', 'House', 'Location', 'Microphone', 'Moon',
  'Notification', 'Picture', 'Platform', 'Reading', 'School', 'Ship',
  'ShoppingCart', 'Sunny', 'Ticket', 'Timer', 'TrendCharts', 'User'
]

const form = ref({
  name: '',
  description: '',
  icon: '',
  color: '#409EFF',
  sort_order: 0
})

const rules = {
  name: [{ required: true, message: '请输入板块名称', trigger: 'blur' }]
}

const fetchCategories = async () => {
  loading.value = true
  try {
    const res = await api.get('/categories')
    if (res.success) {
      categories.value = res.data
    }
  } catch (error) {
    console.error('Failed to fetch categories:', error)
  } finally {
    loading.value = false
  }
}

const showAddDialog = () => {
  editingCategory.value = null
  form.value = {
    name: '',
    description: '',
    icon: '',
    color: '#409EFF',
    sort_order: 0
  }
  dialogVisible.value = true
}

const showEditDialog = (category) => {
  editingCategory.value = category
  form.value = {
    name: category.name,
    description: category.description || '',
    icon: category.icon || '',
    color: category.color || '#409EFF',
    sort_order: category.sort_order || 0
  }
  dialogVisible.value = true
}

const submitForm = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    let res
    if (editingCategory.value) {
      res = await api.put(`/categories/${editingCategory.value.id}`, form.value)
    } else {
      res = await api.post('/categories', form.value)
    }

    if (res.success) {
      ElMessage.success(res.message)
      dialogVisible.value = false
      fetchCategories()
    }
  } catch (error) {
    // Error handled by interceptor
  } finally {
    submitting.value = false
  }
}

const deleteCategory = async (category) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除板块 "${category.name}" 吗？删除后该板块下的RSS源将变为未分类。`,
      '确认删除',
      { type: 'warning' }
    )

    const res = await api.delete(`/categories/${category.id}`)
    if (res.success) {
      ElMessage.success(res.message)
      fetchCategories()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete category:', error)
    }
  }
}

onMounted(() => {
  fetchCategories()
})
</script>

<style lang="scss" scoped>
.category-card {
  margin-bottom: 20px;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  .card-header {
    padding: 20px;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 12px;

    h3 {
      margin: 0;
      font-size: 18px;
    }
  }

  .card-body {
    padding: 15px 20px;

    .description {
      color: #606266;
      font-size: 14px;
      margin: 0 0 15px;
      min-height: 40px;
    }

    .stats {
      display: flex;
      gap: 30px;

      .stat-item {
        .value {
          display: block;
          font-size: 24px;
          font-weight: 600;
          color: #303133;
        }

        .label {
          font-size: 12px;
          color: #909399;
        }
      }
    }
  }

  .card-footer {
    padding: 10px 15px;
    border-top: 1px solid #ebeef5;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
