<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useArticleStore } from '../stores/articleStore'
import { useTopicStore } from '../stores/topicStore'
import { useAuthStore } from '../stores/authStore'
import RichEditor from '../components/Editor/RichEditor.vue'
import TocSidebar from '../components/Editor/TocSidebar.vue'
import Dialog from '../components/Dialog.vue'
import { Download, Eye, Edit, Save, User, ChevronUp, ChevronDown, List, X } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const store = useArticleStore()
const topicStore = useTopicStore()
const auth = useAuthStore()

const title = ref('')
const authorName = ref('')
const content = ref('')
const parentId = ref<string | null>(null)
const topicId = ref<string | null>(null)
const isEditing = ref(false)
const isPreviewMode = ref(false)
const editorRef = ref<InstanceType<typeof RichEditor> | null>(null)
const isSaving = ref(false)
const isPublishing = ref(false)
const errorMessage = ref('')
const isDraft = ref(false)
const isHeaderVisible = ref(true)
const showFloatingButtons = ref(false)
const showMobileToc = ref(false)
const showMobileActions = ref(false)
const headerRef = ref<HTMLElement | null>(null)
let headerObserver: IntersectionObserver | null = null

// Dialog state
const dialogOpen = ref(false)
const dialogTitle = ref('')
const dialogMessage = ref('')
const dialogType = ref<'alert' | 'confirm' | 'input'>('alert')
const pendingPublishCallback = ref<(() => void) | null>(null)

const currentArticleId = computed(() => (route.params.id as string | undefined) ?? null)
const currentArticle = computed(() => (currentArticleId.value ? store.getArticle(currentArticleId.value) : null))

// Topic can be changed if: article is draft, OR user is admin
const canChangeTopic = computed(() => {
  // New articles can always change topic
  if (!isEditing.value) return true
  
  // Drafts can change topic
  if (isDraft.value) return true
  
  // Admins can change topic on published articles
  if (auth.hasRole('admin')) return true
  
  return false
})

const loadArticle = async (id: string) => {
  try {
    const article = await store.fetchArticle(id)
    title.value = article.title
    authorName.value = article.authorName ?? ''
    content.value = article.content
    parentId.value = article.parentId
    topicId.value = article.topicId
    isDraft.value = !article.published
    isEditing.value = true
  } catch (error) {
    console.error('[editor] failed to load article', error)
    errorMessage.value = t('editor.unableToLoad')
  }
}

const hydrateFromRoute = async () => {
  isEditing.value = false
  errorMessage.value = ''

  if (currentArticleId.value) {
    if (currentArticle.value) {
      authorName.value = currentArticle.value.authorName ?? ''
      title.value = currentArticle.value.title
      content.value = currentArticle.value.content
      parentId.value = currentArticle.value.parentId
      topicId.value = currentArticle.value.topicId
      isDraft.value = !currentArticle.value.published
      isEditing.value = true
    } else {
      loadArticle(currentArticleId.value)
    }
  } else {
    authorName.value = ''
    title.value = ''
    content.value = ''
    parentId.value = null
    topicId.value = null
    isDraft.value = false
  }

  if (route.query.parentId) {
    parentId.value = route.query.parentId as string
    if (!isEditing.value) {
      // Fetch parent article to get its title
      const parentArticle = store.getArticle(parentId.value)
      if (parentArticle) {
        title.value = `Re: ${parentArticle.title}`
        topicId.value = parentArticle.topicId
      } else {
        try {
          const parent = await store.fetchArticle(parentId.value)
          title.value = `Re: ${parent.title}`
          topicId.value = parent.topicId
        } catch (error) {
          console.error('[editor] failed to load parent article', error)
          title.value = 'Re: '
        }
      }
    }
  }

  // Handle topicId query parameter for new articles
  if (route.query.topicId && !isEditing.value) {
    topicId.value = route.query.topicId as string
  }
}

onMounted(async () => {
  hydrateFromRoute()
  
  // Load topics for topic selector
  if (topicStore.topics.length === 0) {
    await topicStore.fetchTopics()
  }

  // Hide floating buttons when header is in view
  headerObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      if (!entry) return
      isHeaderVisible.value = entry.isIntersecting
      showFloatingButtons.value = !entry.isIntersecting
    },
    {
      root: null,
      threshold: 0.1,
      rootMargin: '0px'
    }
  )

  if (headerRef.value) {
    headerObserver.observe(headerRef.value)
  }
})

