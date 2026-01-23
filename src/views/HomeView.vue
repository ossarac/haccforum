<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useArticleStore, type Article } from '../stores/articleStore'
import { useTopicStore } from '../stores/topicStore'
import { useAuthStore } from '../stores/authStore'
import { Plus, ChevronRight, Clock, MessageSquare, TrendingUp } from 'lucide-vue-next'

const router = useRouter()
const { t } = useI18n()
const articleStore = useArticleStore()
const topicStore = useTopicStore()
const authStore = useAuthStore()

const recentArticles = ref<Article[]>([])
const topicStats = ref<Array<{
  _id: string | null
  totalArticles: number
  latestArticle: string | null
  latestUpdate: string
  latestArticles: Article[]
}>>([])
const isLoading = ref(true)
const canEdit = computed(() => authStore.isAuthenticated)

onMounted(async () => {
  try {
    await Promise.all([
      topicStore.fetchTopics(),
      loadDashboardData()
    ])
  } catch (error) {
    console.error('[home] failed to load dashboard', error)
  } finally {
    isLoading.value = false
  }
})

const loadDashboardData = async () => {
  const [recent, stats] = await Promise.all([
    articleStore.fetchRecentArticles(6),
    articleStore.fetchTopicStatistics()
  ])
  recentArticles.value = recent
  topicStats.value = stats
}

const getTopicById = (id: string | null) => {
  if (!id) return null
  return topicStore.getTopic(id)
}

const getTopicWithStats = computed(() => {
  return topicStats.value
    .filter(stat => stat._id !== null)
    .map(stat => ({
      topic: getTopicById(stat._id),
      stats: stat
    }))
    .filter(item => item.topic !== undefined)
    .sort((a, b) => {
      // Sort by latest activity
      const aTime = new Date(a.stats.latestUpdate).getTime()
      const bTime = new Date(b.stats.latestUpdate).getTime()
      return bTime - aTime
    })
})

const viewArticle = (id: string) => {
  router.push(`/article/${id}`)
}

const viewTopic = (topicId: string) => {
  router.push(`/topic/${topicId}`)
}

const createArticle = () => {
  if (!canEdit.value) {
    router.push({ name: 'login', query: { redirect: '/editor' } })
    return
  }
  router.push('/editor')
}

const formatTimeAgo = (iso: string) => {
  const date = new Date(iso)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const getTopicColor = (topicId: string) => {
  // Generate consistent but subtle colors for topics
  const colors = [
    '#64748b', // slate
    '#6366f1', // indigo
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#f43f5e', // rose
    '#f59e0b', // amber
    '#10b981', // emerald
    '#06b6d4', // cyan
  ]
  
  const index = topicId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
  return colors[index]
}
</script>

<template>
  <div class="home-container">
    <div class="home-header">
      <div class="header-content">
        <h1 class="main-title">{{ t('home.title') }}</h1>
        <p class="main-subtitle">{{ t('home.subtitle') }}</p>
      </div>
      <button v-if="canEdit" class="cta-button" @click="createArticle">
        <Plus :size="20" />
        <span>{{ t('home.newArticle') }}</span>
      </button>
      <button v-else class="cta-button secondary" @click="createArticle">
        <span>{{ t('home.signInToContribute') }}</span>
      </button>
    </div>

    <div v-if="isLoading" class="loading-section">
      <div class="loading-spinner"></div>
      <p>{{ t('home.loadingContent') }}</p>
    </div>

    <div v-else class="home-content">
      <!-- Recent Activity Section -->
      <section class="recent-section" v-if="recentArticles.length > 0">
        <div class="section-header">
          <div class="section-title-group">
            <TrendingUp :size="20" class="section-icon" />
            <h2 class="section-title">{{ t('home.recentActivity') }}</h2>
          </div>
          <p class="section-subtitle">{{ t('home.latestArticles') }}</p>
        </div>
        
        <div class="recent-articles-scroll">
          <article 
            v-for="article in recentArticles" 
            :key="article.id"
            class="recent-card"
            @click="viewArticle(article.id)"
          >
            <div class="recent-card-topic" v-if="article.topicId">
              <span 
                class="topic-indicator"
                :style="{ backgroundColor: getTopicColor(article.topicId) }"
              ></span>
              <span class="topic-name">{{ getTopicById(article.topicId)?.name }}</span>
            </div>
            <h3 class="recent-card-title">{{ article.title }}</h3>
            <div class="recent-card-meta">
              <span class="recent-author">{{ article.authorName || article.author.name }}</span>
              <span class="meta-dot">·</span>
              <span class="recent-time">{{ formatTimeAgo(article.publishedAt || article.createdAt) }}</span>
            </div>
          </article>
        </div>
      </section>

      <!-- Topics Section -->
      <section class="topics-section">
        <div class="section-header">
          <div class="section-title-group">
            <h2 class="section-title">{{ t('home.topics') }}</h2>
          </div>
          <p class="section-subtitle">{{ t('home.browseBySubject') }}</p>
        </div>

        <div v-if="getTopicWithStats.length === 0" class="empty-topics">
          <p>{{ t('home.noTopicsYet') }}</p>
        </div>

        <div v-else class="topics-grid">
          <div 
            v-for="{ topic, stats } in getTopicWithStats" 
            :key="topic!.id"
            class="topic-card"
            @click="viewTopic(topic!.id)"
          >
            <div class="topic-card-header">
              <div class="topic-title-row">
                <span 
                  class="topic-color-bar"
                  :style="{ backgroundColor: getTopicColor(topic!.id) }"
                ></span>
                <h3 class="topic-card-title">{{ topic!.name }}</h3>
              </div>
              <div class="topic-stats-row">
                <div class="stat-badge">
                  <MessageSquare :size="14" />
                  <span>{{ stats.totalArticles }}</span>
                </div>
                <div class="stat-badge subtle">
                  <Clock :size="14" />
                  <span>{{ formatTimeAgo(stats.latestUpdate) }}</span>
                </div>
              </div>
            </div>

            <p v-if="topic!.description" class="topic-description">
              {{ topic!.description }}
            </p>

            <div class="topic-articles" v-if="stats.latestArticles.length > 0">
              <div class="articles-label">{{ t('home.recent') }}</div>
              <div 
                v-for="article in stats.latestArticles.slice(0, 3)" 
                :key="article.id"
                class="topic-article-item"
                @click.stop="viewArticle(article.id)"
              >
                <span class="article-bullet">→</span>
                <span class="article-item-title">{{ article.title }}</span>
                <span class="article-item-time">{{ formatTimeAgo(article.publishedAt || article.createdAt) }}</span>
              </div>
            </div>

            <div class="topic-card-footer">
              <span class="view-all-link">
                {{ t('home.viewAllArticles') }}
                <ChevronRight :size="16" />
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.home-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  min-height: 100vh;
}

