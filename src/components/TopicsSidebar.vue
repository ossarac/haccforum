<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useTopicStore } from '../stores/topicStore'
import { useRouter } from 'vue-router'

const topicStore = useTopicStore()
const router = useRouter()
const expandedTopics = ref<Set<string>>(new Set())

onMounted(async () => {
  if (topicStore.topics.length === 0) {
    await topicStore.fetchTopics()
  }
})

const toggleTopic = (id: string) => {
  if (expandedTopics.value.has(id)) {
    expandedTopics.value.delete(id)
  } else {
    expandedTopics.value.add(id)
  }
}

const navigateToTopic = (topicId: string) => {
  router.push({
    name: 'home',
    query: { topicId }
  })
}
</script>

<template>
  <div class="topics-sidebar">
    <div class="sidebar-header">
      <h3>Topics</h3>
      <router-link to="/admin/topics" class="admin-link" title="Manage topics">
        ⚙️
      </router-link>
    </div>

    <div class="topics-list">
      <div v-if="topicStore.rootTopics.length === 0" class="empty">
        No topics yet
      </div>

      <div v-for="topic in topicStore.rootTopics" :key="topic.id" class="topic-item">
        <TopicListNode
          :topic="topic"
          :expanded="expandedTopics.has(topic.id)"
          @toggle="toggleTopic"
          @navigate="navigateToTopic"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import TopicListNode from './TopicListNode.vue'
</script>

<style scoped>
.topics-sidebar {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-header h3 {
  margin: 0;
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.admin-link {
  color: var(--text-secondary);
  text-decoration: none;
  cursor: pointer;
  font-size: 1rem;
}

.admin-link:hover {
  color: var(--accent-color);
}

.topics-list {
  max-height: 400px;
  overflow-y: auto;
}

.empty {
  padding: 1rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.topic-item {
  border-bottom: 1px solid var(--border-color);
}

.topic-item:last-child {
  border-bottom: none;
}
</style>
