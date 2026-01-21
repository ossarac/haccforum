<script setup lang="ts">
import { onMounted, computed, ref, h, defineComponent } from 'vue'
import { useRouter } from 'vue-router'
import { useArticleStore, type Article } from '../stores/articleStore'
import { useAuthStore } from '../stores/authStore'
import { PenTool, Plus, Grid3x3, List, ChevronRight, ChevronDown, MessageSquare, Trash2 } from 'lucide-vue-next'
import { ApiError } from '../api/client'
import Dialog from '../components/Dialog.vue'

// Recursive Tree Node Component
const TreeNode: any = defineComponent({
  name: 'TreeNode',
  props: {
    article: { type: Object, required: true },
    level: { type: Number, required: true },
    expandedNodes: { type: Set, required: true },
    canDelete: { type: Boolean, required: true },
    deletingId: { type: String, default: null }
  },
  emits: ['toggle', 'view', 'delete'],
  setup(props, { emit }) {
    const router = useRouter()
    
    const handleToggle = (e: Event, nodeId: string) => {
      e.stopPropagation()
      emit('toggle', nodeId)
    }

    const handleView = (id: string) => {
      router.push(`/article/${id}`)
    }

    const handleDelete = (e: Event, id: string) => {
      e.stopPropagation()
      emit('delete', id)
    }

    const formatDateTime = (iso: string) => {
      const date = new Date(iso)
      return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const getReplyCount = (article: any): number => {
      let count = article.children?.length || 0
      article.children?.forEach((child: any) => {
        count += getReplyCount(child)
      })
      return count
    }

    return () => {
      const article = props.article as any
      const hasChildren = article.children && article.children.length > 0
      const isExpanded = props.expandedNodes.has(article.id)
      const replyCount = getReplyCount(article)

      return h('div', { class: 'tree-node' }, [
        // Node content
        h('div', { 
          class: ['tree-node-content', `level-${props.level}`],
          onClick: () => handleView(article.id)
        }, [
          // Expand/collapse button or spacer
          hasChildren 
            ? h('button', {
                class: 'expand-btn',
                onClick: (e: Event) => handleToggle(e, article.id)
              }, [
                isExpanded 
                  ? h(ChevronDown, { size: 14 })
                  : h(ChevronRight, { size: 14 })
              ])
            : h('span', { class: 'expand-spacer' }),

          // Article info
          h('div', { class: 'node-info' }, [
            h('div', { class: 'node-header' }, [
              h('span', { class: 'node-title' }, article.title),
              hasChildren && h('span', { class: 'reply-badge' }, [
                h(MessageSquare, { size: 14 }),
                h('span', {}, String(replyCount))
              ]),
              props.canDelete && h('button', {
                class: 'node-delete-btn',
                disabled: props.deletingId === article.id,
                onClick: (e: Event) => handleDelete(e, article.id)
              }, [
                h(Trash2, { size: 14, color: '#b91c1c', strokeWidth: 2.25 })
              ])
            ]),
            h('div', { class: 'node-meta' }, [
              h('span', { class: 'node-author' }, article.authorName || article.author.name),
              h('span', { class: 'node-dot' }, '•'),
              h('span', { class: 'node-date' }, formatDateTime(article.createdAt))
            ])
          ])
        ]),

        // Children (if expanded)
        hasChildren && isExpanded && h('div', { class: 'tree-children' },
          article.children.map((child: any) =>
            h(TreeNode, {
              key: child.id,
              article: child,
              level: props.level + 1,
              expandedNodes: props.expandedNodes,
              canDelete: props.canDelete,
              deletingId: props.deletingId,
              onToggle: (id: string) => emit('toggle', id),
              onView: (id: string) => emit('view', id),
              onDelete: (id: string) => emit('delete', id)
            })
          )
        )
      ])
    }
  }
})

const router = useRouter()
const articleStore = useArticleStore()
const authStore = useAuthStore()

const rootArticles = computed(() => {
  const articles = articleStore.getChildren(null)
  // Sort by latest activity (including replies)
  return [...articles].filter((a): a is Article => !!a).sort((a, b) => {
    const aLatest = getLatestActivityDate(a.id)
    const bLatest = getLatestActivityDate(b.id)
    return bLatest - aLatest
  })
})
const allArticles = computed(() => articleStore.allArticles)
const isLoading = computed(() => articleStore.loadingStates['root'] ?? false)

// Dialog state
const dialogOpen = ref(false)
const dialogTitle = ref('')
const dialogMessage = ref('')
const dialogType = ref<'alert' | 'confirm' | 'input'>('alert')
const dialogResolve = ref<((value: boolean) => void) | null>(null)
const canEdit = computed(() => authStore.isAuthenticated)
const isAdmin = computed(() => authStore.hasRole('admin'))
const deletingId = ref<string | null>(null)

// Get the latest activity date for an article (including all descendant replies)
const getLatestActivityDate = (articleId: string): number => {
  const article = articleStore.allArticles.find(a => a.id === articleId)
  if (!article) return 0
  
  let latestDate = new Date(article.updatedAt).getTime()
  
  // Check all descendants recursively
  const checkDescendants = (id: string) => {
    const children = articleStore.getChildren(id)
    children.forEach(child => {
      if (!child) return
      const childDate = new Date(child.updatedAt).getTime()
      if (childDate > latestDate) {
        latestDate = childDate
      }
      checkDescendants(child.id)
    })
  }
  
  checkDescendants(articleId)
  return latestDate
}

const VIEW_MODE_KEY = 'haccedit_view_mode'
const EXPANDED_NODES_KEY = 'haccedit_expanded_nodes'
const savedViewMode = localStorage.getItem(VIEW_MODE_KEY) as 'grid' | 'tree' | null
const viewMode = ref<'grid' | 'tree'>(savedViewMode || 'grid')

// Auto-expand first level by default
const savedExpanded = localStorage.getItem(EXPANDED_NODES_KEY)
const initialExpanded = savedExpanded ? new Set<string>(JSON.parse(savedExpanded)) : new Set<string>()
const expandedNodes = ref<Set<string>>(initialExpanded)

onMounted(async () => {
  try {
    await articleStore.fetchByParent(null)
    // If tree view is active, load all articles
    if (viewMode.value === 'tree' && allArticles.value.length === rootArticles.value.length) {
      for (const article of rootArticles.value) {
        if (article) {
          await articleStore.fetchByParent(article.id)
        }
      }
      
      // Auto-expand first level if no saved state
      if (!savedExpanded && rootArticles.value.length > 0) {
        rootArticles.value.forEach(article => {
          if (article) {
            expandedNodes.value.add(article.id)
          }
        })
      }
    }
  } catch (error) {
    console.error('[home] failed to load articles', error)
  }
})

// Build tree structure from all articles
const buildTree = () => {
  type ArticleWithChildren = Article & { children: ArticleWithChildren[] }
  
  const articleMap = new Map<string, ArticleWithChildren>()
  const roots: ArticleWithChildren[] = []

  allArticles.value.forEach(article => {
    articleMap.set(article.id, { ...article, children: [] })
  })

  allArticles.value.forEach(article => {
    const node = articleMap.get(article.id)!
    if (article.parentId) {
      const parent = articleMap.get(article.parentId)
      if (parent) {
        parent.children.push(node)
      }
    } else {
      roots.push(node)
    }
  })

  // Sort by latest activity date (including all descendant replies)
  const sortByLatestActivity = (a: Article, b: Article) => {
    const aLatest = getLatestActivityDate(a.id)
    const bLatest = getLatestActivityDate(b.id)
    return bLatest - aLatest
  }
  
  roots.sort(sortByLatestActivity)
  roots.forEach(root => {
    const sortChildren = (node: ArticleWithChildren): void => {
      node.children.sort(sortByLatestActivity)
      node.children.forEach(sortChildren)
    }
    sortChildren(root)
  })

  return roots
}

const articleTree = computed(() => buildTree())

const formatDate = (iso: string) => new Date(iso).toLocaleDateString()

// Count all replies (descendants) for an article
const getReplyCount = (articleId: string): number => {
  const children = articleStore.getChildren(articleId)
  let count = children.length
  children.forEach(child => {
    if (!child) return
    count += getReplyCount(child.id)
  })
  return count
}

const viewArticle = (id: string) => {
  router.push(`/article/${id}`)
}

const createArticle = () => {
  if (!canEdit.value) {
    router.push({ name: 'login', query: { redirect: '/editor' } })
    return
  }
  router.push('/editor')
}

const toggleViewMode = async () => {
  const newMode = viewMode.value === 'grid' ? 'tree' : 'grid'
  
  if (newMode === 'tree' && allArticles.value.length === rootArticles.value.length) {
    try {
      for (const article of rootArticles.value) {
        if (article) {
          await articleStore.fetchByParent(article.id)
        }
      }
    } catch (error) {
      console.error('[home] failed to load tree data', error)
    }
  }
  
  viewMode.value = newMode
  localStorage.setItem(VIEW_MODE_KEY, newMode)
}

const toggleNode = (nodeId: string) => {
  if (expandedNodes.value.has(nodeId)) {
    expandedNodes.value.delete(nodeId)
  } else {
    expandedNodes.value.add(nodeId)
  }
  // Force reactivity
  expandedNodes.value = new Set(expandedNodes.value)
  // Save to localStorage
  localStorage.setItem(EXPANDED_NODES_KEY, JSON.stringify(Array.from(expandedNodes.value)))
}

const deleteArticle = async (id: string) => {
  if (!isAdmin.value) return
  const confirmed = await showConfirm('Confirm Delete', 'Delete this article and all of its replies? This can only be undone by an admin.')
  if (!confirmed) return

  deletingId.value = id
  try {
    await articleStore.deleteArticle(id)
  } catch (error) {
    console.error('[home] failed to delete article', error)
    const message = error instanceof ApiError ? error.message : 'Failed to delete article. Please try again.'
    showAlert('Error', message)
  } finally {
    deletingId.value = null
  }
}

const showAlert = (title: string, message: string) => {
  dialogTitle.value = title
  dialogMessage.value = message
  dialogType.value = 'alert'
  dialogOpen.value = true
}

const showConfirm = (title: string, message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    dialogTitle.value = title
    dialogMessage.value = message
    dialogType.value = 'confirm'
    dialogResolve.value = resolve
    dialogOpen.value = true
  })
}

