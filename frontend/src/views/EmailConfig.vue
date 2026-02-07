<template>
  <div class="page-container">
    <div class="page-header">
      <h2>邮件配置</h2>
    </div>

    <el-row :gutter="20">
      <!-- SMTP配置 -->
      <el-col :span="14">
        <el-card>
          <template #header>
            <span>SMTP服务器配置</span>
          </template>

          <el-form :model="smtpForm" :rules="smtpRules" ref="smtpFormRef" label-width="120px">
            <el-form-item label="SMTP服务器" prop="host">
              <el-input v-model="smtpForm.host" placeholder="smtp.example.com" />
            </el-form-item>
            <el-form-item label="端口" prop="port">
              <el-input-number v-model="smtpForm.port" :min="1" :max="65535" />
            </el-form-item>
            <el-form-item label="加密方式">
              <el-radio-group v-model="smtpForm.encryption">
                <el-radio value="SSL">SSL</el-radio>
                <el-radio value="TLS">TLS</el-radio>
                <el-radio value="NONE">无</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="用户名" prop="username">
              <el-input v-model="smtpForm.username" placeholder="your_email@example.com" />
            </el-form-item>
            <el-form-item label="密码/授权码" prop="password">
              <el-input v-model="smtpForm.password" type="password" show-password placeholder="SMTP密码或授权码" />
            </el-form-item>
            <el-form-item label="发件人名称">
              <el-input v-model="smtpForm.sender_name" placeholder="RSS Monitor" />
            </el-form-item>
            <el-form-item label="发件人邮箱">
              <el-input v-model="smtpForm.sender_email" placeholder="默认使用用户名" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveSmtpConfig" :loading="saving">
                保存配置
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <!-- 测试发送 -->
      <el-col :span="10">
        <el-card>
          <template #header>
            <span>测试邮件发送</span>
          </template>

          <el-form label-width="100px">
            <el-form-item label="测试邮箱">
              <el-input v-model="testEmail" placeholder="接收测试邮件的邮箱" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="sendTestEmail" :loading="testing">
                发送测试邮件
              </el-button>
            </el-form-item>
          </el-form>

          <el-divider />

          <h4>常用SMTP配置参考</h4>
          <el-table :data="smtpPresets" size="small" style="margin-top: 10px;">
            <el-table-column prop="name" label="服务商" width="100" />
            <el-table-column prop="host" label="服务器" />
            <el-table-column prop="port" label="端口" width="80" />
            <el-table-column prop="encryption" label="加密" width="60" />
            <el-table-column label="操作" width="60">
              <template #default="{ row }">
                <el-button text type="primary" size="small" @click="usePreset(row)">
                  使用
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <!-- 推送统计 -->
        <el-card style="margin-top: 20px;">
          <template #header>
            <span>推送统计</span>
          </template>

          <el-row :gutter="20">
            <el-col :span="12">
              <div class="stat-item">
                <div class="stat-value success">{{ pushStats.success_count || 0 }}</div>
                <div class="stat-label">成功推送</div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="stat-item">
                <div class="stat-value danger">{{ pushStats.failed_count || 0 }}</div>
                <div class="stat-label">失败推送</div>
              </div>
            </el-col>
          </el-row>
          <el-row :gutter="20" style="margin-top: 15px;">
            <el-col :span="12">
              <div class="stat-item">
                <div class="stat-value">{{ pushStats.today_count || 0 }}</div>
                <div class="stat-label">今日推送</div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="stat-item">
                <div class="stat-value">{{ pushStats.total_count || 0 }}</div>
                <div class="stat-label">总推送数</div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const saving = ref(false)
const testing = ref(false)
const testEmail = ref('')
const smtpFormRef = ref(null)
const pushStats = ref({})

const smtpForm = ref({
  host: '',
  port: 465,
  encryption: 'SSL',
  username: '',
  password: '',
  sender_name: 'RSS Monitor',
  sender_email: ''
})

const smtpRules = {
  host: [{ required: true, message: '请输入SMTP服务器地址', trigger: 'blur' }],
  port: [{ required: true, message: '请输入端口', trigger: 'blur' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const smtpPresets = [
  { name: 'QQ邮箱', host: 'smtp.qq.com', port: 465, encryption: 'SSL' },
  { name: '163邮箱', host: 'smtp.163.com', port: 465, encryption: 'SSL' },
  { name: 'Gmail', host: 'smtp.gmail.com', port: 587, encryption: 'TLS' },
  { name: 'Outlook', host: 'smtp.office365.com', port: 587, encryption: 'TLS' },
  { name: '阿里云', host: 'smtp.aliyun.com', port: 465, encryption: 'SSL' }
]

const fetchSmtpConfig = async () => {
  try {
    const res = await api.get('/email/smtp')
    if (res.success && res.data) {
      smtpForm.value = {
        host: res.data.host,
        port: res.data.port,
        encryption: res.data.encryption || 'SSL',
        username: res.data.username,
        password: '', // 不返回密码
        sender_name: res.data.sender_name || 'RSS Monitor',
        sender_email: res.data.sender_email || ''
      }
    }
  } catch (error) {
    console.error('Failed to fetch SMTP config:', error)
  }
}

const fetchPushStats = async () => {
  try {
    const res = await api.get('/email/stats')
    if (res.success) {
      pushStats.value = res.data
    }
  } catch (error) {
    console.error('Failed to fetch push stats:', error)
  }
}

const saveSmtpConfig = async () => {
  const valid = await smtpFormRef.value.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const res = await api.post('/email/smtp', smtpForm.value)
    if (res.success) {
      ElMessage.success(res.message)
    }
  } catch (error) {
    // Error handled by interceptor
  } finally {
    saving.value = false
  }
}

const sendTestEmail = async () => {
  if (!testEmail.value) {
    ElMessage.warning('请输入测试邮箱地址')
    return
  }

  testing.value = true
  try {
    const res = await api.post('/email/smtp/test', {
      ...smtpForm.value,
      test_email: testEmail.value
    })
    if (res.success) {
      ElMessage.success(res.message)
    }
  } catch (error) {
    // Error handled by interceptor
  } finally {
    testing.value = false
  }
}

const usePreset = (preset) => {
  smtpForm.value.host = preset.host
  smtpForm.value.port = preset.port
  smtpForm.value.encryption = preset.encryption
  ElMessage.success(`已应用 ${preset.name} 配置`)
}

onMounted(() => {
  fetchSmtpConfig()
  fetchPushStats()
})
</script>

<style lang="scss" scoped>
.stat-item {
  text-align: center;

  .stat-value {
    font-size: 28px;
    font-weight: 600;
    color: #303133;

    &.success {
      color: #67c23a;
    }

    &.danger {
      color: #f56c6c;
    }
  }

  .stat-label {
    font-size: 14px;
    color: #909399;
    margin-top: 5px;
  }
}
</style>
