<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed, onMounted, ref, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Calendar, User, MessageSquare, ArrowLeft, Palette, Copy, Download, Undo, Trash2, ChevronUp, ChevronDown, List, X } from 'lucide-vue-next'
import { ApiError } from '../api/client'
import RichEditor from '../components/Editor/RichEditor.vue'
import TocSidebar from '../components/Editor/TocSidebar.vue'
import Dialog from '../components/Dialog.vue'
import { useArticleStore } from '../stores/articleStore'
import { useAuthStore } from '../stores/authStore'
import { API_BASE_URL } from '../api/client'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useArticleStore()
const auth = useAuthStore()

const articleId = computed(() => route.params.id as string)
const article = computed(() => store.getArticle(articleId.value))
const replies = computed(() =>
  store.getChildren(articleId.value).filter(child => !!child && child.published && !child.deleted)
)
const editorRef = ref<InstanceType<typeof RichEditor> | null>(null)
const articleLoading = computed(() => store.loadingStates[articleId.value] ?? false)
const repliesLoading = computed(() => store.loadingStates[articleId.value ?? 'root'] ?? false)
const isDuplicating = ref(false)
const isExporting = ref(false)
const isUnpublishing = ref(false)
const isDeleting = ref(false)
const showFloatingButtons = ref(false)
const showMobileToc = ref(false)
const showMobileScrollButtons = ref(false)
const showMobileButtons = ref(true)
const articleHeaderRef = ref<HTMLElement | null>(null)
let scrollObserver: IntersectionObserver | null = null
let inactivityTimer: ReturnType<typeof setTimeout> | null = null

// Dialog state
const dialogOpen = ref(false)
const dialogTitle = ref('')
const dialogMessage = ref('')
const dialogType = ref<'alert' | 'confirm' | 'input'>('alert')
const dialogResolve = ref<((value: boolean) => void) | null>(null)
const isAuthor = computed(
  () => !!auth.user && !!article.value && article.value.author.id === auth.user.id
)
const isAdmin = computed(() => auth.hasRole('admin'))

const canDuplicate = computed(() => {
  if (!auth.user || !article.value) return false
  return article.value.published && article.value.author.id === auth.user.id
})

const canExport = computed(() => {
  if (!auth.user || !article.value) return false
  return true
})

const canUnpublish = computed(() => {
  if (!auth.user || !article.value) return false
  if (!article.value.published) return false
  if (article.value.author.id !== auth.user.id) return false
  if (replies.value.length > 0) return false

  const publishedAt = article.value.publishedAt ?? article.value.updatedAt ?? article.value.createdAt
  const publishedTime = new Date(publishedAt).getTime()
  if (Number.isNaN(publishedTime)) return false

  const withinWindow = Date.now() - publishedTime <= 24 * 60 * 60 * 1000
  return withinWindow
})

const canDelete = computed(() => {
  if (!isAdmin.value || !article.value) return false
  return !article.value.deleted
})

type BackgroundPreset = {
  id: string
  label: string
  description: string
  style: CSSProperties
}

type FontPreset = {
  id: string
  label: string
  fontFamily: string
}

type DocWidthPreset = {
  id: string
  label: string
  maxWidth: string
}

// Simple helpers to derive a slightly darker tone for the context surface
const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '')
  if (![3, 6].includes(normalized.length)) return null
  const value = normalized.length === 3
    ? normalized.split('').map(c => c + c).join('')
    : normalized
  const intVal = Number.parseInt(value, 16)
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255
  }
}

const darkenColor = (hex: string, amount = 0.1) => {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const factor = 1 - amount
  const r = Math.round(rgb.r * factor)
  const g = Math.round(rgb.g * factor)
  const b = Math.round(rgb.b * factor)
  return `rgb(${r}, ${g}, ${b})`
}

const textOnBackground = (hexBg: string, lightText = '#f8fafc', darkText = '#0b0d11') => {
  const rgb = hexToRgb(hexBg)
  if (!rgb) return lightText
  // Relative luminance per WCAG
  const srgb = [rgb.r, rgb.g, rgb.b].map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  const luminance = 0.2126 * srgb[0]! + 0.7152 * srgb[1]! + 0.0722 * srgb[2]!
  return luminance > 0.35 ? darkText : lightText
}

