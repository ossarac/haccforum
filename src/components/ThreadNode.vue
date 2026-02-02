<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Minus, ChevronDown } from 'lucide-vue-next'
import { useArticleStore, type Article } from '../stores/articleStore'

const { t } = useI18n()
const store = useArticleStore()

interface Props {
  article: Article
  depth?: number
  maxDepth?: number
  maxSiblings?: number
  showConnectors?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  depth: 0,
  maxDepth: 5,
  maxSiblings: 3,
  showConnectors: true
})

const emit = defineEmits<{
  navigate: [articleId: string]
}>()

// State
const isCollapsed = ref(false)
const showAllSiblings = ref(false)

// Get child replies for this article
const allReplies = computed(() => 
  store.getChildren(props.article.id).filter((child): child is Article => !!child && child.published && !child.deleted)
)

// Truncate siblings if needed
const visibleReplies = computed(() => {
  if (showAllSiblings.value || allReplies.value.length <= props.maxSiblings) {
    return allReplies.value
  }
  return allReplies.value.slice(0, props.maxSiblings)
})

const hiddenReplyCount = computed(() => 
  Math.max(0, allReplies.value.length - props.maxSiblings)
)

const hasMoreReplies = computed(() => 
  !showAllSiblings.value && hiddenReplyCount.value > 0
)

// Check if we've hit max depth
const isMaxDepth = computed(() => props.depth >= props.maxDepth)

// Total reply count (recursive)
const totalReplyCount = computed(() => allReplies.value.length)
const hasChildren = computed(() => totalReplyCount.value > 0)

// Format time ago
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

// Strip HTML tags for preview
const getTextPreview = (html: string, maxLength: number = 120) => {
  const text = html.replace(/<[^>]*>/g, '').trim()
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

const toggleCollapse = (e: Event) => {
  e.stopPropagation()
  isCollapsed.value = !isCollapsed.value
}

const toggleShowAll = (e: Event) => {
  e.stopPropagation()
  showAllSiblings.value = true
}

const handleClick = () => {
  emit('navigate', props.article.id)
}

const handleChildNavigate = (articleId: string) => {
  emit('navigate', articleId)
}
</script>

<template>
  <div 
    class="thread-node" 
    :class="[
      `thread-depth-${depth}`,
      { 'is-root': depth === 0, 'is-collapsed': isCollapsed, 'has-children': hasChildren && !isMaxDepth }
    ]"
  >
    <!-- Article content -->
    <div 
      class="thread-item" 
      :class="{ 'root-item': depth === 0, 'reply-item': depth > 0 }"
      @click="handleClick"
    >
      <!-- Thread control area (unified for all levels) -->
      <div class="thread-control">
        <!-- Horizontal line (only for child articles) -->
        <div v-if="depth > 0" class="line-h"></div>
        
        <!-- Collapse/expand button or leaf indicator -->
        <button
          v-if="hasChildren && !isMaxDepth"
          class="collapse-btn"
          @click.stop="toggleCollapse"
          :aria-label="isCollapsed ? 'Expand' : 'Collapse'"
        >
          <Plus v-if="isCollapsed" :size="10" :stroke-width="3" />
          <Minus v-else :size="10" :stroke-width="3" />
        </button>
        <!-- Dot indicator for leaf nodes (child articles only) -->
        <div v-else-if="depth > 0" class="leaf-indicator"></div>
      </div>

      <div class="item-content">
        <div class="item-header">
          <div class="item-title-row">
            <h3 class="item-title">{{ article.title }}</h3>
            <div class="item-meta">
              <span class="meta-author">{{ article.authorName || article.author.name }}</span>
              <span class="meta-dot">·</span>
              <span class="meta-time">{{ formatTimeAgo(article.publishedAt || article.createdAt) }}</span>
              <template v-if="hasChildren && isCollapsed">
                <span class="meta-dot">·</span>
                <span class="meta-replies">{{ totalReplyCount }} {{ totalReplyCount === 1 ? 'reply' : 'replies' }}</span>
              </template>
            </div>
          </div>
        </div>
        
        <!-- Content preview (only for root or if expanded) -->
        <p v-if="depth === 0 || !isCollapsed" class="item-preview">
          {{ getTextPreview(article.content, depth === 0 ? 150 : 100) }}
        </p>
      </div>
    </div>
    
    <!-- Child replies container -->
    <div 
      v-if="!isCollapsed && hasChildren && !isMaxDepth" 
      class="thread-children"
    >
      <ThreadNode
        v-for="reply in visibleReplies"
        :key="reply.id"
        :article="reply"
        :depth="depth + 1"
        :max-depth="maxDepth"
        :max-siblings="maxSiblings"
        :show-connectors="showConnectors"
        @navigate="handleChildNavigate"
      />
      
      <!-- Show more siblings button -->
      <button
        v-if="hasMoreReplies"
        class="show-more-btn"
        @click.stop="toggleShowAll"
      >
        <div class="show-more-content">
          <ChevronDown :size="14" />
          <span>Show {{ hiddenReplyCount }} more {{ hiddenReplyCount === 1 ? 'reply' : 'replies' }}</span>
        </div>
      </button>
    </div>
    
    <!-- Continue thread button (max depth reached) -->
    <div v-if="!isCollapsed && hasChildren && isMaxDepth" class="thread-continue">
      <div class="thread-control">
        <div class="line-h"></div>
      </div>
      <button class="continue-btn" @click="handleClick">
        <span>Continue this thread ({{ totalReplyCount }} {{ totalReplyCount === 1 ? 'reply' : 'replies' }}) →</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.thread-node {
  position: relative;
  display: flex;
  flex-direction: column;
  --indent-x: 32px;
  --btn-size: 18px;
  --btn-center: 9px;
  --content-padding: 8px;
  --line-height: calc(0.25rem + 0.6em);
}

