<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { apiRequest } from '../api/client'
import { AlertCircle } from 'lucide-vue-next'
import ArticleTreeItem from '../components/ArticleTreeItem.vue'

interface Article {
  id: string
  title: string
  content: string
  authorName?: string
  author: {
    id: string
    name: string
    email: string
  }
  deleted: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  children?: ArticleNode[]
}

interface ArticleNode extends Article {
  children: ArticleNode[]
}

const router = useRouter()
const auth = useAuthStore()

const deletedArticles = ref<ArticleNode[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const confirmDelete = ref<string | null>(null)
const expandedArticles = ref<Set<string>>(new Set())
const restoringId = ref<string | null>(null)

const fetchDeletedArticles = async () => {
  isLoading.value = true
  error.value = null
  try {
    const response = await apiRequest<ArticleNode[]>('/articles/deleted', {
      method: 'GET'
    })
    deletedArticles.value = response
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load deleted articles'
    console.error('[admin] Failed to load deleted articles:', err)
  } finally {
    isLoading.value = false
  }
}

const toggleExpanded = (id: string) => {
  if (expandedArticles.value.has(id)) {
    expandedArticles.value.delete(id)
  } else {
    expandedArticles.value.add(id)
  }
}

const undeleteArticle = async (id: string, restoreChildren: boolean = false) => {
  restoringId.value = id
  try {
    const params = restoreChildren ? '?restoreChildren=true' : ''
    await apiRequest(`/articles/${id}/undelete${params}`, {
      method: 'POST'
    })
    // Refresh the list
    await fetchDeletedArticles()
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to undelete article'
    console.error('[admin] Failed to undelete article:', err)
  } finally {
    restoringId.value = null
  }
}

const permanentlyDeleteArticle = async (id: string) => {
  try {
    await apiRequest(`/articles/${id}/permanent`, {
      method: 'DELETE'
    })
    await fetchDeletedArticles()
    confirmDelete.value = null
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to permanently delete article'
    console.error('[admin] Failed to permanently delete article:', err)
  }
}

onMounted(async () => {
  if (!auth.isAuthenticated || !auth.hasRole('admin')) {
    router.push({ name: 'home' })
    return
  }

  await fetchDeletedArticles()
})
</script>

<template>
  <div class="container mobile-padding">
    <div class="admin-layout">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <h1>Article Management</h1>
          <p class="subtitle">Manage and restore deleted articles</p>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="error-banner">
        <AlertCircle :size="20" />
        <span>{{ error }}</span>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading">
        <p>Loading deleted articles...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="deletedArticles.length === 0" class="empty-state">
        <div class="empty-icon">🗑️</div>
        <h2>No deleted articles</h2>
        <p>All articles are active</p>
      </div>

      <!-- Articles Tree -->
      <div v-else class="articles-tree">
        <div v-for="article in deletedArticles" :key="article.id" class="article-node">
          <ArticleTreeItem
            :article="article"
            :expanded="expandedArticles.has(article.id)"
            :restoring-id="restoringId"
            :confirm-delete-id="confirmDelete"
            @toggle-expanded="toggleExpanded(article.id)"
            @undelete="undeleteArticle"
            @permanently-delete="(id) => confirmDelete = id"
            @cancel-delete="() => (confirmDelete = null)"
            @confirm-delete="permanentlyDeleteArticle"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.mobile-padding {
  padding: 0 1rem;
}

.admin-layout {
  padding: 2rem 0;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 3rem;
  gap: 2rem;
}

.header-content h1 {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0;
  margin-bottom: 0.5rem;
  color: var(--text-color);
}

.subtitle {
  color: var(--text-secondary);
  margin: 0;
  font-size: 1rem;
}

.error-banner {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  padding: 1rem 1.5rem;
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  color: #dc2626;
}

.loading {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state h2 {
  font-size: 1.5rem;
  color: var(--text-color);
  margin-bottom: 0.5rem;
}

.articles-tree {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.article-node {
  display: flex;
  flex-direction: column;
}

@media (max-width: 768px) {
  .header {
    flex-direction: column;
    margin-bottom: 2rem;
  }

  .header-content h1 {
    font-size: 2rem;
  }

  .desktop-only {
    display: none;
  }
}
</style>