const backgroundPresets: BackgroundPreset[] = [
  {
    id: 'clean-light',
    label: 'Clean Light',
    description: 'Neutral white for daytime reading',
    style: { backgroundColor: '#ffffff', color: '#1f2933' }
  },
  {
    id: 'soft-gray',
    label: 'Soft Gray',
    description: 'Low-glare gray that cuts screen brightness',
    style: { backgroundColor: '#f2f4f7', color: '#111827' }
  },
  {
    id: 'warm-sepia',
    label: 'Warm Sepia',
    description: 'Paper-like warmth for relaxed reading',
    style: { backgroundColor: '#f6efe5', color: '#2f1f0f' }
  },
  {
    id: 'dark-slate',
    label: 'Dark Slate',
    description: 'Dim-room friendly with high contrast text',
    style: { backgroundColor: '#1f2430', color: '#f5f5f5' }
  },
  {
    id: 'midnight-ink',
    label: 'Midnight Ink',
    description: 'True black with cool text for OLEDs',
    style: { backgroundColor: '#0b0d11', color: '#e5e7eb' }
  },
  {
    id: 'graphite',
    label: 'Graphite',
    description: 'Charcoal base with soft gray text',
    style: { backgroundColor: '#191b22', color: '#d6d9df' }
  },
  {
    id: 'noir-sepia',
    label: 'Noir Sepia',
    description: 'Dark coffee backdrop with warm text',
    style: { backgroundColor: '#1a1410', color: '#f0e2d0' }
  },
  {
    id: 'paper-texture',
    label: 'Paper Texture',
    description: 'Subtle grain on off-white background',
    style: {
      backgroundColor: '#fbf8f1',
      color: '#2f2a25',
      backgroundImage:
        'linear-gradient(rgba(0,0,0,0.02) 1px, transparent 0), linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 0)',
      backgroundSize: '20px 20px'
    }
  },
  {
    id: 'newsprint',
    label: 'Newsprint',
    description: 'Muted newsprint feel with tiny fibers',
    style: {
      backgroundColor: '#f1ede4',
      color: '#2c241b',
      backgroundImage:
        'linear-gradient(180deg, rgba(0,0,0,0.015) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.015) 50%, rgba(0,0,0,0.015) 75%, transparent 75%, transparent)',
      backgroundSize: '8px 8px'
    }
  }
]

const fontPresets: FontPreset[] = [
  { id: 'serif', label: 'Serif', fontFamily: "'Merriweather', serif" },
  { id: 'sans', label: 'Sans', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
  { id: 'slab', label: 'Slab', fontFamily: "'Roboto Slab', 'Merriweather', serif" },
  { id: 'humanist', label: 'Humanist', fontFamily: "'Source Sans Pro', 'Inter', sans-serif" },
  { id: 'mono', label: 'Mono', fontFamily: "'JetBrains Mono', 'SFMono-Regular', monospace" },
  { id: 'georgia', label: 'Georgia', fontFamily: "Georgia, 'Times New Roman', serif" },
  { id: 'open-sans', label: 'Open Sans', fontFamily: "'Open Sans', 'Inter', sans-serif" },
  { id: 'lora', label: 'Lora', fontFamily: "'Lora', 'Merriweather', serif" },
  { id: 'plex-sans', label: 'IBM Plex Sans', fontFamily: "'IBM Plex Sans', 'Inter', sans-serif" },
  { id: 'noto-serif', label: 'Noto Serif', fontFamily: "'Noto Serif', 'Merriweather', serif" }
]

const fontSizes = ['15px', '16px', '18px', '20px', '22px', '24px']
const lineHeights = [1.4, 1.6, 1.8, 2.0]

const docWidthPresets: DocWidthPreset[] = [
  { id: 'narrow', label: 'Narrow', maxWidth: '620px' },
  { id: 'default', label: 'Default', maxWidth: '760px' },
  { id: 'wide', label: 'Wide', maxWidth: '900px' },
  { id: 'full', label: 'Full', maxWidth: '100%' }
]

const defaultBackground = backgroundPresets[0]!
const defaultFont = fontPresets[0]!
const defaultDocWidth = docWidthPresets[1] ?? docWidthPresets[0]!

const STORAGE_KEY = 'haccedit-reader-settings'

const loadSettings = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch (e) {
    console.error('Failed to load reader settings', e)
  }
  return null
}

const savedSettings = loadSettings()