.home-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--border-color);
  gap: 2rem;
}

.header-content {
  flex: 1;
}

.main-title {
  font-size: 2.75rem;
  font-weight: 800;
  margin: 0 0 0.5rem 0;
  color: var(--text-color);
  font-family: var(--font-serif);
  letter-spacing: -0.02em;
}

.main-subtitle {
  font-size: 1.125rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
  max-width: 600px;
}

.cta-button {
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
  transition: all 0.2s ease;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.cta-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.cta-button.secondary {
  background: var(--surface-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.loading-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.home-content {
  display: flex;
  flex-direction: column;
  gap: 4rem;
}

/* Recent Activity Section */
.recent-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-title-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.section-icon {
  color: var(--text-secondary);
}

.section-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-color);
  font-family: var(--font-serif);
}

.section-subtitle {
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin: 0;
  padding-left: 2rem;
}

.recent-articles-scroll {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
  padding: 0.25rem;
}

.recent-card {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  position: relative;
  overflow: hidden;
}

.recent-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, 
    var(--accent-color) 0%, 
    transparent 100%);
  opacity: 0;
  transition: opacity 0.25s ease;
}

.recent-card:hover::before {
  opacity: 1;
}

.recent-card:hover {
  border-color: color-mix(in srgb, var(--accent-color) 50%, var(--border-color));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-3px);
}

.recent-card-topic {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.topic-indicator {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.topic-name {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-size: 0.75rem;
}

.recent-card-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.recent-card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 1px solid color-mix(in srgb, var(--border-color) 50%, transparent);
}

.recent-author {
  font-weight: 500;
  color: var(--text-color);
}

.meta-dot {
  opacity: 0.4;
  font-size: 0.7em;
}

.recent-time {
  font-variant-numeric: tabular-nums;
}

/* Topics Section */
.topics-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.empty-topics {
  text-align: center;
  padding: 3rem 2rem;
  background: var(--surface-color);
  border: 1px dashed var(--border-color);
  border-radius: 12px;
  color: var(--text-secondary);
}

.topics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1.5rem;
}

.topic-card {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
}

.topic-card:hover {
  border-color: var(--text-secondary);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.topic-card-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.topic-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.topic-color-bar {
  width: 4px;
  height: 24px;
  border-radius: 2px;
  flex-shrink: 0;
}

.topic-card-title {
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-color);
  font-family: var(--font-serif);
  line-height: 1.3;
}

.topic-stats-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-left: 1rem;
}

.stat-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  background: var(--text-color);
  color: var(--bg-color);
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stat-badge.subtle {
  background: var(--bg-color);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.topic-description {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
  padding-left: 1rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.topic-articles {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--bg-color);
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--border-color) 50%, transparent);
}

.articles-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.topic-article-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.5rem 0.5rem 0.5rem 0.25rem;
  border-radius: 6px;
  transition: all 0.2s ease;
  font-size: 0.9rem;
}

.topic-article-item:hover {
  background: var(--surface-color);
  padding-left: 0.5rem;
}

.article-bullet {
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.85em;
  flex-shrink: 0;
}

.article-item-title {
  color: var(--text-color);
  font-weight: 500;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-item-time {
  font-size: 0.8rem;
  color: var(--text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.topic-card-footer {
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
  margin-top: auto;
}

.view-all-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.topic-card:hover .view-all-link {
  color: var(--text-color);
  gap: 0.5rem;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .topics-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }
}

@media (max-width: 768px) {
  .home-container {
    padding: 1.5rem 1rem;
  }

  .home-header {
    flex-direction: column;
    gap: 1.5rem;
  }

  .cta-button {
    width: 100%;
    justify-content: center;
  }

  .main-title {
    font-size: 2rem;
  }

  .main-subtitle {
    font-size: 1rem;
  }

  .recent-articles-scroll {
    grid-template-columns: 1fr;
  }

  .topics-grid {
    grid-template-columns: 1fr;
  }

  .section-subtitle {
    padding-left: 0;
  }
}

@media (max-width: 480px) {
  .main-title {
    font-size: 1.75rem;
  }

  .section-title {
    font-size: 1.5rem;
  }

  .topic-card-title {
    font-size: 1.125rem;
  }
}
</style>
