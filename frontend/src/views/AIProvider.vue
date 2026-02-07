<template>
  <div class="page-container">
    <div class="page-header">
      <h2>AI 提供商管理</h2>
      <el-button type="primary" @click="showAddDialog">
        <el-icon><Plus /></el-icon>
        添加提供商
      </el-button>
    </div>

    <!-- 提供商列表 -->
    <el-row :gutter="20" v-loading="loading">
      <el-col :span="8" v-for="provider in providers" :key="provider.id">
        <el-card class="provider-card" :class="{ active: provider.is_active }">
          <template #header>
            <div class="card-header">
              <div class="provider-info">
                <span class="provider-icon">{{ getProviderIcon(provider.provider_type) }}</span>
                <span class="provider-name">{{ provider.name }}</span>
              </div>
              <el-tag :type="provider.is_active ? 'success' : 'info'" size="small">
                {{ provider.is_active ? '已启用' : '未启用' }}
              </el-tag>
            </div>
          </template>
          <div class="card-content">
            <p><strong>类型：</strong>{{ getProviderLabel(provider.provider_type) }}</p>
            <p><strong>模型：</strong>{{ provider.model }}</p>
            <p><strong>API Key：</strong>{{ provider.api_key_masked || '未配置' }}</p>
          </div>
          <div class="card-actions">
            <el-button
              :type="provider.is_active ? 'warning' : 'success'"
              size="small"
              @click="toggleProvider(provider)"
            >
              {{ provider.is_active ? '禁用' : '启用' }}
            </el-button>
            <el-button size="small" @click="testProvider(provider)" :loading="testing === provider.id">
              测试
            </el-button>
            <el-button type="primary" size="small" @click="showEditDialog(provider)">
              编辑
            </el-button>
            <el-button type="danger" size="small" @click="deleteProvider(provider)">
              删除
            </el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="24" v-if="providers.length === 0 && !loading">
        <el-empty description="暂无AI提供商，点击上方按钮添加" />
      </el-col>
    </el-row>

    <!-- 系统设置 -->
    <el-card class="settings-card">
      <template #header>
        <span>AI 评分设置</span>
      </template>
      <el-form :model="settings" label-width="180px">
        <el-form-item label="启用AI自动评分">
          <el-switch v-model="settings.ai_scoring_enabled" @change="saveSettings" />
          <span class="form-tip">开启后，新抓取的文章会自动进行AI评分</span>
        </el-form-item>
        <el-form-item label="推送最低评分">
          <el-slider
            v-model="settings.ai_score_threshold"
            :min="0"
            :max="100"
            :step="5"
            show-input
            style="max-width: 400px;"
            @change="saveSettings"
          />
          <span class="form-tip">只有评分达到此阈值的文章才会被推送</span>
        </el-form-item>
        <el-form-item label="每次推送最大文章数">
          <el-input-number
            v-model="settings.max_articles_per_push"
            :min="5"
            :max="100"
            @change="saveSettings"
          />
          <span class="form-tip">汇总推送时每封邮件最多包含的文章数</span>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingProvider ? '编辑提供商' : '添加提供商'"
      width="500px"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="如：我的OpenAI" />
        </el-form-item>
        <el-form-item label="提供商类型" prop="provider_type">
          <el-select v-model="form.provider_type" placeholder="选择类型" @change="onProviderTypeChange">
            <el-option label="OpenAI" value="openai" />
            <el-option label="Claude" value="claude" />
            <el-option label="DeepSeek" value="deepseek" />
            <el-option label="智谱GLM" value="glm" />
            <el-option label="通义千问" value="qwen" />
            <el-option label="Moonshot" value="moonshot" />
            <el-option label="其他(OpenAI兼容)" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="API Base URL" prop="api_base_url">
          <el-input v-model="form.api_base_url" placeholder="https://api.openai.com/v1" />
        </el-form-item>
        <el-form-item label="API Key" prop="api_key">
          <el-input
            v-model="form.api_key"
            type="password"
            show-password
            placeholder="输入API Key"
          />
        </el-form-item>
        <el-form-item label="模型" prop="model">
          <el-input v-model="form.model" placeholder="如：gpt-3.5-turbo" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'

const loading = ref(false)
const submitting = ref(false)
const testing = ref(null)
const providers = ref([])
const dialogVisible = ref(false)
const editingProvider = ref(null)
const formRef = ref(null)

const settings = reactive({
  ai_scoring_enabled: false,
  ai_score_threshold: 60,
  max_articles_per_push: 20
})

const defaultForm = {
  name: '',
  provider_type: 'openai',
  api_key: '',
  api_base_url: 'https://api.openai.com/v1',
  model: 'gpt-3.5-turbo'
}

const form = ref({ ...defaultForm })

const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  provider_type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  api_base_url: [{ required: true, message: '请输入API地址', trigger: 'blur' }],
  model: [{ required: true, message: '请输入模型名称', trigger: 'blur' }]
}

