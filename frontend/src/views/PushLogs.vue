<template>
  <div class="page-container">
    <div class="page-header">
      <h2>推送日志</h2>
    </div>

    <!-- 筛选 -->
    <el-card class="filter-card">
      <el-row :gutter="20">
        <el-col :span="6">
          <el-select v-model="filters.status" placeholder="推送状态" clearable @change="fetchLogs">
            <el-option label="成功" value="success" />
            <el-option label="失败" value="failed" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-button @click="fetchLogs">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 日志列表 -->
    <el-card>
      <el-table :data="logs" v-loading="loading" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="subscriber_email" label="订阅者" min-width="180">
          <template #default="{ row }">
            {{ row.subscriber_email || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="article_title" label="文章" min-width="250">
          <template #default="{ row }">
            <el-tooltip v-if="row.article_title" :content="row.article_title" placement="top">
              <span class="article-title">{{ row.article_title }}</span>
            </el-tooltip>
            <span v-else class="no-article">摘要推送</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small">
              {{ row.status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="error_message" label="错误信息" min-width="200">
          <template #default="{ row }">
            <el-tooltip v-if="row.error_message" :content="row.error_message" placement="top">
              <span class="error-text">{{ row.error_message }}</span>
            </el-tooltip>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @size-change="fetchLogs"
          @current-change="fetchLogs"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import dayjs from 'dayjs'
import api from '@/api'

const loading = ref(false)
const logs = ref([])

const filters = ref({
  status: ''
})

const pagination = ref({
  page: 1,
  limit: 20,
  total: 0
})

const formatTime = (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')

const fetchLogs = async () => {
  loading.value = true
  try {
    const res = await api.get('/email/logs', {
      params: {
        ...filters.value,
        page: pagination.value.page,
        limit: pagination.value.limit
      }
    })
    if (res.success) {
      logs.value = res.data
      pagination.value.total = res.pagination.total
    }
  } catch (error) {
    console.error('Failed to fetch logs:', error)
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.value = { status: '' }
  pagination.value.page = 1
  fetchLogs()
}

onMounted(() => {
  fetchLogs()
})
</script>

<style lang="scss" scoped>
.filter-card {
  margin-bottom: 20px;
}

.article-title {
  display: block;
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-article {
  color: #909399;
  font-style: italic;
}

.error-text {
  color: #f56c6c;
  display: block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