// Prioritize authenticated user settings, then local storage, then defaults
const getInitialValue = <T>(
  key: 'backgroundId' | 'fontId' | 'fontSize' | 'lineHeight' | 'docWidthId',
  defaultValue: T
): T => {
  if (auth.user?.readingPreferences?.[key]) {
    return auth.user.readingPreferences[key] as unknown as T
  }
  // @ts-ignore - dynamic key access on savedSettings
  return savedSettings?.[key] ?? defaultValue
}

const showReaderToolbar = ref(false)
const selectedBackgroundId = ref<BackgroundPreset['id']>(
  getInitialValue('backgroundId', defaultBackground.id) as BackgroundPreset['id']
)
const selectedFontId = ref<FontPreset['id']>(
  getInitialValue('fontId', defaultFont.id) as FontPreset['id']
)
const selectedFontSize = ref<string>(getInitialValue('fontSize', '18px'))
const selectedLineHeight = ref<number>(getInitialValue('lineHeight', 1.6))
const selectedDocWidthId = ref<DocWidthPreset['id']>(
  getInitialValue('docWidthId', defaultDocWidth.id) as DocWidthPreset['id']
)

// Sync from server if user logs in or data updates
watch(
  () => auth.user?.readingPreferences,
  newPrefs => {
    if (!newPrefs) return
    if (newPrefs.backgroundId) selectedBackgroundId.value = newPrefs.backgroundId
    if (newPrefs.fontId) selectedFontId.value = newPrefs.fontId
    if (newPrefs.fontSize) selectedFontSize.value = newPrefs.fontSize
    if (newPrefs.lineHeight) selectedLineHeight.value = newPrefs.lineHeight
    if (newPrefs.docWidthId) selectedDocWidthId.value = newPrefs.docWidthId as DocWidthPreset['id']
  },
  { deep: true, immediate: true }
)

// Save changes
watch(
  [selectedBackgroundId, selectedFontId, selectedFontSize, selectedLineHeight, selectedDocWidthId],
  async ([bgId, fontId, size, height, width]) => {
    const prefs = {
      backgroundId: bgId,
      fontId: fontId,
      fontSize: size,
      lineHeight: height,
      docWidthId: width
    }

    // Always save to local storage as fallback/cache
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))

    // Save to server if logged in
    if (auth.user) {
      try {
        await auth.updateReadingPreferences(prefs)
      } catch (e) {
        console.error('Failed to save preferences to server', e)
      }
    }
  }
)

const selectedBackground = computed(
  () => backgroundPresets.find(preset => preset.id === selectedBackgroundId.value) ?? defaultBackground
)
const selectedFont = computed(() => fontPresets.find(preset => preset.id === selectedFontId.value) ?? defaultFont)
const selectedDocWidth = computed(
  () => docWidthPresets.find(preset => preset.id === selectedDocWidthId.value) ?? defaultDocWidth
)

const contextSurfaceColor = computed(() => {
  const base = selectedBackground.value.style.backgroundColor || '#ffffff'
  // Slightly stronger darken on lighter backgrounds; gentle on dark ones
  const amount = ['dark', 'midnight', 'graphite', 'noir'].some(key => selectedBackgroundId.value.includes(key))
    ? 0.05
    : 0.1
  return darkenColor(base, amount)
})

const contextTextColor = computed(() => {
  const base = selectedBackground.value.style.backgroundColor || '#ffffff'
  return textOnBackground(base)
})

const readerSurfaceStyle = computed<CSSProperties>(() => ({
  ...selectedBackground.value.style,
  color: selectedBackground.value.style.color ?? 'inherit'
  ,
  fontFamily: selectedFont.value.fontFamily,
  fontSize: selectedFontSize.value,
  lineHeight: selectedLineHeight.value,
  maxWidth: selectedDocWidth.value.maxWidth,
  width: '100%',
  marginInline: 'auto',
  // Context blocks should follow the chosen reader background but be a touch darker
  '--reader-line-height': selectedLineHeight.value,
  '--context-surface': contextSurfaceColor.value,
  '--context-text': contextTextColor.value
}))

const presetSwatchStyle = (preset: BackgroundPreset): CSSProperties => ({
  backgroundColor: preset.style.backgroundColor,
  backgroundImage: preset.style.backgroundImage,
  backgroundSize: preset.style.backgroundSize,
  backgroundPosition: preset.style.backgroundPosition,
  backgroundRepeat: preset.style.backgroundRepeat ?? 'repeat'
})

const formatDate = (iso: string) => new Date(iso).toLocaleDateString()

