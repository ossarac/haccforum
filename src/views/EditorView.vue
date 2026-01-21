<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useArticleStore } from '../stores/articleStore'
import { useAuthStore } from '../stores/authStore'
import RichEditor from '../components/Editor/RichEditor.vue'
import TocSidebar from '../components/Editor/TocSidebar.vue'
import Dialog from '../components/Dialog.vue'
import { Download, Eye, Edit, Save, User } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const store = useArticleStore()
const auth = useAuthStore()

const title = ref('')
const authorName = ref('')
const content = ref('')
const parentId = ref<string | null>(null)
const isEditing = ref(false)
const isPreviewMode = ref(false)
const editorRef = ref<InstanceType<typeof RichEditor> | null>(null)
const isSaving = ref(false)
const isPublishing = ref(false)
const errorMessage = ref('')
const isDraft = ref(false)
const isHeaderVisible = ref(true)
const showFloatingButtons = ref(false)
const headerRef = ref<HTMLElement | null>(null)
let headerObserver: IntersectionObserver | null = null

// Dialog state
const dialogOpen = ref(false)
const dialogTitle = ref('')
const dialogMessage = ref('')
const dialogType = ref<'alert' | 'confirm' | 'input'>('alert')

const currentArticleId = computed(() => (route.params.id as string | undefined) ?? null)
const currentArticle = computed(() => (currentArticleId.value ? store.getArticle(currentArticleId.value) : null))

const loadArticle = async (id: string) => {
  try {
    const article = await store.fetchArticle(id)
    title.value = article.title
    authorName.value = article.authorName ?? ''
    content.value = article.content
    parentId.value = article.parentId
    isDraft.value = !article.published
    isEditing.value = true
  } catch (error) {
    console.error('[editor] failed to load article', error)
    errorMessage.value = 'Unable to load article. Try refreshing.'
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
    isDraft.value = false
  }

  if (route.query.parentId) {
    parentId.value = route.query.parentId as string
    if (!isEditing.value) {
      // Fetch parent article to get its title
      const parentArticle = store.getArticle(parentId.value)
      if (parentArticle) {
        title.value = `Re: ${parentArticle.title}`
      } else {
        try {
          const parent = await store.fetchArticle(parentId.value)
          title.value = `Re: ${parent.title}`
        } catch (error) {
          console.error('[editor] failed to load parent article', error)
          title.value = 'Re: '
        }
      }
    }
  }
}

onMounted(() => {
  hydrateFromRoute()

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
    showAlert('Validation Error', 'Please enter a title')
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
    parentId: parentId.value || null
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
    const message = error instanceof Error ? error.message : 'Failed to save draft'
    errorMessage.value = message
    showAlert('Save Error', message)
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
    showAlert('Validation Error', 'Please enter a title')
    return
  }

  if (!auth.user) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }

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
        parentId: parentId.value || null
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
          parentId: parentId.value || null
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
    const message = error instanceof Error ? error.message : 'Failed to publish article'
    errorMessage.value = message
    showAlert('Publish Error', message)
  } finally {
    isPublishing.value = false
  }
}

const showAlert = (title: string, message: string) => {
  dialogTitle.value = title
  dialogMessage.value = message
  dialogType.value = 'alert'
  dialogOpen.value = true
}

const togglePreview = () => {
  isPreviewMode.value = !isPreviewMode.value
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
  <button
    v-if="showFloatingButtons"
    class="floating-toggle"
    @click="togglePreview"
    :title="isPreviewMode ? 'Edit Mode' : 'Preview Mode'"
    aria-label="Toggle preview"
  >
    <Eye v-if="!isPreviewMode" :size="18" />
    <Edit v-else :size="18" />
    <span class="desktop-only">{{ isPreviewMode ? 'Edit' : 'Preview' }}</span>
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
    <span class="desktop-only">{{ isSaving ? 'Saving…' : 'Save Draft' }}</span>
  </button>

  <div class="container mobile-padding">
    <div class="centered-layout">
      <div class="editor-header flex-row justify-between mb-4" ref="headerRef">
        <div class="editor-header-inputs">
          <input 
            v-model="title" 
            type="text" 
            placeholder="Article Title" 
            class="title-input"
            :disabled="isPreviewMode"
          />
          <div class="author-input-container">
            <User :size="16" />
            <input 
              v-model="authorName" 
              type="text" 
              placeholder="Author Name (Optional)" 
              class="author-input"
              :disabled="isPreviewMode"
            />
          </div>
        </div>
        <div class="actions flex-row gap-2">
          <button @click="togglePreview" class="icon-btn" :title="isPreviewMode ? 'Edit Mode' : 'Preview Mode'">
            <Eye v-if="!isPreviewMode" :size="20" />
            <Edit v-else :size="20" />
            <span class="desktop-only">{{ isPreviewMode ? 'Edit' : 'Preview' }}</span>
          </button>
          <button @click="exportHtml" class="icon-btn" title="Export to HTML">
            <Download :size="20" />
          </button>
          <!-- Save Draft button - always available -->
          <button 
            class="secondary-btn" 
            @click="saveDraft" 
            :disabled="isSaving || isPublishing"
            title="Save as draft (not published)"
          >
            <Save :size="18" />
            <span class="desktop-only">{{ isSaving ? 'Saving…' : 'Save Draft' }}</span>
          </button>
          <!-- Publish button -->
          <button 
            class="primary" 
            @click="publish" 
            :disabled="isSaving || isPublishing"
            title="Save and publish article"
          >
            <span v-if="!isPublishing">Publish</span>
            <span v-else>Publishing…</span>
          </button>
        </div>
      </div>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <p v-if="isDraft" class="draft-notice">
        💾 This is a draft. Your changes are saved but not yet published.
      </p>
      
      <RichEditor ref="editorRef" v-model="content" :editable="!isPreviewMode" />
      
      <!-- Table of Contents Sidebar -->
      <TocSidebar :editor="editorRef?.editor" />
    </div>
  </div>

  <!-- Alert Dialog -->
  <Dialog
    :is-open="dialogOpen"
    :title="dialogTitle"
    :message="dialogMessage"
    :type="dialogType"
    @close="dialogOpen = false"
  />
</template>

<style scoped>
.centered-layout {
  max-width: 850px;
  margin: 0 auto;
  width: 100%;
}

.editor-header-inputs {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 0.75rem;
  margin-right: 1rem;
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
}

.author-input {
  font-size: 1rem;
  font-weight: 500;
  border: none;
  border-bottom: 1px dashed transparent;
  background: transparent;
  flex: 1e;
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

.mb-4 { margin-bottom: 1rem; }

.actions {
  flex-shrink: 0;
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

@media (max-width: 1250px) {
  .floating-toggle,
  .floating-save {
    display: none;
  }
}

@media (max-width: 600px) {
  .desktop-only {
    display: none;
  }
}
</style>
