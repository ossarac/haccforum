<script setup lang="ts">
import type { Topic } from '../stores/topicStore'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'

interface Props {
  topic: Topic
  expanded: boolean
  level?: number
}

interface Emits {
  toggle: [id: string]
  navigate: [topicId: string]
}

const props = withDefaults(defineProps<Props>(), {
  level: 0
})
const emit = defineEmits<Emits>()

const children = props.topic.children || []

const handleToggle = (e: Event) => {
  e.preventDefault()
  e.stopPropagation()
  emit('toggle', props.topic.id)
}

const handleNavigate = () => {
  emit('navigate', props.topic.id)
}
</script>

<template>
  <div>
    <div 
      class="topic-list-item"
      :style="{ paddingLeft: (level * 16 + 12) + 'px' }"
    >
      <button
        v-if="children.length > 0"
        class="toggle-btn"
        @click="handleToggle"
      >
        <ChevronDown v-if="expanded" :size="16" />
        <ChevronRight v-else :size="16" />
      </button>
      <div v-else class="toggle-spacer" />

      <button 
        class="topic-btn"
        @click="handleNavigate"
      >
        {{ topic.name }}
      </button>
    </div>

    <template v-if="expanded && children.length > 0">
      <TopicListNode
        v-for="child in children"
        :key="child.id"
        :topic="child"
        :expanded="false"
        :level="level + 1"
        @toggle="emit('toggle', $event)"
        @navigate="emit('navigate', $event)"
      />
    </template>
  </div>
</template>

<script lang="ts">
</script>

<style scoped>
.topic-list-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-right: 0.75rem;
}

.toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  color: var(--text-secondary);
  transition: color 0.2s;
  width: 24px;
  flex-shrink: 0;
}

.toggle-btn:hover {
  color: var(--accent-color);
}

.toggle-spacer {
  width: 24px;
  flex-shrink: 0;
}

.topic-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  text-align: left;
  flex: 1;
  transition: color 0.2s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topic-btn:hover {
  color: var(--accent-color);
}
</style>
