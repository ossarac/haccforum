<script setup lang="ts">
import { onMounted, computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useArticleStore, type Article } from '../stores/articleStore'
import { useTopicStore, type Topic } from '../stores/topicStore'
import { useAuthStore } from '../stores/authStore'
import { ChevronRight, FileText, Plus, FolderTree, Layers, Clock, User } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const articleStore = useArticleStore()
const topicStore = useTopicStore()
const authStore = useAuthStore()

const articles = ref<Article[]>([])
const isLoading = ref(true)
const currentTopic = ref<Topic | undefined>()
const breadcrumbPath = ref<Topic[]>([])
const subtopics = ref<Topic[]>([])

const topicId = computed(() => route.params.id as string)

const canEdit = computed(() => authStore.isAuthenticated)

const groupedArticles = computed(() => {
  // Group articles by subtopic
  const groups: Map<string | null, Article[]> = new Map()
  
  articles.value.forEach(article => {
    const key = article.topicId
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(article)
  })

  return groups
})

const currentTopicArticles = computed(() => {
  return groupedArticles.value.get(topicId.value) || []
})

const loadTopicData = async () => {
  isLoading.value = true
  try {
    await topicStore.fetchTopics()
    
    currentTopic.value = topicStore.getTopic(topicId.value)
    
    if (!currentTopic.value) {
      router.push('/')
      return
    }

    // Build breadcrumb path
    breadcrumbPath.value = topicStore.getTopicPath(topicId.value)

    // Get all subtopics (direct children)
    subtopics.value = topicStore.topics.filter(t => t.parentId === topicId.value)

    // Fetch all articles in this topic (backend currently only filters by exact topicId)
    // We'll need to also fetch articles from subtopics
    const allTopicIds = [topicId.value, ...getAllSubtopicIds(topicId.value)]
    const articlePromises = allTopicIds.map(id => articleStore.fetchArticlesByTopic(id))
    const results = await Promise.all(articlePromises)
    articles.value = results.flat().filter((article, index, self) => 
      // Remove duplicates
      index === self.findIndex(a => a.id === article.id)
    )
  } catch (error) {
    console.error('[TopicView] Failed to load topic data:', error)
  } finally {
    isLoading.value = false
  }
}

const getAllSubtopicIds = (parentId: string): string[] => {
  const children = topicStore.topics.filter(t => t.parentId === parentId)
  const result = children.map(c => c.id)
  
  children.forEach(child => {
    result.push(...getAllSubtopicIds(child.id))
  })
  
  return result
}

watch(() => route.params.id, (newId) => {
  if (newId) {
    loadTopicData()
  }
})

onMounted(async () => {
  await loadTopicData()
})

const viewArticle = (id: string) => {
  router.push(`/article/${id}`)
}

const viewTopic = (id: string) => {
  router.push(`/topic/${id}`)
}

const createArticleInTopic = () => {
  if (!canEdit.value) {
    router.push({ name: 'login', query: { redirect: `/topic/${topicId.value}` } })
    return
  }
  router.push({ name: 'editor', query: { topicId: topicId.value } })
}