const handleDialogConfirm = () => {
  if (dialogResolve.value) {
    dialogResolve.value(true)
    dialogResolve.value = null
  }
  dialogOpen.value = false
}

const handleDialogCancel = () => {
  if (dialogResolve.value) {
    dialogResolve.value(false)
    dialogResolve.value = null
  }
  dialogOpen.value = false
}
</script>

<template>
  <div class="container home-view">
    <div class="header-section">
      <div>
        <h1 class="page-title">Articles</h1>
        <p class="page-subtitle">Browse and explore hierarchical discussions</p>
      </div>
      <div class="header-actions flex-row gap-2">
        <button 
          class="view-toggle flex-row gap-2" 
          @click="toggleViewMode"
          :title="viewMode === 'grid' ? 'Switch to Tree View' : 'Switch to Grid View'"
        >
          <Grid3x3 v-if="viewMode === 'tree'" :size="18" />
          <List v-else :size="18" />
          <span class="desktop-only">{{ viewMode === 'grid' ? 'Tree' : 'Grid' }}</span>
        </button>
        <button v-if="canEdit" class="primary flex-row gap-2" @click="createArticle">
          <Plus :size="20" />
          New Article
        </button>
        <button v-else class="primary flex-row gap-2" @click="createArticle">
          <PenTool :size="20" />
          Sign in to Write
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="loading-state">
      <p>Loading articles...</p>
    </div>

    <div v-else-if="rootArticles.length === 0" class="empty-state">
      <div class="empty-icon">📝</div>
      <h2>No articles yet</h2>
      <p>Be the first to create an article!</p>
      <button class="primary" @click="createArticle">
        Create Article
      </button>
    </div>

    <!-- Grid View -->
    <div v-else-if="viewMode === 'grid'" class="articles-grid">
      <article
        v-for="article in rootArticles"
        :key="article?.id"
        class="article-card"
        @click="article && viewArticle(article.id)"
      >
        <div v-if="isAdmin" class="card-actions">
          <button
            class="delete-icon-btn"
            :disabled="deletingId === article?.id"
            @click.stop="article && deleteArticle(article.id)"
            title="Delete article"
            aria-label="Delete article"
          >
            <Trash2 :size="20" stroke="#b91c1c" :stroke-width="2" />
          </button>
        </div>
        <h2 class="article-title">{{ article?.title }}</h2>
        <div class="article-preview">
          {{ article?.content.replace(/<[^>]*>/g, '').substring(0, 200) }}...
        </div>
        <div class="article-footer">
          <div class="footer-left">
            <span class="author">{{ article?.authorName || article?.author.name }}</span>
            <span class="date">{{ article && formatDate(article.createdAt) }}</span>
          </div>
          <div v-if="article && getReplyCount(article.id) > 0" class="reply-count">
            <MessageSquare :size="14" />
            <span>{{ getReplyCount(article.id) }}</span>
          </div>
        </div>
      </article>
    </div>

    <!-- Tree View -->
    <div v-else class="tree-view">
      <TreeNode 
        v-for="article in articleTree" 
        :key="article.id"
        :article="article"
        :level="0"
        :expanded-nodes="expandedNodes"
        :can-delete="isAdmin"
        :deleting-id="deletingId"
        @toggle="toggleNode"
        @view="viewArticle"
        @delete="deleteArticle"
      />
    </div>
  </div>

  <!-- Alert Dialog -->
  <Dialog
    :is-open="dialogOpen"
    :title="dialogTitle"
    :message="dialogMessage"
    :type="dialogType"
    @confirm="handleDialogConfirm"
    @cancel="handleDialogCancel"
    @close="dialogOpen = false"
  />
