<script setup lang="ts">
import { computed } from 'vue'
import type { Topic } from '../stores/topicStore'
import { ChevronDown, ChevronRight, Edit2, Trash2, Plus } from 'lucide-vue-next'

interface Props {
  topic: Topic
  expandedTopics: Set<string>
  currentUserId?: string
  isAdmin?: boolean
}

interface Emits {
  expand: [id: string]
  edit: [topic: Topic]
  delete: [topic: Topic]
  'create-child': [topic: Topic]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const children = computed(() => props.topic.children || [])
const isExpanded = computed(() => props.expandedTopics.has(props.topic.id))
const canEdit = computed(() => props.isAdmin || props.topic.createdBy.id === props.currentUserId)
const canDelete = computed(() => props.isAdmin || props.topic.createdBy.id === props.currentUserId)

const toggleExpand = () => {
  emit('expand', props.topic.id)
}

const handleEdit = () => {
  emit('edit', props.topic)
}

const handleDelete = () => {
  emit('delete', props.topic)
}

const handleCreateChild = () => {
  emit('create-child', props.topic)
}
</script>

<template>
  <div class="topic-node">
    <div class="topic-row">
      <button
        v-if="children.length > 0"
        class="expand-btn"
        @click="toggleExpand"
        :title="isExpanded ? 'Collapse' : 'Expand'"
      >
        <ChevronDown v-if="isExpanded" :size="18" />
        <ChevronRight v-else :size="18" />
      </button>
      <div v-else class="expand-placeholder" />

      <div class="topic-info">
        <h3 class="topic-name">{{ topic.name }}</h3>
        <p v-if="topic.description" class="topic-description">{{ topic.description }}</p>
        <div class="topic-meta">
          <span class="article-count">{{ topic.articleCount || 0 }} articles</span>
          <span class="created-by">by {{ topic.createdBy.name }}</span>
        </div>
      </div>

      <div class="topic-actions">
        <button
          class="action-btn"
          @click="handleCreateChild"
          title="Create subtopic"
          aria-label="Create subtopic"
        >
          <Plus :size="16" />
        </button>
        <button
          v-if="canEdit"
          class="action-btn"
          @click="handleEdit"
          title="Edit topic"
          aria-label="Edit topic"
        >
          <Edit2 :size="16" />
        </button>
        <button
          v-if="canDelete"
          class="action-btn delete-btn"
          @click="handleDelete"
          title="Delete topic"
          aria-label="Delete topic"
        >
          <Trash2 :size="16" />
        </button>
      </div>
    </div>

    <div v-if="isExpanded && children.length > 0" class="children">
      <TopicNode
        v-for="child in children"
        :key="child.id"
        :topic="child"
        :expanded-topics="expandedTopics"
        :current-user-id="currentUserId"
        :is-admin="isAdmin"
        @expand="emit('expand', $event)"
        @edit="emit('edit', $event)"
        @delete="emit('delete', $event)"
        @create-child="emit('create-child', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.topic-node {
  border-bottom: 1px solid var(--border-color);
}

.topic-node:last-child {
  border-bottom: none;
}

.topic-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  transition: background 0.2s;
}

.topic-row:hover {
  background: rgba(59, 130, 246, 0.05);
}

.expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
}

.expand-btn:hover {
  color: var(--accent-color);
}

.expand-placeholder {
  width: 24px;
  flex-shrink: 0;
}

.topic-info {
  flex: 1;
  min-width: 0;
}

.topic-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
}

.topic-description {
  margin: 0.25rem 0 0 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.topic-meta {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.article-count {
  display: inline-block;
}

.created-by {
  display: inline-block;
}

.topic-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.action-btn {
  background: none;
  border: 1px solid var(--border-color);
  cursor: pointer;
  padding: 0.4rem;
  border-radius: 4px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  transition: all 0.2s;
}

.action-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: rgba(59, 130, 246, 0.05);
}

.delete-btn:hover {
  border-color: #dc2626;
  color: #dc2626;
  background: rgba(220, 38, 38, 0.05);
}

.children {
  margin-left: 1rem;
  border-left: 2px solid var(--border-color);
}
</style>
