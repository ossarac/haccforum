<template>
  <div class="tree-item">
    <div class="tree-item-content">
      <button
        v-if="hasChildren"
        class="expand-btn"
        @click="$emit('toggle-expanded')"
        :title="expanded ? 'Collapse' : 'Expand'"
      >
        <ChevronRight v-if="!expanded" :size="18" />
        <ChevronDown v-else :size="18" />
      </button>
      <div v-else class="expand-placeholder"></div>

      <div class="article-content">
        <div class="article-title-section">
          <h3 class="article-title" :class="{ 'is-reply': article.parentId }">
            {{ article.title || 'Untitled Article' }}
          </h3>
          <div class="article-meta">
            <p class="author">{{ article.authorName || article.author.name }}</p>
            <p class="deleted-date">
              Deleted {{ formatDateTime(article.deletedAt || '') }}
            </p>
          </div>
        </div>

        <div class="article-preview">
          <p>{{ article.content.substring(0, 120).replace(/<[^>]*>/g, '') }}...</p>
        </div>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="article-actions">
      <button
        class="secondary-btn undelete-btn"
        @click="handleUndelete"
        :disabled="restoringId === article.id"
        :title="
          hasDeletedChildren ? 'Restores this article and its ancestors' : 'Restores this article'
        "
      >
        <RotateCcw :size="16" />
        <span class="desktop-only">{{ restoringId === article.id ? 'Restoring...' : 'Restore' }}</span>
      </button>

      <div v-if="hasDeletedChildren" class="restore-children-prompt">
        <span class="info-text">Has {{ article.children.length }} deleted replies</span>
        <button
          class="secondary-btn restore-children-btn"
          @click="() => $emit('undelete', article.id, true)"
          :disabled="restoringId === article.id"
        >
          Restore All
        </button>
      </div>

      <div v-if="confirmDeleteId === article.id" class="delete-confirm">
        <span class="warning-text">Permanently delete?</span>
        <button
          class="danger-btn"
          @click="() => $emit('confirm-delete', article.id)"
          :disabled="restoringId === article.id"
        >
          Yes, Delete
        </button>
        <button class="secondary-btn" @click="() => $emit('cancel-delete')">
          Cancel
        </button>
      </div>
      <button
        v-else
        class="danger-btn"
        @click="() => $emit('permanently-delete', article.id)"
        :disabled="restoringId === article.id"
        title="Permanently delete from database"
      >
        <Trash2 :size="16" />
        <span class="desktop-only">Delete</span>
      </button>
    </div>

    <!-- Children -->
    <div v-if="expanded && hasChildren" class="children-list">
      <ArticleTreeItem
        v-for="child in article.children"
        :key="child.id"
        :article="child"
        :expanded="expandedId.has(child.id)"
        :restoring-id="restoringId"
        :confirm-delete-id="confirmDeleteId"
        :is-child="true"
        @toggle-expanded="() => handleChildToggle(child.id)"
        @undelete="(id, restore) => $emit('undelete', id, restore)"
        @permanently-delete="(id) => $emit('permanently-delete', id)"
        @cancel-delete="() => $emit('cancel-delete')"
        @confirm-delete="(id) => $emit('confirm-delete', id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Trash2, RotateCcw, ChevronDown, ChevronRight } from 'lucide-vue-next'

interface ArticleNode {
  id: string
  title: string
  content: string
  authorName?: string
  author: {
    name: string
    email: string
  }
  deleted: boolean
  deletedAt: string | null
  parentId?: string
  children: ArticleNode[]
}

interface Props {
  article: ArticleNode
  expanded: boolean
  restoringId: string | null
  confirmDeleteId: string | null
  isChild?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isChild: false
})

const emit = defineEmits<{
  'toggle-expanded': []
  'undelete': [id: string, restoreChildren?: boolean]
  'permanently-delete': [id: string]
  'cancel-delete': []
  'confirm-delete': [id: string]
}>()

const expandedId = ref<Set<string>>(new Set())

const hasChildren = computed(() => props.article.children && props.article.children.length > 0)
const hasDeletedChildren = computed(
  () => props.article.children && props.article.children.length > 0
)

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

const handleUndelete = () => {
  emit('undelete', props.article.id, false)
}

const handleChildToggle = (childId: string) => {
  if (expandedId.value.has(childId)) {
    expandedId.value.delete(childId)
  } else {
    expandedId.value.add(childId)
  }
}
</script>

<style scoped>
.tree-item {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1rem;
  background-color: var(--bg-secondary);
}

.tree-item:hover {
  border-color: var(--border-hover);
  background-color: var(--bg-tertiary);
}

.tree-item-content {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.expand-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.expand-btn:hover {
  background-color: rgba(125, 125, 125, 0.1);
  color: var(--text-color);
}

.expand-placeholder {
  width: 32px;
  flex-shrink: 0;
}

.article-content {
  flex: 1;
  min-width: 0;
}

.article-title-section {
  margin-bottom: 0.5rem;
}

.article-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  margin-bottom: 0.25rem;
  color: var(--text-color);
  word-break: break-word;
}

.article-title.is-reply {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.article-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
}

.author,
.deleted-date {
  color: var(--text-secondary);
  margin: 0;
}

.article-preview {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.4;
  max-height: 2.7em;
  overflow: hidden;
  text-overflow: ellipsis;
}

.article-preview p {
  margin: 0;
}

.article-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
}

.secondary-btn,
.danger-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.secondary-btn {
  background-color: var(--bg-tertiary);
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.secondary-btn:hover:not(:disabled) {
  background-color: var(--border-color);
}

.secondary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.undelete-btn {
  color: #16a34a;
}

.undelete-btn:hover:not(:disabled) {
  background-color: rgba(22, 163, 74, 0.1);
  border-color: #16a34a;
}

.restore-children-prompt {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.info-text {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.restore-children-btn {
  color: #2563eb;
  border-color: #2563eb;
}

.restore-children-btn:hover:not(:disabled) {
  background-color: rgba(37, 99, 235, 0.1);
}

.danger-btn {
  background-color: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.danger-btn:hover:not(:disabled) {
  background-color: rgba(239, 68, 68, 0.2);
  border-color: #dc2626;
}

.danger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.delete-confirm {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.warning-text {
  font-size: 0.85rem;
  color: #dc2626;
  font-weight: 500;
}

.children-list {
  margin-left: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-left: 2px solid var(--border-color);
  padding-left: 1rem;
}

@media (max-width: 768px) {
  .tree-item {
    padding: 0.75rem;
  }

  .article-actions {
    gap: 0.4rem;
  }

  .secondary-btn,
  .danger-btn {
    padding: 0.4rem 0.6rem;
    font-size: 0.8rem;
  }

  .desktop-only {
    display: none;
  }

  .restore-children-prompt {
    font-size: 0.75rem;
  }

  .children-list {
    margin-left: 1.5rem;
    padding-left: 0.75rem;
  }
}
</style>
