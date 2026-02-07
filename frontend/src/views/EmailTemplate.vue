<template>
  <div class="page-container">
    <div class="page-header">
      <h2>推送模板</h2>
      <el-button type="primary" @click="showAddDialog">
        <el-icon><Plus /></el-icon>
        新建模板
      </el-button>
    </div>

    <!-- 模板列表 -->
    <el-row :gutter="20" v-loading="loading">
      <el-col :span="8" v-for="template in templates" :key="template.id">
        <el-card class="template-card" :body-style="{ padding: '0' }">
          <div class="card-preview" :style="{ background: `linear-gradient(135deg, ${template.header_bg_color} 0%, ${template.header_bg_color_end} 100%)` }">
            <el-tag :type="template.type === 'single' ? 'primary' : 'success'" size="small" class="type-tag">
              {{ template.type === 'single' ? '单篇推送' : '汇总推送' }}
            </el-tag>
            <div class="preview-title">{{ template.header_title }}</div>
            <el-tag v-if="template.is_default" type="warning" size="small" class="default-tag">默认</el-tag>
          </div>
          <div class="card-body">
            <h3>{{ template.name }}</h3>
            <p class="subject">主题: {{ template.subject }}</p>
            <div class="options">
              <el-tag size="small" :type="template.show_source ? '' : 'info'">来源</el-tag>
              <el-tag size="small" :type="template.show_date ? '' : 'info'">时间</el-tag>
              <el-tag size="small" :type="template.show_description ? '' : 'info'">摘要</el-tag>
            </div>
          </div>
          <div class="card-footer">
            <el-button text type="primary" @click="previewTemplate(template)">预览</el-button>
            <el-button text type="primary" @click="showEditDialog(template)">编辑</el-button>
            <el-button text type="danger" @click="deleteTemplate(template)">删除</el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="24" v-if="templates.length === 0 && !loading">
        <el-empty description="暂无模板，点击上方按钮创建" />
      </el-col>
    </el-row>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingTemplate ? '编辑模板' : '新建模板'"
      width="900px"
      top="5vh"
    >
      <el-row :gutter="20">
        <!-- 左侧表单 -->
        <el-col :span="12">
          <el-form :model="form" :rules="rules" ref="formRef" label-width="100px" size="default">
            <el-form-item label="模板名称" prop="name">
              <el-input v-model="form.name" placeholder="如：默认汇总模板" />
            </el-form-item>
            <el-form-item label="模板类型" prop="type">
              <el-radio-group v-model="form.type" @change="updatePreview">
                <el-radio value="single">单篇推送</el-radio>
                <el-radio value="digest">汇总推送</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="邮件主题" prop="subject">
              <el-input v-model="form.subject" placeholder="支持变量: {title}, {count}, {date}" />
            </el-form-item>

            <el-divider>头部样式</el-divider>

            <el-form-item label="标题文字">
              <el-input v-model="form.header_title" placeholder="RSS 订阅更新" @input="updatePreview" />
            </el-form-item>
            <el-form-item label="副标题">
              <el-input v-model="form.header_subtitle" placeholder="留空则自动生成" @input="updatePreview" />
            </el-form-item>
            <el-form-item label="渐变色">
              <div class="color-picker-row">
                <el-color-picker v-model="form.header_bg_color" @change="updatePreview" />
                <span class="color-arrow">→</span>
                <el-color-picker v-model="form.header_bg_color_end" @change="updatePreview" />
              </div>
            </el-form-item>

            <el-divider>内容设置</el-divider>

            <el-form-item label="显示选项">
              <el-checkbox v-model="form.show_source" @change="updatePreview">显示来源</el-checkbox>
              <el-checkbox v-model="form.show_date" @change="updatePreview">显示时间</el-checkbox>
              <el-checkbox v-model="form.show_description" @change="updatePreview">显示摘要</el-checkbox>
            </el-form-item>
            <el-form-item label="摘要长度" v-if="form.show_description">
              <el-slider v-model="form.description_length" :min="50" :max="500" :step="50" show-input @change="updatePreview" />
            </el-form-item>

            <el-divider>按钮和底部</el-divider>

            <el-form-item label="按钮文字">
              <el-input v-model="form.button_text" placeholder="阅读原文" @input="updatePreview" />
            </el-form-item>
            <el-form-item label="按钮颜色">
              <el-color-picker v-model="form.button_color" @change="updatePreview" />
            </el-form-item>
            <el-form-item label="底部文字">
              <el-input v-model="form.footer_text" type="textarea" :rows="2" @input="updatePreview" />
            </el-form-item>

            <el-form-item label="设为默认">
              <el-switch v-model="form.is_default" />
            </el-form-item>
          </el-form>
        </el-col>

        <!-- 右侧预览 -->
        <el-col :span="12">
          <div class="preview-container">
            <div class="preview-header">
              <span>实时预览</span>
              <el-button size="small" @click="updatePreview" :loading="previewing">刷新</el-button>
            </div>
            <div class="preview-frame" v-loading="previewing">
              <iframe ref="previewIframe" :srcdoc="previewHtml" frameborder="0"></iframe>
            </div>
          </div>
        </el-col>
      </el-row>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">保存</el-button>
      </template>
    </el-dialog>

    <!-- 预览对话框 -->
    <el-dialog v-model="previewDialogVisible" title="模板预览" width="700px">
      <div class="preview-frame large">
        <iframe :srcdoc="fullPreviewHtml" frameborder="0"></iframe>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'

