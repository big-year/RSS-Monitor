<template>
  <div class="page-container">
    <div class="page-header">
      <h2>提示词管理</h2>
      <el-button type="primary" @click="showAddDialog">
        <el-icon><Plus /></el-icon>
        新建提示词
      </el-button>
    </div>

    <!-- 提示词列表 -->
    <el-row :gutter="20" v-loading="loading">
      <el-col :span="12" v-for="prompt in prompts" :key="prompt.id">
        <el-card class="prompt-card">
          <template #header>
            <div class="card-header">
              <div class="prompt-info">
                <span class="prompt-name">{{ prompt.name }}</span>
                <el-tag v-if="prompt.is_default" type="success" size="small">默认</el-tag>
              </div>
              <el-tag size="small">{{ getTypeLabel(prompt.prompt_type) }}</el-tag>
            </div>
          </template>
          <div class="prompt-content">
            <pre>{{ truncateContent(prompt.content) }}</pre>
          </div>
          <div class="card-actions">
            <el-button type="primary" size="small" @click="showEditDialog(prompt)">
              编辑
            </el-button>
            <el-button size="small" @click="previewPrompt(prompt)">
              预览
            </el-button>
            <el-button
              v-if="!prompt.is_default"
              type="success"
              size="small"
              @click="setDefault(prompt)"
            >
              设为默认
            </el-button>
            <el-button type="danger" size="small" @click="deletePrompt(prompt)">
              删除
            </el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="24" v-if="prompts.length === 0 && !loading">
        <el-empty description="暂无提示词，点击上方按钮创建" />
      </el-col>
    </el-row>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingPrompt ? '编辑提示词' : '新建提示词'"
      width="700px"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="如：科技文章评分" />
        </el-form-item>
        <el-form-item label="类型" prop="prompt_type">
          <el-select v-model="form.prompt_type" placeholder="选择类型">
            <el-option label="文章评分" value="scoring" />
          </el-select>
        </el-form-item>
        <el-form-item label="提示词内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="15"
            placeholder="输入提示词内容，可使用变量：{title}、{description}、{source}"
          />
          <div class="form-tip">
            可用变量：<el-tag size="small">{title}</el-tag> 文章标题、
            <el-tag size="small">{description}</el-tag> 文章摘要、
            <el-tag size="small">{source}</el-tag> 来源名称
          </div>
        </el-form-item>
        <el-form-item label="设为默认">
          <el-switch v-model="form.is_default" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">保存</el-button>
      </template>
    </el-dialog>

    <!-- 预览对话框 -->
    <el-dialog v-model="previewDialogVisible" title="提示词预览" width="700px">
      <el-alert type="info" :closable="false" style="margin-bottom: 15px;">
        以下是将变量替换为示例内容后的提示词效果
      </el-alert>
      <pre class="preview-content">{{ previewContent }}</pre>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'

const loading = ref(false)
const submitting = ref(false)
const prompts = ref([])
const dialogVisible = ref(false)
const previewDialogVisible = ref(false)
const editingPrompt = ref(null)
const formRef = ref(null)
const previewContent = ref('')

const defaultForm = {
  name: '',
  prompt_type: 'scoring',
  content: `你是一个文章质量评估助手。请对以下文章进行质量评分（0-100分）。

评分标准：
- 90-100分：重大新闻、深度分析、行业突破、独家报道
- 70-89分：有价值的资讯、实用教程、专业见解
- 50-69分：一般性内容、常规更新、普通新闻
- 30-49分：价值较低、内容空洞、标题党
- 0-29分：广告软文、重复内容、无意义信息

文章标题：{title}
文章摘要：{description}
文章来源：{source}

请只返回一个0-100之间的整数分数，不要返回任何其他内容。`,
  is_default: false
}

const form = ref({ ...defaultForm })

const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  prompt_type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  content: [{ required: true, message: '请输入提示词内容', trigger: 'blur' }]
}

const getTypeLabel = (type) => {
  const labels = { scoring: '文章评分' }
  return labels[type] || type
}

const truncateContent = (content) => {
  if (content.length > 200) {
    return content.substring(0, 200) + '...'
  }
  return content
}

const fetchPrompts = async () => {
  loading.value = true
  try {
    const res = await api.get('/ai/prompts')
    if (res.success) {
      prompts.value = res.data
    }
  } catch (error) {
    console.error('Failed to fetch prompts:', error)
  } finally {
    loading.value = false
  }
}

const showAddDialog = () => {
  editingPrompt.value = null
  form.value = { ...defaultForm }
  dialogVisible.value = true
}

const showEditDialog = (prompt) => {
  editingPrompt.value = prompt
  form.value = { ...prompt }
  dialogVisible.value = true
}

const previewPrompt = (prompt) => {
  previewContent.value = prompt.content
    .replace('{title}', '【示例】OpenAI发布GPT-5，性能提升10倍')
    .replace('{description}', '今日，OpenAI正式发布了新一代大语言模型GPT-5，据称在推理能力、代码生成、多模态理解等方面都有显著提升...')
    .replace('{source}', '科技日报')
  previewDialogVisible.value = true
}

const submitForm = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    let res
    if (editingPrompt.value) {
      res = await api.put(`/ai/prompts/${editingPrompt.value.id}`, form.value)
    } else {
      res = await api.post('/ai/prompts', form.value)
    }

    if (res.success) {
      ElMessage.success(res.message)
      dialogVisible.value = false
      fetchPrompts()
    }
  } catch (error) {
    // Error handled by interceptor
  } finally {
    submitting.value = false
  }
}

const setDefault = async (prompt) => {
  try {
    const res = await api.put(`/ai/prompts/${prompt.id}`, { is_default: true })
    if (res.success) {
      ElMessage.success('已设为默认')
      fetchPrompts()
    }
  } catch (error) {
    // Error handled by interceptor
  }
}

const deletePrompt = async (prompt) => {
  try {
    await ElMessageBox.confirm(`确定要删除 "${prompt.name}" 吗？`, '确认删除', {
      type: 'warning'
    })

    const res = await api.delete(`/ai/prompts/${prompt.id}`)
    if (res.success) {
      ElMessage.success(res.message)
      fetchPrompts()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete prompt:', error)
    }
  }
}

onMounted(() => {
  fetchPrompts()
})
</script>

<style lang="scss" scoped>
.prompt-card {
  margin-bottom: 20px;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .prompt-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .prompt-name {
    font-weight: 600;
  }

  .prompt-content {
    pre {
      margin: 0;
      padding: 12px;
      background: #f5f7fa;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 150px;
      overflow-y: auto;
    }
  }

  .card-actions {
    margin-top: 15px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
}

.form-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;

  .el-tag {
    margin: 0 4px;
  }
}

.preview-content {
  padding: 15px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow-y: auto;
}
</style>