const formatTimeAgo = (iso: string) => {
  const date = new Date(iso)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return t('topic.justNow')
  if (seconds < 3600) return t('topic.minutesAgo', { count: Math.floor(seconds / 60) })
  if (seconds < 86400) return t('topic.hoursAgo', { count: Math.floor(seconds / 3600) })
  if (seconds < 604800) return t('topic.daysAgo', { count: Math.floor(seconds / 86400) })
  
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const getTopicColor = (topicId: string) => {
  const colors = [
    '#64748b', '#6366f1', '#8b5cf6', '#ec4899', 
    '#f43f5e', '#f59e0b', '#10b981', '#06b6d4',
  ]
  const index = topicId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
  return colors[index]
}
</script>

<template>
  <div class="topic-view">
    <!-- Breadcrumb Navigation -->
    <nav class="breadcrumb" v-if="breadcrumbPath.length > 0">
      <router-link to="/" class="breadcrumb-item">
        {{ t('topic.home') }}
      </router-link>
      <ChevronRight :size="16" class="breadcrumb-separator" />
      <template v-for="(topic, index) in breadcrumbPath" :key="topic.id">
        <router-link 
          v-if="index < breadcrumbPath.length - 1"
          :to="`/topic/${topic.id}`" 
          class="breadcrumb-item"
        >
          {{ topic.name }}
        </router-link>
        <span v-else class="breadcrumb-item current">{{ topic.name }}</span>
        <ChevronRight 
          v-if="index < breadcrumbPath.length - 1" 
          :size="16" 
          class="breadcrumb-separator" 
        />
      </template>
    </nav>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-section">
      <div class="loading-spinner"></div>
      <p>{{ t('topic.loading') }}</p>
    </div>

    <!-- Main Content -->
    <div v-else-if="currentTopic" class="topic-content">
      <!-- Topic Header -->
      <header class="topic-header">
        <div class="topic-header-content">
          <div class="topic-title-row">
            <span 
              class="topic-color-indicator"
              :style="{ backgroundColor: getTopicColor(currentTopic.id) }"
            ></span>
            <h1 class="topic-title">{{ currentTopic.name }}</h1>
          </div>
          <p v-if="currentTopic.description" class="topic-description">
            {{ currentTopic.description }}
          </p>
          <div class="topic-stats">
            <div class="stat-item">
              <FileText :size="18" />
              <span>{{ t('topic.articlesCount', { count: articles.length }) }}</span>
            </div>
            <div class="stat-item" v-if="subtopics.length > 0">
              <FolderTree :size="18" />
              <span>{{ t('topic.subtopicsCount', { count: subtopics.length }) }}</span>
            </div>
          </div>
        </div>
        <button 
          v-if="canEdit" 
          class="create-article-btn"
          @click="createArticleInTopic"
        >
          <Plus :size="20" />
          <span>{{ t('topic.newArticle') }}</span>
        </button>
      </header>

      <!-- Subtopics Section -->
      <section v-if="subtopics.length > 0" class="subtopics-section">
        <div class="section-header">
          <Layers :size="20" class="section-icon" />
          <h2 class="section-title">{{ t('topic.subtopics') }}</h2>
        </div>
        <div class="subtopics-grid">
          <div 
            v-for="subtopic in subtopics" 
            :key="subtopic.id"
            class="subtopic-card"
            @click="viewTopic(subtopic.id)"
          >
            <div class="subtopic-header">
              <span 
                class="subtopic-indicator"
                :style="{ backgroundColor: getTopicColor(subtopic.id) }"
              ></span>
              <h3 class="subtopic-name">{{ subtopic.name }}</h3>
            </div>
            <p v-if="subtopic.description" class="subtopic-description">
              {{ subtopic.description }}
            </p>
            <div class="subtopic-footer">
              <span class="subtopic-count">
                {{ t('topic.articlesCount', { 
                  count: (groupedArticles.get(subtopic.id) || []).length 
                }) }}
              </span>
              <ChevronRight :size="16" class="subtopic-arrow" />
            </div>
          </div>
        </div>
      </section>

      <!-- Articles Section -->
      <section class="articles-section">
        <div class="section-header">
          <FileText :size="20" class="section-icon" />
          <h2 class="section-title">
            {{ currentTopicArticles.length > 0 
              ? t('topic.articlesInThisTopic') 
              : t('topic.allArticles') 
            }}
          </h2>
        </div>

        <div v-if="currentTopicArticles.length === 0 && subtopics.length === 0" class="empty-state">
          <FileText :size="48" class="empty-icon" />
          <h3>{{ t('topic.noArticles') }}</h3>
          <p>{{ t('topic.noArticlesDescription') }}</p>
          <button v-if="canEdit" class="empty-cta" @click="createArticleInTopic">
            <Plus :size="18" />
            <span>{{ t('topic.createFirst') }}</span>
          </button>
        </div>

        <!-- Current Topic Articles -->
        <div v-else-if="currentTopicArticles.length > 0" class="articles-list">
          <article 
            v-for="article in currentTopicArticles" 
            :key="article.id"
            class="article-card"
            @click="viewArticle(article.id)"
          >
            <div class="article-content">
              <h3 class="article-title">{{ article.title }}</h3>
              <div class="article-meta">
                <div class="meta-item">
                  <User :size="14" />
                  <span>{{ article.authorName || article.author.name }}</span>
                </div>
                <span class="meta-dot">·</span>
                <div class="meta-item">
                  <Clock :size="14" />
                  <span>{{ formatTimeAgo(article.publishedAt || article.createdAt) }}</span>
                </div>
              </div>
            </div>
            <ChevronRight :size="20" class="article-arrow" />
          </article>
        </div>

        <!-- Articles Organized by Subtopic -->
        <div v-if="subtopics.length > 0" class="subtopic-articles">
          <template v-for="subtopic in subtopics" :key="`articles-${subtopic.id}`">
            <div 
              v-if="(groupedArticles.get(subtopic.id) || []).length > 0" 
              class="subtopic-articles-group"
            >
              <div class="subtopic-group-header">
                <span 
                  class="subtopic-group-indicator"
                  :style="{ backgroundColor: getTopicColor(subtopic.id) }"
                ></span>
                <h3 class="subtopic-group-title">{{ subtopic.name }}</h3>
                <button 
                  class="view-subtopic-btn"
                  @click.stop="viewTopic(subtopic.id)"
                >
                  {{ t('topic.viewAll') }}
                  <ChevronRight :size="14" />
                </button>
              </div>
              <div class="articles-list compact">
                <article 
                  v-for="article in (groupedArticles.get(subtopic.id) || []).slice(0, 5)" 
                  :key="article.id"
                  class="article-card"
                  @click="viewArticle(article.id)"
                >
                  <div class="article-content">
                    <h4 class="article-title">{{ article.title }}</h4>
                    <div class="article-meta">
                      <div class="meta-item">
                        <User :size="14" />
                        <span>{{ article.authorName || article.author.name }}</span>
                      </div>
                      <span class="meta-dot">·</span>
                      <div class="meta-item">
                        <Clock :size="14" />
                        <span>{{ formatTimeAgo(article.publishedAt || article.createdAt) }}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight :size="18" class="article-arrow" />
                </article>
              </div>
            </div>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.topic-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  min-height: 100vh;
}

