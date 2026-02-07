<template>
  <div class="layout">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <el-icon size="24"><Promotion /></el-icon>
        <span>RSS Monitor</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
      >
        <el-menu-item index="/">
          <el-icon><DataAnalysis /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/rss">
          <el-icon><Connection /></el-icon>
          <span>RSS源管理</span>
        </el-menu-item>
        <el-menu-item index="/categories">
          <el-icon><Menu /></el-icon>
          <span>板块管理</span>
        </el-menu-item>
        <el-menu-item index="/articles">
          <el-icon><Document /></el-icon>
          <span>内容聚合</span>
        </el-menu-item>

        <el-sub-menu index="category-sub">
          <template #title>
            <el-icon><Folder /></el-icon>
            <span>板块内容</span>
          </template>
          <el-menu-item
            v-for="cat in categories"
            :key="cat.id"
            :index="`/articles/category/${cat.id}`"
          >
            <el-icon><FolderOpened /></el-icon>
            <span>{{ cat.name }}</span>
          </el-menu-item>
        </el-sub-menu>

        <el-divider style="margin: 10px 0; border-color: #3d4a5a;" />

        <el-menu-item index="/subscribers">
          <el-icon><User /></el-icon>
          <span>订阅者管理</span>
        </el-menu-item>
        <el-menu-item index="/email">
          <el-icon><Message /></el-icon>
          <span>邮件配置</span>
        </el-menu-item>
        <el-menu-item index="/templates">
          <el-icon><Postcard /></el-icon>
          <span>推送模板</span>
        </el-menu-item>
        <el-menu-item index="/logs">
          <el-icon><List /></el-icon>
          <span>推送日志</span>
        </el-menu-item>

        <el-divider style="margin: 10px 0; border-color: #3d4a5a;" />

        <el-sub-menu index="ai-sub">
          <template #title>
            <el-icon><Cpu /></el-icon>
            <span>AI 设置</span>
          </template>
          <el-menu-item index="/ai/providers">
            <el-icon><Setting /></el-icon>
            <span>提供商管理</span>
          </el-menu-item>
          <el-menu-item index="/ai/prompts">
            <el-icon><EditPen /></el-icon>
            <span>提示词管理</span>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="currentRoute">{{ currentRoute }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-avatar :size="32" icon="User" />
              <span class="username">{{ authStore.user?.username }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="password">修改密码</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>

    <!-- 修改密码对话框 -->
    <el-dialog v-model="passwordDialogVisible" title="修改密码" width="400px">
      <el-form :model="passwordForm" :rules="passwordRules" ref="passwordFormRef" label-width="80px">
        <el-form-item label="旧密码" prop="oldPassword">
          <el-input v-model="passwordForm.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="passwordForm.newPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="passwordForm.confirmPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPassword" :loading="passwordLoading">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import api from '@/api'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const categories = ref([])
const passwordDialogVisible = ref(false)
const passwordLoading = ref(false)
const passwordFormRef = ref(null)
const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const routeNames = {
  '/': '仪表盘',
  '/rss': 'RSS源管理',
  '/categories': '板块管理',
  '/articles': '内容聚合',
  '/subscribers': '订阅者管理',
  '/email': '邮件配置',
  '/templates': '推送模板',
  '/logs': '推送日志',
  '/ai/providers': 'AI提供商管理',
  '/ai/prompts': '提示词管理'
}

const activeMenu = computed(() => {
  if (route.path.startsWith('/articles/category/')) {
    return route.path
  }
  return route.path
})

const currentRoute = computed(() => {
  if (route.path.startsWith('/articles/category/')) {
    const cat = categories.value.find(c => c.id === parseInt(route.params.id))
    return cat ? cat.name : '板块内容'
  }
  return routeNames[route.path]
})

const passwordRules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== passwordForm.value.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
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

const handleCommand = (command) => {
  if (command === 'logout') {
    authStore.logout()
    router.push('/login')
    ElMessage.success('已退出登录')
  } else if (command === 'password') {
    passwordDialogVisible.value = true
    passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  }
}

const submitPassword = async () => {
  const valid = await passwordFormRef.value.validate().catch(() => false)
  if (!valid) return

  passwordLoading.value = true
  try {
    const res = await authStore.changePassword(
      passwordForm.value.oldPassword,
      passwordForm.value.newPassword
    )
    if (res.success) {
      ElMessage.success('密码修改成功')
      passwordDialogVisible.value = false
    }
  } catch (error) {
    // Error handled by interceptor
  } finally {
    passwordLoading.value = false
  }
}

onMounted(() => {
  fetchCategories()
})
</script>

<style lang="scss" scoped>
.layout {
  display: flex;
  height: 100vh;
}

.sidebar {
  background-color: #304156;
  overflow-y: auto;

  .logo {
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    border-bottom: 1px solid #3d4a5a;
  }

  .el-menu {
    border-right: none;
  }
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  padding: 0 20px;

  .user-info {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;

    .username {
      color: #606266;
    }
  }
}

.main {
  background: #f5f7fa;
  overflow-y: auto;
}
</style>
