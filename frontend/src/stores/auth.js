import { defineStore } from 'pinia'
import api from '@/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null')
  }),

  getters: {
    isLoggedIn: state => !!state.token
  },

  actions: {
    async login(username, password) {
      const res = await api.post('/auth/login', { username, password })
      if (res.success) {
        this.token = res.data.token
        this.user = res.data.user
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('user', JSON.stringify(res.data.user))
      }
      return res
    },

    logout() {
      this.token = null
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },

    async changePassword(oldPassword, newPassword) {
      return await api.post('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword
      })
    }
  }
})