/* Breadcrumb Navigation */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.breadcrumb-item {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.875rem;
  transition: color 0.2s;
}

.breadcrumb-item:hover:not(.current) {
  color: var(--text-color);
}

.breadcrumb-item.current {
  color: var(--text-color);
  font-weight: 600;
}

.breadcrumb-separator {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

/* Loading State */
.loading-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
  gap: 1rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--text-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Topic Header */
.topic-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid var(--border-color);
}

.topic-header-content {
  flex: 1;
}

.topic-title-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.topic-color-indicator {
  width: 4px;
  height: 2.5rem;
  border-radius: 2px;
  flex-shrink: 0;
}

.topic-title {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0;
  color: var(--text-color);
  font-family: var(--font-serif);
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.topic-description {
  font-size: 1.125rem;
  color: var(--text-secondary);
  margin: 0 0 1.5rem 0;
  line-height: 1.6;
  max-width: 700px;
}

.topic-stats {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.create-article-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--text-color);
  color: var(--bg-color);
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.create-article-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Section Headers */
.section-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.section-icon {
  color: var(--text-secondary);
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-color);
}

/* Subtopics Section */
.subtopics-section {
  margin-bottom: 3rem;
}

.subtopics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.subtopic-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.2s;
}

.subtopic-card:hover {
  border-color: var(--text-secondary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.subtopic-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.subtopic-indicator {
  width: 3px;
  height: 1.5rem;
  border-radius: 2px;
  flex-shrink: 0;
}

.subtopic-name {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
}

.subtopic-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0 0 1rem 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.subtopic-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
}

.subtopic-count {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.subtopic-arrow {
  color: var(--text-tertiary);
}

/* Articles Section */
.articles-section {
  margin-bottom: 2rem;
}

.articles-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.articles-list.compact {
  gap: 0.5rem;
}

.article-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.2s;
}

.article-card:hover {
  border-color: var(--text-secondary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transform: translateX(4px);
}

.article-content {
  flex: 1;
  min-width: 0;
}

.article-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.articles-list.compact .article-title {
  font-size: 1rem;
}

.article-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.meta-dot {
  color: var(--text-tertiary);
}

.article-arrow {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  color: var(--text-tertiary);
  margin-bottom: 1rem;
}

.empty-state h3 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--text-color);
}

.empty-state p {
  font-size: 1rem;
  color: var(--text-secondary);
  margin: 0 0 1.5rem 0;
  max-width: 400px;
}

.empty-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--text-color);
  color: var(--bg-color);
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.empty-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Subtopic Articles Groups */
.subtopic-articles {
  margin-top: 2rem;
}

.subtopic-articles-group {
  margin-bottom: 2rem;
}

.subtopic-group-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-color);
}

.subtopic-group-indicator {
  width: 3px;
  height: 1.25rem;
  border-radius: 2px;
  flex-shrink: 0;
}

.subtopic-group-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
  flex: 1;
}

.view-subtopic-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.view-subtopic-btn:hover {
  background: var(--card-bg);
  border-color: var(--text-secondary);
  color: var(--text-color);
}

/* Responsive */
@media (max-width: 768px) {
  .topic-view {
    padding: 1.5rem 1rem;
  }

  .topic-header {
    flex-direction: column;
    gap: 1.5rem;
  }

  .topic-title {
    font-size: 2rem;
  }

  .topic-description {
    font-size: 1rem;
  }

  .create-article-btn {
    width: 100%;
    justify-content: center;
  }

  .subtopics-grid {
    grid-template-columns: 1fr;
  }

  .article-title {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .subtopic-group-header {
    flex-wrap: wrap;
  }
}
</style>