const replyToArticle = () => {
  router.push({ path: '/editor', query: { parentId: articleId.value } })
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

const duplicateToDraft = async () => {
  if (!article.value) return
  if (!auth.user) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }

  isDuplicating.value = true
  try {
    const draft = await store.duplicateToDraft(article.value.id)
    router.push(`/editor/${draft.id}`)
  } catch (error) {
    console.error('[article] failed to duplicate', error)
    showAlert('Error', 'Failed to create draft copy. Please try again.')
  } finally {
    isDuplicating.value = false
  }
}

const unpublishArticle = async () => {
  if (!article.value) return
  if (!auth.user) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }

  isUnpublishing.value = true
  try {
    await store.unpublishArticle(article.value.id)
    router.push('/drafts')
  } catch (error) {
    console.error('[article] failed to unpublish', error)
    showAlert('Error', 'Unable to unpublish. The article may have replies or the 24-hour window has passed.')
  } finally {
    isUnpublishing.value = false
  }
}

const deleteArticle = async () => {
  if (!article.value) return
  if (!auth.user) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }

  const confirmed = await showConfirm('Confirm Delete', 'Delete this article and all of its replies? This can only be undone by an admin.')
  if (!confirmed) return

  isDeleting.value = true
  try {
    await store.deleteArticle(article.value.id)
    const targetPath = article.value.parentId ? `/article/${article.value.parentId}` : '/'
    router.push(targetPath)
  } catch (error) {
    console.error('[article] failed to delete', error)
    const message = error instanceof ApiError ? error.message : 'Failed to delete article. Please try again.'
    showAlert('Error', message)
  } finally {
    isDeleting.value = false
  }
}

const goToParent = () => {
  if (article.value?.parentId) {
    router.push(`/article/${article.value.parentId}`)
  }
}