const providerDefaults = {
  openai: { url: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo' },
  claude: { url: 'https://api.anthropic.com/v1', model: 'claude-3-haiku-20240307' },
  deepseek: { url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  glm: { url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  qwen: { url: 'https://dashscope.aliyuncs.com/api/v1', model: 'qwen-turbo' },
  moonshot: { url: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  other: { url: '', model: '' }
}

const getProviderIcon = (type) => {
  const icons = {
    openai: '🤖',
    claude: '🧠',
    deepseek: '🔍',
    glm: '📚',
    qwen: '☁️',
    moonshot: '🌙'
  }
  return icons[type] || '🤖'
}

const getProviderLabel = (type) => {
  const labels = {
    openai: 'OpenAI',
    claude: 'Claude',
    deepseek: 'DeepSeek',
    glm: '智谱GLM',
    qwen: '通义千问',
    moonshot: 'Moonshot'
  }
  return labels[type] || type
}

const fetchProviders = async () => {
  loading.value = true
  try {
    const res = await api.get('/ai/providers')
    if (res.success) {
      providers.value = res.data
    }
  } catch (error) {
    console.error('Failed to fetch providers:', error)
  } finally {
    loading.value = false
  }
}

const fetchSettings = async () => {
  try {
    const res = await api.get('/ai/settings')
    if (res.success) {
      res.data.forEach(item => {
        if (item.key === 'ai_scoring_enabled') {
          settings.ai_scoring_enabled = item.value === 'true'
        } else if (item.key === 'ai_score_threshold') {
          settings.ai_score_threshold = parseInt(item.value) || 60
        } else if (item.key === 'max_articles_per_push') {
          settings.max_articles_per_push = parseInt(item.value) || 20
        }
      })
    }
  } catch (error) {
    console.error('Failed to fetch settings:', error)
  }
}

const saveSettings = async () => {
  try {
    await api.put('/ai/settings', {
      ai_scoring_enabled: settings.ai_scoring_enabled.toString(),
      ai_score_threshold: settings.ai_score_threshold.toString(),
      max_articles_per_push: settings.max_articles_per_push.toString()
    })
    ElMessage.success('设置已保存')
  } catch (error) {
    console.error('Failed to save settings:', error)
  }
}

const showAddDialog = () => {
  editingProvider.value = null
  form.value = { ...defaultForm }
  dialogVisible.value = true
}

const showEditDialog = (provider) => {
  editingProvider.value = provider
  form.value = {
    name: provider.name,
    provider_type: provider.provider_type,
    api_key: provider.api_key_masked || '',
    api_base_url: provider.api_base_url,
    model: provider.model
  }
  dialogVisible.value = true
}

const onProviderTypeChange = (type) => {
  const defaults = providerDefaults[type]
  if (defaults) {
    form.value.api_base_url = defaults.url
    form.value.model = defaults.model
  }
}

const submitForm = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    let res
    if (editingProvider.value) {
      res = await api.put(`/ai/providers/${editingProvider.value.id}`, form.value)
    } else {
      res = await api.post('/ai/providers', form.value)
    }

    if (res.success) {
      ElMessage.success(res.message)
      dialogVisible.value = false
      fetchProviders()
    }
  } catch (error) {
    // Error handled by interceptor
  } finally {
    submitting.value = false
  }
}

const toggleProvider = async (provider) => {
  try {
    const res = await api.put(`/ai/providers/${provider.id}`, {
      is_active: !provider.is_active
    })
    if (res.success) {
      ElMessage.success(provider.is_active ? '已禁用' : '已启用')
      fetchProviders()
    }
  } catch (error) {
    // Error handled by interceptor
  }
}

const testProvider = async (provider) => {
  testing.value = provider.id
  try {
    const res = await api.post(`/ai/providers/${provider.id}/test`)
    if (res.success) {
      ElMessage.success(`连接成功！AI回复: ${res.data.response}`)
    }
  } catch (error) {
    // Error handled by interceptor
  } finally {
    testing.value = null
  }
}

const deleteProvider = async (provider) => {
  try {
    await ElMessageBox.confirm(`确定要删除 "${provider.name}" 吗？`, '确认删除', {
      type: 'warning'
    })

    const res = await api.delete(`/ai/providers/${provider.id}`)
    if (res.success) {
      ElMessage.success(res.message)
      fetchProviders()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete provider:', error)
    }
  }
}

onMounted(() => {
  fetchProviders()
  fetchSettings()
})
</script>

<style lang="scss" scoped>
.provider-card {
  margin-bottom: 20px;
  transition: all 0.3s;

  &.active {
    border-color: #67c23a;
    box-shadow: 0 0 10px rgba(103, 194, 58, 0.3);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .provider-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .provider-icon {
    font-size: 20px;
  }

  .provider-name {
    font-weight: 600;
  }

  .card-content {
    p {
      margin: 8px 0;
      font-size: 14px;
      color: #606266;
    }
  }

  .card-actions {
    margin-top: 15px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
}

.settings-card {
  margin-top: 20px;

  .form-tip {
    margin-left: 10px;
    font-size: 12px;
    color: #909399;
  }
}
</style>