onUnmounted(() => {
  headerObserver?.disconnect()
  headerObserver = null
})

watch(
  () => route.fullPath,
  () => {
    hydrateFromRoute()
  }
)

/**
 * Save as draft - creates a new article or updates existing one with published=false
 * Users can repeatedly save drafts without publishing
 */
const saveDraft = async () => {
  if (!title.value.trim()) {
    showAlert(t('editor.validationError'), t('editor.pleaseEnterTitle'))
    return
  }

  if (!auth.user) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }

  isSaving.value = true
  errorMessage.value = ''

  const payload = {
    id: currentArticleId.value ?? undefined,
    authorName: authorName.value,
    title: title.value,
    content: content.value,
    parentId: parentId.value || null,
    topicId: topicId.value || null
  }

  try {
    const saved = await store.saveArticle(payload)
    isDraft.value = !saved.published
    
    // Navigate to the saved draft if it's a new article
    if (!currentArticleId.value) {
      router.push(`/editor/${saved.id}`)
    }
  } catch (error) {
    console.error('[editor] failed to save draft', error)
    const message = error instanceof Error ? error.message : t('editor.failedToSaveDraft')
    errorMessage.value = message
    showAlert(t('editor.saveError'), message)
  } finally {
    isSaving.value = false
  }
}

/**
 * Publish article - saves content and marks article as published
 * This makes it visible on the dashboard
 */
const publish = async () => {
  if (!title.value.trim()) {
    showAlert(t('editor.validationError'), t('editor.pleaseEnterTitle'))
    return
  }

  if (!auth.user) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }

  // Show confirmation dialog with topic information
  const topicName = topicId.value 
    ? topicStore.flatTopicList.find(t => t.id === topicId.value)?.displayName || 'Unknown'
    : t('editor.noTopic')
  
  showConfirm(
    t('editor.publish'),
    t('editor.confirmPublish') + `\n\n${t('editor.title')}: ${title.value}\n${t('editor.selectTopic')}: ${topicName}\n\n${t('editor.oncePublished')}`,
    async () => {
      await doPublish()
    }
  )
}

const doPublish = async () => {
  isPublishing.value = true
  errorMessage.value = ''

  try {
    // First save the article content if it's new or has unpublished changes
    let articleId = currentArticleId.value
    
    if (!articleId) {
      // Create new article first
      const saved = await store.saveArticle({
        title: title.value,
        content: content.value,
        authorName: authorName.value,
        parentId: parentId.value || null,
        topicId: topicId.value || null
      })
      articleId = saved.id
    } else {
      // Update existing article
      const current = store.getArticle(articleId)
      if (current) {
        await store.saveArticle({
          id: articleId,
          title: title.value,
          content: content.value,
          authorName: authorName.value,
          parentId: parentId.value || null,
          topicId: topicId.value || null
        })
      }
    }

    // Then publish it
    const published = await store.publishArticle(articleId)
    isDraft.value = false

    if (published.parentId) {
      router.push(`/article/${published.parentId}`)
    } else {
      router.push(`/article/${published.id}`)
    }
  } catch (error) {
    console.error('[editor] failed to publish article', error)
    const message = error instanceof Error ? error.message : t('editor.failedToPublish')
    errorMessage.value = message
    showAlert(t('editor.publishError'), message)
  } finally {
    isPublishing.value = false
  }
}

const showAlert = (title: string, message: string) => {
  dialogTitle.value = title
  dialogMessage.value = message
  dialogType.value = 'alert'
  dialogOpen.value = true
  pendingPublishCallback.value = null
}

const showConfirm = (title: string, message: string, callback: () => void) => {
  dialogTitle.value = title
  dialogMessage.value = message
  dialogType.value = 'confirm'
  dialogOpen.value = true
  pendingPublishCallback.value = callback
}

const handleDialogConfirm = () => {
  if (pendingPublishCallback.value) {
    pendingPublishCallback.value()
    pendingPublishCallback.value = null
  }
}

const handleDialogClose = () => {
  dialogOpen.value = false
  pendingPublishCallback.value = null
}