const exportArticle = async () => {
  if (!article.value) return
  if (!auth.user || !auth.token) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }

  isExporting.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/articles/${article.value.id}/export`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`
      }
    })

    if (!response.ok) {
      const message = (await response.json().catch(() => null))?.message ?? 'Export failed'
      throw new Error(message)
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${article.value.title || 'article'}.html`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('[article] export failed', error)
    alert((error as Error).message || 'Failed to export article')
  } finally {
    isExporting.value = false
  }
}

const loadArticle = async (id: string) => {
  if (!id) return
  try {
    await Promise.all([store.fetchArticle(id), store.fetchByParent(id)])
  } catch (error) {
    console.error('[article] failed to load', error)
  }
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const scrollToBottom = () => {
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
}

const resetInactivityTimer = () => {
  showMobileButtons.value = true
  
  if (inactivityTimer) {
    clearTimeout(inactivityTimer)
  }
  
  inactivityTimer = setTimeout(() => {
    showMobileButtons.value = false
  }, 3500) // Hide after 3.5 seconds of inactivity
}

const handleScroll = () => {
  resetInactivityTimer()
}

const handleTouch = () => {
  resetInactivityTimer()
}

onMounted(() => {
  loadArticle(articleId.value)
  
  // Setup observer to show floating buttons when article header is not visible
  scrollObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      if (!entry) return
      showFloatingButtons.value = !entry.isIntersecting
    },
    {
      root: null,
      threshold: 0.1,
      rootMargin: '0px'
    }
  )
  
  // We'll observe the article header once it's rendered
  setTimeout(() => {
    if (articleHeaderRef.value) {
      scrollObserver?.observe(articleHeaderRef.value)
    }
  }, 100)
  
  // Setup inactivity detection for mobile buttons
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('touchstart', handleTouch, { passive: true })
  resetInactivityTimer()
})

watch(() => articleHeaderRef.value, (newRef) => {
  if (newRef && scrollObserver) {
    scrollObserver.observe(newRef)
  }
})

onUnmounted(() => {
  scrollObserver?.disconnect()
  scrollObserver = null
  
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('touchstart', handleTouch)
  
  if (inactivityTimer) {
    clearTimeout(inactivityTimer)
  }
})

watch(
  () => articleId.value,
  id => {
    loadArticle(id)
  }
)

</script>

<template>
  <!-- Backdrop for mobile TOC -->
  <div
    v-if="showMobileToc"
    class="toc-backdrop mobile-only"
    @click="showMobileToc = false"
  ></div>

  <!-- Backdrop for mobile scroll buttons -->
  <div
    v-if="showMobileScrollButtons"
    class="toc-backdrop mobile-only"
    @click="showMobileScrollButtons = false"
  ></div>

  <!-- Mobile TOC Toggle Button (appears on narrow screens) -->
  <button
    class="mobile-toc-toggle mobile-only"
    :class="{ 'is-visible': showMobileButtons || showMobileToc }"
    @click="showMobileToc = !showMobileToc; resetInactivityTimer()"
    :title="showMobileToc ? t('toc.close') : t('toc.open')"
    :aria-label="showMobileToc ? t('toc.close') : t('toc.open')"
  >
    <X v-if="showMobileToc" :size="16" />
    <List v-else :size="16" />
  </button>

  <!-- Mobile Scroll Buttons Toggle (appears on narrow screens) -->
  <button
    class="mobile-scroll-toggle mobile-only"
    :class="{ 'is-visible': showMobileButtons || showMobileScrollButtons }"
    @click="showMobileScrollButtons = !showMobileScrollButtons; resetInactivityTimer()"
    :title="showMobileScrollButtons ? t('common.close') : t('common.scrollButtons')"
    :aria-label="showMobileScrollButtons ? t('common.close') : t('common.scrollButtons')"
  >
    <X v-if="showMobileScrollButtons" :size="16" />
    <ChevronUp v-else :size="16" />
  </button>

  <!-- Mobile Scroll Buttons Panel -->
  <div v-if="showMobileScrollButtons" class="mobile-scroll-panel mobile-only">
    <button
      class="mobile-scroll-btn"
      @click="scrollToTop"
      :title="t('common.goToTop')"
    >
      <ChevronUp :size="18" />
      <span>{{ t('common.goToTop') }}</span>
    </button>
    <button
      class="mobile-scroll-btn"
      @click="scrollToBottom"
      :title="t('common.goToBottom')"
    >
      <ChevronDown :size="18" />
      <span>{{ t('common.goToBottom') }}</span>
    </button>
  </div>

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

  <div v-if="article && !articleLoading" class="container article-view">
    <button v-if="article.parentId" @click="goToParent" class="back-btn mb-4">
      <ArrowLeft :size="16" /> Back to Parent
    </button>

    <article class="main-article">
      <h1 class="article-title" ref="articleHeaderRef">{{ article.title }}</h1>
      <div class="article-meta flex-row gap-4">
        <span class="flex-row gap-2" :class="{ 'custom-author': article.authorName }">
          <User :size="14" /> 
          {{ article.authorName || article.author.name || 'Unknown' }}
        </span>
        <span class="flex-row gap-2"><Calendar :size="14" /> {{ formatDate(article.createdAt) }}</span>
      </div>

      <div v-if="canExport || isAuthor || canDelete" class="author-actions flex-row flex-wrap gap-2">
        <button
          v-if="canExport"
          class="secondary-btn flex-row gap-2"
          :disabled="isExporting"
          @click="exportArticle"
        >
          <Download :size="16" />
          <span>{{ isExporting ? 'Preparing…' : t('article.export') }}</span>
        </button>
        <template v-if="isAuthor">
          <button
            v-if="canDuplicate"
            class="secondary-btn flex-row gap-2"
            :disabled="isDuplicating"
            @click="duplicateToDraft"
          >
            <Copy :size="16" />
            <span>{{ isDuplicating ? 'Creating copy…' : t('article.duplicate') }}</span>
          </button>
          <button
            v-if="canUnpublish"
            class="secondary-btn flex-row gap-2"
            :disabled="isUnpublishing"
            @click="unpublishArticle"
          >
            <Undo :size="16" />
            <span>{{ isUnpublishing ? 'Unpublishing…' : t('article.unpublish') }}</span>
          </button>
        </template>

        <button
          v-if="canDelete"
          class="danger-btn flex-row gap-2"
          :disabled="isDeleting"
          @click="deleteArticle"
        >
          <Trash2 :size="16" />
          <span>{{ isDeleting ? 'Deleting…' : t('article.adminDelete') }}</span>
        </button>
      </div>

      <div class="reader-toolbar-toggle">
        <button class="flex-row gap-2" type="button" @click="showReaderToolbar = !showReaderToolbar">
          <Palette :size="16" />
          <span>{{ showReaderToolbar ? t('common.close') : t('article.readingPreferences') }}</span>
        </button>
      </div>

      <transition name="fade">
        <div v-if="showReaderToolbar" class="reader-toolbar">
          <div class="toolbar-section">
            <div class="toolbar-label">{{ t('article.background') }}</div>
            <div class="preset-grid">
              <button
                v-for="preset in backgroundPresets"
                :key="preset.id"
                class="preset-card"
                :class="{ active: preset.id === selectedBackgroundId }"
                type="button"
                :aria-pressed="preset.id === selectedBackgroundId"
                @click="selectedBackgroundId = preset.id"
              >
                <span class="preset-swatch" :style="presetSwatchStyle(preset)" />
                <div class="preset-copy">
                  <span class="preset-title">{{ preset.label }}</span>
                  <span class="preset-desc">{{ preset.description }}</span>
                </div>
              </button>
            </div>
          </div>

          <div class="toolbar-section">
            <div class="toolbar-label">{{ t('article.font') }}</div>
            <div class="pill-group">
              <button
                v-for="font in fontPresets"
                :key="font.id"
                type="button"
                class="pill"
                :class="{ active: font.id === selectedFontId }"
                @click="selectedFontId = font.id"
                :style="{ fontFamily: font.fontFamily }"
              >
                {{ font.label }}
              </button>
            </div>
          </div>

          <div class="toolbar-section options-grid">
            <div>
              <div class="toolbar-label">{{ t('article.fontSize') }}</div>
              <div class="pill-group">
                <button
                  v-for="size in fontSizes"
                  :key="size"
                  type="button"
                  class="pill"
                  :class="{ active: size === selectedFontSize }"
                  @click="selectedFontSize = size"
                >
                  {{ size.replace('px', '') }}
                </button>
              </div>
            </div>

            <div>
              <div class="toolbar-label">{{ t('article.lineHeight') }}</div>
              <div class="pill-group">
                <button
                  v-for="lh in lineHeights"
                  :key="lh"
                  type="button"
                  class="pill"
                  :class="{ active: lh === selectedLineHeight }"
                  @click="selectedLineHeight = lh"
                >
                  {{ lh.toFixed(1) }}
                </button>
              </div>
            </div>

            <div>
              <div class="toolbar-label">{{ t('article.width') }}</div>
              <div class="pill-group">
                <button
                  v-for="doc in docWidthPresets"
                  :key="doc.id"
                  type="button"
                  class="pill"
                  :class="{ active: doc.id === selectedDocWidthId }"
                  @click="selectedDocWidthId = doc.id"
                >
                  {{ doc.label }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
      
      <div class="article-content-wrapper reader-surface" :style="readerSurfaceStyle">
        <!-- Re-using RichEditor in read-only mode for perfect rendering of custom nodes -->
        <RichEditor ref="editorRef" :model-value="article.content" :editable="false" />
        <TocSidebar :editor="editorRef?.editor" :is-open="showMobileToc" @close="showMobileToc = false" />
      </div>
    </article>

    <div class="actions-bar flex-row justify-between">
      <h3>Replies ({{ replies.length }})</h3>
      <div class="flex-row gap-2">
        <button class="primary flex-row gap-2" @click="replyToArticle">
          <MessageSquare :size="16" /> Reply
        </button>
      </div>
    </div>

    <div v-if="!repliesLoading" class="replies-list" :key="articleId">
      <div v-for="reply in replies" :key="reply?.id || ''" class="reply-card" @click="reply && router.push(`/article/${reply.id}`)">
        <template v-if="reply">
          <h4>{{ reply.title }}</h4>
          <div class="reply-preview">{{ reply.content.replace(/<[^>]*>?/gm, '').substring(0, 100) }}...</div>
          <div class="reply-meta">
            {{ reply.author.name || 'Unknown' }} • {{ formatDate(reply.createdAt) }}
          </div>
        </template>
      </div>
    </div>
    <p v-else class="loading">Loading replies…</p>
  </div>
  <div v-else class="container">
    <p v-if="articleLoading">Loading article…</p>
    <p v-else>Article not found.</p>
    <button @click="router.push('/')">Go Home</button>
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
.article-title {
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
  letter-spacing: -0.03em;
  /* font-family: var(--font-serif); */
}

.article-meta {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 1rem;
}

.author-actions {
  margin: 1rem 0 1.5rem;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.actions-bar {
  margin-top: 3rem;
  margin-bottom: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.reply-card {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color 0.2s;
}

.loading {
  color: var(--text-secondary);
}

.reply-card:hover {
  border-color: var(--accent-color);
}

.reply-card h4 {
  margin-bottom: 0.5rem;
}

.reply-preview {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.reply-meta {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.secondary-btn {
  padding: 0.65rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--accent-color);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.secondary-btn:hover {
  background: var(--bg-color);
  border-color: var(--accent-color);
}

.secondary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.danger-btn {
  padding: 0.65rem 1rem;
  border: 1px solid #fca5a5;
  border-radius: var(--radius-sm);
  background: #fff5f5;
  color: #b91c1c;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.danger-btn:hover {
  background: #fee2e2;
  border-color: #f87171;
}

.danger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  padding: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  margin-bottom: 1rem;
}

.back-btn:hover {
  color: var(--text-color);
}

.reader-toolbar-toggle {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}

.reader-toolbar {
  border: 1px solid var(--border-color);
  background: var(--surface-color);
  border-radius: var(--radius-md);
  padding: 1rem;
  box-shadow: var(--shadow-sm);
  margin-bottom: 1rem;
}

.toolbar-section + .toolbar-section {
  margin-top: 0.75rem;
}

.toolbar-label {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.preset-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.preset-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.75rem;
  background: var(--bg-color);
  text-align: left;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;
}

.preset-card.active {
  border-color: var(--accent-color);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.preset-swatch {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
}

.preset-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
}

.preset-title {
  font-weight: 600;
}

.preset-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.pill-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.pill {
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  font-size: 0.9rem;
  transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease, transform 0.1s ease;
}

.pill.active {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 10%, transparent);
  transform: translateY(-1px);
}

.options-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.reader-surface {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 2rem;
  box-shadow: var(--shadow-sm);
  transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

/* Make the nested editor background transparent so the preset shows through */
.reader-surface :deep(.page-card) {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

.reader-surface :deep(.ProseMirror) {
  background: transparent;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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
  bottom: 166px;
}

.floating-scroll-bottom {
  bottom: 120px;
}

.floating-scroll-top:hover,
.floating-scroll-bottom:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

@media (max-width: 1550px) {
  .floating-scroll-top,
  .floating-scroll-bottom {
    display: none;
  }
}

.mobile-toc-toggle,
.mobile-scroll-toggle {
  display: none;
  position: fixed;
  z-index: 998;
  width: 32px;
  height: 56px;
  align-items: center;
  justify-content: center;
  background: linear-gradient(to left, var(--surface-color), rgba(var(--surface-color-rgb, 255, 255, 255), 0.95));
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-right: none;
  border-radius: 8px 0 0 8px;
  cursor: pointer;
  box-shadow: -2px 0 6px rgba(0, 0, 0, 0.04);
  opacity: 0.35;
  transition: opacity 0.3s ease, width 0.2s ease, box-shadow 0.2s ease;
  backdrop-filter: blur(4px);
}

.mobile-only {
  display: none;
}

@media (max-width: 1550px) {
  .mobile-only {
    display: flex;
  }

  .mobile-scroll-panel.mobile-only {
    display: flex;
    flex-direction: column;
  }

  .toc-backdrop.mobile-only {
    display: block;
  }
}

.mobile-toc-toggle.is-visible,
.mobile-scroll-toggle.is-visible {
  opacity: 0.8;
  width: 40px;
  box-shadow: -3px 0 10px rgba(0, 0, 0, 0.08);
}

.mobile-toc-toggle:active,
.mobile-scroll-toggle:active {
  opacity: 1;
  background: var(--surface-color);
  color: var(--accent-color);
}

.mobile-toc-toggle {
  top: 140px;
  right: 0;
}

.mobile-scroll-toggle {
  bottom: 24px;
  right: 0;
}

/* Touch devices: prevent hover effects */
@media (hover: none) {
  .mobile-toc-toggle:hover,
  .mobile-scroll-toggle:hover {
    opacity: 0.35;
    width: 32px;
  }
  
  .mobile-toc-toggle.is-visible:hover,
  .mobile-scroll-toggle.is-visible:hover {
    opacity: 0.8;
    width: 40px;
  }
}

.mobile-scroll-panel {
  position: fixed;
  bottom: 80px;
  right: 1rem;
  z-index: 999;
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

.mobile-scroll-btn {
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

.mobile-scroll-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.toc-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 997;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (max-width: 640px) {
  .reader-surface {
    padding: 1.25rem;
  }
}
</style>
