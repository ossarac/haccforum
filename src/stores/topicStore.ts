import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { apiRequest } from '../api/client'

export interface TopicAuthor {
  id: string
  name: string
}

export interface Topic {
  id: string
  name: string
  description?: string
  parentId: string | null
  ancestors: string[]
  createdBy: TopicAuthor
  createdAt: string
  updatedAt: string
  children?: Topic[]
  articleCount?: number
}

export const useTopicStore = defineStore('topic', () => {
  const topics = ref<Topic[]>([])
  const topicsById = reactive<Record<string, Topic>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)

  const rootTopics = computed(() => topics.value.filter(t => !t.parentId))

  // Flat list of all topics with indentation for display
  const flatTopicList = computed(() => {
    const result: (Topic & { indent: number; displayName: string })[] = []
    
    const addTopicAndChildren = (topic: Topic, indent: number) => {
      const prefix = indent > 0 ? '  '.repeat(indent) + '\u2514\u2500 ' : ''
      result.push({ ...topic, indent, displayName: prefix + topic.name })
      
      // Find and add children
      const children = topics.value.filter(t => t.parentId === topic.id)
      children.sort((a, b) => a.name.localeCompare(b.name))
      children.forEach(child => addTopicAndChildren(child, indent + 1))
    }
    
    // Start with root topics
    const roots = topics.value.filter(t => !t.parentId)
    roots.sort((a, b) => a.name.localeCompare(b.name))
    roots.forEach(root => addTopicAndChildren(root, 0))
    
    return result
  })

  const getTopicPath = (topicId: string | null): Topic[] => {
    if (!topicId) return []
    const topic = topicsById[topicId]
    if (!topic) return []

    const path: Topic[] = [topic]
    let current = topic
    while (current.parentId) {
      const parent = topicsById[current.parentId]
      if (!parent) break
      path.unshift(parent)
      current = parent
    }
    return path
  }

  const getTopic = (id: string): Topic | undefined => {
    return topicsById[id]
  }

  const fetchTopics = async (): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const data = await apiRequest<Topic[]>('/topics', {
        method: 'GET'
      })
      topics.value = data
      
      // Build topicsById map
      data.forEach((topic: Topic) => {
        topicsById[topic.id] = topic
      })
      
      // Build parent-child relationships
      data.forEach((topic: Topic) => {
        if (topic.parentId) {
          const parent = topicsById[topic.parentId]
          if (parent) {
            if (!parent.children) parent.children = []
            // Avoid duplicates
            if (!parent.children.find(c => c.id === topic.id)) {
              parent.children.push(topic)
            }
          }
        }
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch topics'
      console.error('[topicStore] fetchTopics error:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchTopic = async (id: string): Promise<Topic | null> => {
    try {
      const data = await apiRequest<Topic>(`/topics/${id}`, {
        method: 'GET'
      })
      topicsById[id] = data
      // Update or add to topics list
      const index = topics.value.findIndex(t => t.id === id)
      if (index >= 0) {
        topics.value[index] = data
      } else {
        topics.value.push(data)
      }
      return data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch topic'
      console.error('[topicStore] fetchTopic error:', err)
      return null
    }
  }

  const createTopic = async (
    name: string,
    description?: string,
    parentId?: string | null
  ): Promise<Topic | null> => {
    loading.value = true
    error.value = null
    try {
      const data = await apiRequest<Topic>('/topics', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          parentId: parentId || null
        })
      })
      topicsById[data.id] = data
      // Always add to the topics list
      topics.value.push(data)
      // Also update parent's children if it's a subtopic
      if (parentId) {
        const parent = topicsById[parentId]
        if (parent) {
          if (!parent.children) parent.children = []
          parent.children.push(data)
        }
      }
      return data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create topic'
      console.error('[topicStore] createTopic error:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  const updateTopic = async (
    id: string,
    name?: string,
    description?: string
  ): Promise<Topic | null> => {
    loading.value = true
    error.value = null
    try {
      const data = await apiRequest<Topic>(`/topics/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          description
        })
      })
      topicsById[id] = data
      // Update in topics list
      const index = topics.value.findIndex(t => t.id === id)
      if (index >= 0) {
        topics.value[index] = data
      }
      return data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update topic'
      console.error('[topicStore] updateTopic error:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  const deleteTopic = async (id: string): Promise<boolean> => {
    loading.value = true
    error.value = null
    try {
      await apiRequest(`/topics/${id}`, {
        method: 'DELETE'
      })
      
      // Find the topic to get its parentId before deleting
      const topic = topicsById[id]
      
      // Remove from parent's children array if it has a parent
      if (topic?.parentId) {
        const parent = topicsById[topic.parentId]
        if (parent?.children) {
          parent.children = parent.children.filter(c => c.id !== id)
        }
      }
      
      // Remove from store
      delete topicsById[id]
      topics.value = topics.value.filter(t => t.id !== id)
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete topic'
      console.error('[topicStore] deleteTopic error:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    topics,
    topicsById,
    loading,
    error,
    rootTopics,
    flatTopicList,
    getTopicPath,
    getTopic,
    fetchTopics,
    fetchTopic,
    createTopic,
    updateTopic,
    deleteTopic
  }
})