const togglePreview = () => {
  isPreviewMode.value = !isPreviewMode.value
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const scrollToBottom = () => {
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
}

const exportHtml = () => {
  const css = `
    :root {
      --bg-color: #fafafa;
      --text-color: #212121;
      --text-secondary: #666666;
      --surface-color: #ffffff;
      --border-color: #e0e0e0;
      --accent-color: #2563eb;
      --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
      --font-serif: 'Merriweather', serif;
      
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --radius-sm: 0.375rem;
      --radius-md: 0.5rem;
    }
    body { 
        font-family: var(--font-sans); 
        color: var(--text-color); 
        background: var(--bg-color); 
        max-width: 800px; 
        margin: 2rem auto; 
        padding: 0 1rem; 
        line-height: 1.6;
    }
    h1 { font-family: var(--font-serif); font-size: 2.5rem; }
    /* Context Component */
    .context-component {
      background-color: var(--bg-color);
      border: 1px solid var(--accent-color);
      border-radius: var(--radius-md);
      margin: 1.5rem 0;
      padding: 1rem;
    }
    /* Tooltip */
    .custom-tooltip {
      background-color: rgba(255, 255, 0, 0.3);
      border-bottom: 2px solid var(--accent-color);
      cursor: help;
      position: relative;
    }
    .custom-tooltip:hover::after {
      content: attr(data-tooltip);
      position: absolute;
      background-color: var(--text-color);
      color: var(--bg-color);
      padding: 0.5rem 1rem;
      border-radius: var(--radius-sm);
      bottom: 100%; left: 50%; transform: translateX(-50%);
      white-space: nowrap; margin-bottom: 5px;
      z-index: 10;
    }
  `
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${title.value}</title>
      <style>${css}</style>
    </head>
    <body>
      <h1>${title.value}</h1>
      <div class="content">${content.value}</div>
    </body>
    </html>
  `
  
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.value.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <!-- Backdrop for mobile TOC -->
  <div
    v-if="showMobileToc"
    class="toc-backdrop mobile-only"
    @click="showMobileToc = false"
  ></div>

  <!-- Mobile TOC Toggle Button (appears on narrow screens) -->
  <button
    class="mobile-toc-toggle mobile-only"
    @click="showMobileToc = !showMobileToc"
    :title="showMobileToc ? t('toc.close') : t('toc.open')"
    :aria-label="showMobileToc ? t('toc.close') : t('toc.open')"
  >
    <X v-if="showMobileToc" :size="20" />
    <List v-else :size="20" />
  </button>

  <!-- Mobile Actions Toggle Button (appears on narrow screens) -->
  <button
    class="mobile-actions-toggle mobile-only"
    @click="showMobileActions = !showMobileActions"
    :title="showMobileActions ? t('common.close') : t('editor.actions')"
    :aria-label="showMobileActions ? t('common.close') : t('editor.actions')"
  >
    <X v-if="showMobileActions" :size="20" />
    <ChevronUp v-else :size="20" />
  </button>

  <!-- Mobile Actions Panel -->
  <div v-if="showMobileActions" class="mobile-actions-panel mobile-only">
    <button
      class="mobile-action-btn"
      @click="togglePreview"
      :title="isPreviewMode ? t('editor.editMode') : t('editor.previewMode')"
    >
      <Eye v-if="!isPreviewMode" :size="18" />
      <Edit v-else :size="18" />
      <span>{{ isPreviewMode ? t('editor.editMode') : t('editor.previewMode') }}</span>
    </button>
    <button
      v-if="!isPreviewMode"
      class="mobile-action-btn"
      @click="saveDraft"
      :disabled="isSaving || isPublishing"
      :title="t('editor.saveDraft')"
    >
      <Save :size="18" />
      <span>{{ isSaving ? t('editor.savingDraft') : t('editor.saveDraft')}}</span>
    </button>
    <button
      class="mobile-action-btn"
      @click="scrollToTop"
      :title="t('common.goToTop')"
    >
      <ChevronUp :size="18" />
      <span>{{ t('common.goToTop') }}</span>
    </button>
    <button
      class="mobile-action-btn"
      @click="scrollToBottom"
      :title="t('common.goToBottom')"
    >
      <ChevronDown :size="18" />
      <span>{{ t('common.goToBottom') }}</span>
    </button>
  </div>

  <button
    v-if="showFloatingButtons"
    class="floating-toggle"
    @click="togglePreview"
    :title="isPreviewMode ? 'Edit Mode' : 'Preview Mode'"
    aria-label="Toggle preview"
  >
    <Eye v-if="!isPreviewMode" :size="18" />
    <Edit v-else :size="18" />
    <span class="desktop-only">{{ isPreviewMode ? t('editor.editMode') : t('editor.previewMode') }}</span>
  </button>

  <button
    v-if="showFloatingButtons && !isPreviewMode"
    class="floating-save secondary-btn"
    @click="saveDraft"
    :disabled="isSaving || isPublishing"
    title="Save draft (stay here)"
    aria-label="Save draft"
  >
    <Save :size="18" />
    <span class="desktop-only">{{ isSaving ? t('editor.savingDraft') : t('editor.saveDraft')}}</span>
  </button>

  <button
    v-if="showFloatingButtons"
    class="floating-scroll-top"
    @click="scrollToTop"
    title="Go to top"
    aria-label="Go to top"
  >
    <ChevronUp :size="18" />
  </button>

  <button
    v-if="showFloatingButtons"
    class="floating-scroll-bottom"
    @click="scrollToBottom"
    title="Go to bottom"
    aria-label="Go to bottom"
  >
    <ChevronDown :size="18" />
  </button>

  <div class="container mobile-padding">
    <div class="centered-layout">
      <div class="editor-header flex-row justify-between mb-4" ref="headerRef">
        <div class="editor-header-inputs">
          <input 
            v-model="title" 
            type="text" 
            :placeholder="t('editor.articleTitlePlaceholder')" 
            class="title-input"
            :disabled="isPreviewMode"
          />
          <div class="author-input-container">
            <User :size="16" />
            <input 
              v-model="authorName" 
              type="text" 
              :placeholder="t('editor.authorNamePlaceholder')" 
              class="author-input"
              :disabled="isPreviewMode"
            />
          </div>
          <!-- Topic selector - shown for all articles, but disabled for replies -->
          <div class="topic-selector-container">
            <label for="topic-select">
              {{ t('editor.selectTopic') }}{{ parentId ? ` (${t('editor.inheritedFromParent')})` : '' }}:
            </label>
            <select 
              id="topic-select"
              v-model="topicId" 
              class="topic-select"
              :disabled="isPreviewMode || !canChangeTopic || !!parentId"
            >
              <option value="">{{ t('editor.selectATopicPlaceholder') }}</option>
              <option 
                v-for="topic in topicStore.flatTopicList" 
                :key="topic.id" 
                :value="topic.id"
              >
                {{ topic.displayName }}
              </option>
            </select>
          </div>
        </div>
        <div class="actions flex-row gap-2">
          <button @click="togglePreview" class="icon-btn" :title="isPreviewMode ? t('editor.editMode') : t('editor.previewMode')">
            <Eye v-if="!isPreviewMode" :size="20" />
            <Edit v-else :size="20" />
            <span class="desktop-only">{{ isPreviewMode ? t('editor.editMode') : t('editor.previewMode') }}</span>
          </button>
          <button @click="exportHtml" class="icon-btn" :title="t('editor.exportToHtml')">
            <Download :size="20" />
          </button>
          <!-- Save Draft button - always available -->
          <button 
            class="secondary-btn" 
            @click="saveDraft" 
            :disabled="isSaving || isPublishing"
            :title="t('editor.saveDraft')"
          >
            <Save :size="18" />
            <span class="desktop-only">{{ isSaving ? t('editor.savingDraft') : t('editor.saveDraft') }}</span>
          </button>
          <!-- Publish button -->
          <button 
            class="primary" 
            @click="publish" 
            :disabled="isSaving || isPublishing"
            :title="t('editor.savePublish')"
          >
            <span v-if="!isPublishing">{{ t('editor.publish') }}</span>
            <span v-else>{{ t('editor.publishing') }}</span>
          </button>
        </div>
      </div>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <p v-if="isDraft" class="draft-notice">
        {{ t('editor.draftNotice') }}
      </p>
      
      <RichEditor ref="editorRef" v-model="content" :editable="!isPreviewMode" />
      
      <!-- Table of Contents Sidebar -->
      <TocSidebar :editor="editorRef?.editor" :is-open="showMobileToc" @close="showMobileToc = false" />
    </div>
  </div>

  <!-- Alert Dialog -->
  <Dialog
    :is-open="dialogOpen"
    :title="dialogTitle"
    :message="dialogMessage"
    :type="dialogType"
    @close="handleDialogClose"
    @confirm="handleDialogConfirm"
  />
</template>

<style scoped>
.centered-layout {
  max-width: 850px;
  margin: 0 auto;
  width: 100%;
}

.editor-header {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.editor-header-inputs {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: 0.75rem;
  min-width: 0;
  overflow: hidden;
}

.author-input-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
}

.title-input {
  font-size: 2.25rem; /* Larger title */
  font-weight: 800;
  border: none;
  background: transparent;
  width: 100%;
  outline: none;
  padding: 0; 
  min-width: 0;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
}

.author-input {
  font-size: 1rem;
  font-weight: 500;
  border: none;
  border-bottom: 1px dashed transparent;
  background: transparent;
  flex: 1;
  border-bottom: 1px dashed transparent;
  background: transparent;
  width: 100%;
  outline: none;
  padding: 0.25rem 0;
  color: var(--text-secondary);
  transition: border-color 0.2s;
}

.author-input:hover, .author-input:focus {
  border-bottom-color: var(--border-color);
}

.author-input:placeholder-shown {
  font-style: italic;
}

.title-input:focus, .author-input:focus {
  outline: none;
}

.title-input:disabled, .author-input:disabled {
  color: var(--text-color);
  opacity: 1;
}

.topic-selector-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.topic-select {
  font-size: 0.95rem;
  border: 1px solid var(--border-color);
  background: var(--surface-color);
  color: var(--text-color);
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  outline: none;
  transition: border-color 0.2s;
  flex: 1;
}

.topic-select:hover {
  border-color: var(--accent-color);
}

.topic-select:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.topic-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.mb-4 { margin-bottom: 1rem; }

.actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
  flex-wrap: wrap;
}

.icon-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.secondary-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--text-color);
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
}

.secondary-btn:hover:not(:disabled) {
  border-color: var(--accent-color);
  background: var(--bg-color);
  color: var(--accent-color);
}

.secondary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.desktop-only {
  font-size: 0.9rem;
}

.error {
  color: #dc2626;
  margin-bottom: 1rem;
}

.draft-notice {
  background: rgba(37, 99, 235, 0.1);
  border-left: 3px solid var(--accent-color);
  color: var(--text-color);
  padding: 1rem;
  margin-bottom: 1.5rem;
  border-radius: 4px;
}

.floating-toggle,
.floating-save {
  position: fixed;
  top: 240px;
  right: max(2rem, calc(50% - 680px));
  z-index: 95;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.08);
  background: var(--surface-color);
  border-color: var(--border-color);
  backdrop-filter: blur(6px);
}

.floating-toggle {
  top: 180px;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
}

.floating-toggle:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.floating-save:disabled {
  opacity: 0.7;
}

.floating-scroll-top,
.floating-scroll-bottom {
  position: fixed;
  right: max(2rem, calc(50% - 680px));
  z-index: 95;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.08);
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  backdrop-filter: blur(6px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-color);
}

.floating-scroll-top {
  top: 310px;
}

.floating-scroll-bottom {
  top: 356px;
}

.floating-scroll-top:hover,
.floating-scroll-bottom:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

@media (max-width: 1350px) {
  .floating-toggle,
  .floating-save,
  .floating-scroll-top,
  .floating-scroll-bottom {
    display: none;
  }
}

.mobile-toc-toggle,
.mobile-actions-toggle {
  display: none;
  position: fixed;
  z-index: 998;
  width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
}

.mobile-only {
  display: none;
}

@media (max-width: 1350px) {
  .mobile-only {
    display: flex;
  }

  .mobile-actions-panel.mobile-only {
    display: flex;
    flex-direction: column;
  }

  .toc-backdrop.mobile-only {
    display: block;
  }
}

.mobile-toc-toggle:hover,
.mobile-actions-toggle:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.mobile-toc-toggle {
  top: 120px;
  right: 1rem;
}

.mobile-actions-toggle {
  bottom: 1rem;
  right: 1rem;
}

.mobile-actions-panel {
  position: fixed;
  bottom: 80px;
  right: 1rem;
  z-index: 997;
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.5rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 200px;
}

.mobile-action-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-color);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.mobile-action-btn:hover:not(:disabled) {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.mobile-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toc-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 998;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (max-width: 768px) {
  .editor-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .editor-header-inputs {
    margin-right: 0;
  }
  
  .actions {
    justify-content: flex-start;
    width: 100%;
  }
  
  .title-input {
    font-size: 1.75rem;
  }
}

@media (max-width: 600px) {
  .desktop-only {
    display: none;
  }
  
  .title-input {
    font-size: 1.5rem;
  }
}
</style>