</template>

<style scoped>
.home-view {
  padding: 2rem 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  gap: 2rem;
}

.header-actions {
  display: flex;
  flex-shrink: 0;
}

.view-toggle {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.view-toggle:hover {
  border-color: var(--accent-color);
  background: var(--bg-color);
}

.page-title {
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
  font-family: var(--font-serif);
}

.page-subtitle {
  color: var(--text-secondary);
  font-size: 1.1rem;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}

.empty-state {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h2 {
  margin-bottom: 0.5rem;
  color: var(--text-color);
}

.empty-state p {
  margin-bottom: 1.5rem;
}

.articles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.article-card {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.article-card:hover {
  border-color: var(--accent-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.article-card .article-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--text-color);
  font-family: var(--font-serif);
  line-height: 1.3;
}

.card-actions {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: flex;
  gap: 0.5rem;
}

.delete-icon-btn {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #fca5a5;
  border-radius: var(--radius-sm);
  background: #fff5f5;
  color: #b91c1c;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  padding: 0.5rem;
}

.delete-icon-btn svg {
  stroke: #b91c1c !important;
  color: #b91c1c !important;
  width: 20px;
  height: 20px;
}

.delete-icon-btn:hover {
  background: #fee2e2;
  border-color: #f87171;
  transform: scale(1.05);
}

.delete-icon-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.article-preview {
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 1rem;
  min-height: 3.2rem;
}

.article-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.footer-left {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.author {
  font-weight: 600;
}

.reply-count {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--accent-color);
  font-weight: 600;
}

@media (max-width: 768px) {
  .header-section {
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }

  .articles-grid {
    grid-template-columns: 1fr;
  }
}

/* Tree View Styles */
.tree-view {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

:deep(.tree-node) {
  margin: 0;
}

:deep(.tree-node-content) {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  border-bottom: 1px solid transparent;
}

:deep(.tree-node-content:hover) {
  background: color-mix(in srgb, var(--accent-color) 3%, var(--surface-color));
  border-bottom-color: var(--border-color);
}

:deep(.tree-node-content::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: transparent;
  transition: background 0.2s;
}

:deep(.tree-node-content:hover::before) {
  background: var(--accent-color);
}

/* Level-based indentation */
:deep(.tree-node-content.level-0) {
  padding-left: 1.25rem;
}

:deep(.tree-node-content.level-1) {
  padding-left: 2.5rem;
  background: color-mix(in srgb, var(--bg-color) 30%, var(--surface-color));
}

:deep(.tree-node-content.level-2) {
  padding-left: 4rem;
  background: color-mix(in srgb, var(--bg-color) 50%, var(--surface-color));
}

:deep(.tree-node-content.level-3) {
  padding-left: 5.5rem;
  background: color-mix(in srgb, var(--bg-color) 70%, var(--surface-color));
}

:deep(.tree-node-content.level-4) {
  padding-left: 7rem;
  background: var(--bg-color);
}

/* Expand/collapse button */
:deep(.expand-btn) {
  background: none;
  border: none;
  padding: 0.125rem;
  margin-top: 0.25rem;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  flex-shrink: 0;
  transition: all 0.15s;
  opacity: 0.6;
}

:deep(.expand-btn:hover) {
  background: var(--accent-color);
  color: white;
  opacity: 1;
  transform: scale(1.1);
}

:deep(.expand-spacer) {
  width: 18px;
  flex-shrink: 0;
}

/* Node content */
:deep(.node-info) {
  flex: 1;
  min-width: 0;
}

:deep(.node-header) {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
  flex-wrap: wrap;
}

:deep(.node-delete-btn) {
  border: 1px solid #fca5a5;
  background: #fff5f5;
  color: #b91c1c;
  border-radius: 6px;
  padding: 0.2rem 0.45rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 28px;
  transition: all 0.15s ease;
}

:deep(.node-delete-btn:hover) {
  background: #fee2e2;
  border-color: #f87171;
}

:deep(.node-delete-btn:disabled) {
  opacity: 0.6;
  cursor: not-allowed;
}

:deep(.node-title) {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-color);
  line-height: 1.4;
  flex: 1;
  min-width: 200px;
}

:deep(.level-0 .node-title) {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-color);
  font-family: var(--font-serif);
}

:deep(.level-1 .node-title) {
  font-size: 1.1rem;
  font-weight: 600;
}

:deep(.level-2 .node-title) {
  font-size: 1rem;
  font-weight: 500;
}

:deep(.level-3 .node-title),
:deep(.level-4 .node-title) {
  font-size: 0.95rem;
  font-weight: 500;
}

/* Reply badge */
:deep(.reply-badge) {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.6rem;
  background: var(--accent-color);
  color: white;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

:deep(.level-0 .reply-badge) {
  background: var(--accent-color);
}

:deep(.level-1 .reply-badge),
:deep(.level-2 .reply-badge),
:deep(.level-3 .reply-badge),
:deep(.level-4 .reply-badge) {
  background: var(--text-secondary);
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
}

/* Metadata */
:deep(.node-meta) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  opacity: 0.85;
}

:deep(.level-0 .node-meta) {
  font-size: 0.85rem;
}

:deep(.node-author) {
  font-weight: 600;
  color: var(--text-color);
  opacity: 0.7;
}

:deep(.node-dot) {
  opacity: 0.4;
  font-size: 0.7em;
}

:deep(.node-date) {
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}

/* Thread lines */
:deep(.tree-children) {
  position: relative;
}

:deep(.tree-children::before) {
  content: '';
  position: absolute;
  left: 2.25rem;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(to bottom, 
    var(--border-color) 0%, 
    var(--border-color) 90%, 
    transparent 100%);
  opacity: 0.5;
}

:deep(.level-0 > .tree-children::before) {
  background: linear-gradient(to bottom, 
    var(--accent-color) 0%, 
    color-mix(in srgb, var(--accent-color) 50%, var(--border-color)) 90%, 
    transparent 100%);
  opacity: 0.3;
}

:deep(.level-1 > .tree-children::before) {
  left: 3.75rem;
}

:deep(.level-2 > .tree-children::before) {
  left: 5.25rem;
}

:deep(.level-3 > .tree-children::before) {
  left: 6.75rem;
}
</style>
