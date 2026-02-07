import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue')
      },
      {
        path: 'rss',
        name: 'RssManage',
        component: () => import('@/views/RssManage.vue')
      },
      {
        path: 'categories',
        name: 'CategoryManage',
        component: () => import('@/views/CategoryManage.vue')
      },
      {
        path: 'articles',
        name: 'Articles',
        component: () => import('@/views/Articles.vue')
      },
      {
        path: 'articles/category/:id',
        name: 'CategoryArticles',
        component: () => import('@/views/Articles.vue')
      },
      {
        path: 'subscribers',
        name: 'Subscribers',
        component: () => import('@/views/Subscribers.vue')
      },
      {
        path: 'email',
        name: 'EmailConfig',
        component: () => import('@/views/EmailConfig.vue')
      },
      {
        path: 'logs',
        name: 'PushLogs',
        component: () => import('@/views/PushLogs.vue')
      },
      {
        path: 'templates',
        name: 'EmailTemplate',
        component: () => import('@/views/EmailTemplate.vue')
      },
      {
        path: 'ai/providers',
        name: 'AIProvider',
        component: () => import('@/views/AIProvider.vue')
      },
      {
        path: 'ai/prompts',
        name: 'AIPrompt',
        component: () => import('@/views/AIPrompt.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  // 动态导入避免循环依赖
  import('@/stores/auth').then(({ useAuthStore }) => {
    const authStore = useAuthStore()

    if (to.meta.requiresAuth !== false && !authStore.isLoggedIn) {
      next('/login')
    } else if (to.path === '/login' && authStore.isLoggedIn) {
      next('/')
    } else {
      next()
    }
  })
})

export default router