const loading = ref(false)
const submitting = ref(false)
const previewing = ref(false)
const templates = ref([])
const dialogVisible = ref(false)
const previewDialogVisible = ref(false)
const editingTemplate = ref(null)
const formRef = ref(null)
const previewHtml = ref('')
const fullPreviewHtml = ref('')

const defaultForm = {
  name: '',
  type: 'digest',
  subject: '[RSS摘要] {count}篇新文章 - {date}',
  header_bg_color: '#667eea',
  header_bg_color_end: '#764ba2',
  header_title: 'RSS 每日摘要',
  header_subtitle: '',
  show_source: true,
  show_date: true,
  show_description: true,
  description_length: 200,
  button_text: '阅读原文',
  button_color: '#667eea',
  footer_text: '此邮件由 RSS Monitor 自动发送\n如需退订，请登录系统管理订阅设置',
  custom_css: '',
  is_default: false
}

const form = ref({ ...defaultForm })

const rules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择模板类型', trigger: 'change' }],
  subject: [{ required: true, message: '请输入邮件主题', trigger: 'blur' }]
}

const fetchTemplates = async () => {
  loading.value = true
  try {
    const res = await api.get('/templates')
    if (res.success) {
      templates.value = res.data
    }
  } catch (error) {
    console.error('Failed to fetch templates:', error)
  } finally {
    loading.value = false
  }
}

const showAddDialog = () => {
  editingTemplate.value = null
  form.value = { ...defaultForm }
  dialogVisible.value = true
  setTimeout(() => updatePreview(), 100)
}

const showEditDialog = (template) => {
  editingTemplate.value = template
  form.value = { ...template }
  dialogVisible.value = true
  setTimeout(() => updatePreview(), 100)
}

const updatePreview = async () => {
  previewing.value = true
  try {
    const res = await api.post('/templates/preview', form.value)
    if (res.success) {
      previewHtml.value = res.data.html
    }
  } catch (error) {
    console.error('Failed to generate preview:', error)
  } finally {
    previewing.value = false
  }
}

const previewTemplate = async (template) => {
  try {
    const res = await api.post('/templates/preview', template)
    if (res.success) {
      fullPreviewHtml.value = res.data.html
      previewDialogVisible.value = true
    }
  } catch (error) {
    console.error('Failed to preview template:', error)
  }
}

const submitForm = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    let res
    if (editingTemplate.value) {
      res = await api.put(`/templates/${editingTemplate.value.id}`, form.value)
    } else {
      res = await api.post('/templates', form.value)
    }

    if (res.success) {
      ElMessage.success(res.message)
      dialogVisible.value = false
      fetchTemplates()
    }
  } catch (error) {
    // Error handled by interceptor
  } finally {
    submitting.value = false
  }
}

const deleteTemplate = async (template) => {
  try {
    await ElMessageBox.confirm(`确定要删除模板 "${template.name}" 吗？`, '确认删除', {
      type: 'warning'
    })

    const res = await api.delete(`/templates/${template.id}`)
    if (res.success) {
      ElMessage.success(res.message)
      fetchTemplates()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete template:', error)
    }
  }
}

onMounted(() => {
  fetchTemplates()
})
</script>

<style lang="scss" scoped>
.template-card {
  margin-bottom: 20px;
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  .card-preview {
    height: 120px;
    padding: 20px;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;

    .type-tag {
      position: absolute;
      top: 12px;
      left: 12px;
    }

    .default-tag {
      position: absolute;
      top: 12px;
      right: 12px;
    }

    .preview-title {
      color: #fff;
      font-size: 20px;
      font-weight: 600;
      text-align: center;
    }
  }

  .card-body {
    padding: 16px 20px;

    h3 {
      margin: 0 0 8px;
      font-size: 16px;
    }

    .subject {
      margin: 0 0 12px;
      font-size: 13px;
      color: #909399;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .options {
      display: flex;
      gap: 6px;
    }
  }

  .card-footer {
    padding: 12px 16px;
    border-top: 1px solid #ebeef5;
    display: flex;
    justify-content: flex-end;
  }
}

.color-picker-row {
  display: flex;
  align-items: center;
  gap: 10px;

  .color-arrow {
    color: #909399;
  }
}

.preview-container {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
  height: 100%;

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 15px;
    background: #f5f7fa;
    border-bottom: 1px solid #ebeef5;
    font-weight: 500;
  }

  .preview-frame {
    height: 500px;
    overflow: hidden;

    iframe {
      width: 100%;
      height: 100%;
      transform: scale(0.6);
      transform-origin: top left;
      width: 166.67%;
      height: 166.67%;
    }
  }
}

.preview-frame.large {
  height: 600px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;

  iframe {
    width: 100%;
    height: 100%;
  }
}
</style>