/* Root container gets the card look */
.thread-node.is-root {
  background: var(--card-bg, var(--surface-color));
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s ease;
}

.thread-node.is-root:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

/* Generic item structure */
.thread-item {
  display: flex;
  cursor: pointer;
  position: relative;
  transition: background-color 0.2s;
  border-radius: 6px;
}

.reply-item:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

/* Thread control area - unified for all articles */
.thread-control {
  position: relative;
  width: var(--btn-size);
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: calc(var(--line-height) - var(--btn-center));
}

/* Root articles get extra right margin for visual spacing */
.root-item .thread-control {
  margin-right: 0.5rem;
}

/* Horizontal line from parent's vertical spine to button */
.line-h {
  position: absolute;
  left: calc(-1 * (var(--indent-x) - var(--btn-center)));
  top: var(--line-height);
  width: var(--indent-x);
  height: 1px;
  background-color: var(--border-color);
  z-index: 0;
}

/* Vertical connector from button center down to children spine */
.thread-node.has-children > .thread-item::after {
  content: '';
  position: absolute;
  left: var(--btn-center);
  top: var(--line-height);
  height: calc(100% - var(--line-height));
  width: 1px;
  background-color: var(--border-color);
  z-index: 0;
}

/* Item content */
.item-content {
  flex: 1;
  min-width: 0;
  padding: 0.25rem 0;
  padding-left: var(--content-padding);
}

.item-header {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

/* Specific styling for root vs reply */
.root-item .item-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  color: var(--text-color);
}

.root-item .item-preview {
  font-size: 1rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.reply-item .item-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reply-item .item-meta {
  font-size: 0.8rem;
}

/* Meta styling */
.item-title-row {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

/* Add spacing for reply items to separate title from line */
.reply-item .item-title-row {
  flex-direction: row;
  align-items: baseline;
  gap: 0.5rem;
  margin-left: 8px;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.meta-author {
  font-weight: 500;
  color: var(--text-color);
}

.meta-dot {
  opacity: 0.5;
}

.meta-replies {
  color: var(--accent-color);
  font-weight: 500;
}

.item-preview {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0.25rem 0 0.5rem 0;
  line-height: 1.4;
  opacity: 0.9;
}

/* Align preview with title */
.reply-item .item-preview {
  margin-left: 8px;
  margin-right: 8px;
}

/* Collapse button - same for all levels */
.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--btn-size);
  height: var(--btn-size);
  border-radius: 50%;
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-secondary);
  padding: 0;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
  position: relative;
  z-index: 2;
}

.collapse-btn:hover {
  background: var(--card-bg);
  color: var(--text-color);
  border-color: var(--text-secondary);
}

.collapse-btn svg {
  display: block;
}

/* Leaf indicator - a simple dot */
.leaf-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--border-color);
  margin: calc(var(--btn-center) - 3px);
  position: relative;
  z-index: 2;
}

/* Children container - unified for all levels */
.thread-children {
  position: relative;
  margin-left: var(--indent-x);
}

/* Continuous vertical line connecting all sibling children */
.thread-children::before {
  content: '';
  position: absolute;
  left: calc(-1 * (var(--indent-x) - var(--btn-center)));
  top: 0;
  height: calc(100% - var(--line-height) - 0.25rem);
  width: 1px;
  background-color: var(--border-color);
  z-index: 0;
}

/* Stop spine at last sibling junction */
.thread-children > .thread-node:last-child {
  position: relative;
}

.thread-children > .thread-node:last-child::after {
  content: '';
  position: absolute;
  left: calc(-1 * (var(--indent-x) - var(--btn-center)));
  top: var(--line-height);
  bottom: 0;
  width: 2px;
  background-color: var(--bg-color);
  z-index: 1;
}

/* Connect parent's button to children vertical spine */

/* Show more button */
.show-more-btn {
  display: flex;
  align-items: center;
  width: 100%;  
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  position: relative;
}

.show-more-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  margin-left: calc(var(--indent-x));
  color: var(--accent-color);
  font-size: 0.85rem;
  font-weight: 500;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.show-more-btn:hover .show-more-content {
  background-color: rgba(99, 102, 241, 0.05);
}

/* Continue button */
.thread-continue {
  display: flex;
  margin-left: var(--indent-x);
}

.continue-btn {
  margin-left: 4px;
  padding: 0.4rem 0.75rem;
  background: transparent;
  border: 1px dashed var(--border-color);
  border-radius: 6px;
  color: var(--accent-color);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.continue-btn:hover {
  background: var(--bg-color);
  border-style: solid;
}

/* Mobile responsive */
@media (max-width: 640px) {
  .thread-node {
    --indent-x: 24px;
    --btn-size: 16px;
    --btn-center: 8px;
  }

  .reply-item .item-title-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    margin-left: 6px;
  }
  
  .reply-item .item-preview {
    margin-left: 6px;
    margin-right: 6px;
  }
}
</style>
