<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore'
import { useTopicStore, type Topic } from '../stores/topicStore'
import Dialog from '../components/Dialog.vue'
import { Plus } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const topicStore = useTopicStore()

const expandedTopics = ref<Set<string>>(new Set())
const selectedTopic = ref<Topic | null>(null)
const isCreating = ref(false)
const isEditing = ref(false)
const topicName = ref('')
const topicDescription = ref('')
const parentTopicId = ref<string | null>(null)
const showDialog = ref(false)
const dialogTitle = ref('')
const dialogMessage = ref('')
const dialogType = ref<'alert' | 'confirm'>('alert')
const pendingAction = ref<(() => Promise<void>) | null>(null)

onMounted(async () => {
  // Check auth
  if (!auth.isAuthenticated) {
    router.push('/login')
    return
  }

  if (!auth.user?.roles.includes('admin') && !auth.user?.roles.includes('editor')) {
    router.push('/')
    return
  }

  // Load topics
  if (topicStore.topics.length === 0) {
    await topicStore.fetchTopics()
  }
})

const toggleExpanded = (id: string) => {
  if (expandedTopics.value.has(id)) {
    expandedTopics.value.delete(id)
  } else {
    expandedTopics.value.add(id)
  }
}

const openCreateDialog = (parentTopic: Topic | null = null) => {
  isCreating.value = true
  isEditing.value = false
  topicName.value = ''
  topicDescription.value = ''
  parentTopicId.value = parentTopic?.id || null
  dialogTitle.value = parentTopic ? t('admin.createSubtopic') + ` "${parentTopic.name}"` : t('admin.createRootTopic')
  dialogMessage.value = ''
  dialogType.value = 'alert'
  showDialog.value = true
}

const openEditDialog = (topic: Topic) => {
  isCreating.value = false
  isEditing.value = true
  selectedTopic.value = topic
  topicName.value = topic.name
  topicDescription.value = topic.description || ''
  parentTopicId.value = null
  dialogTitle.value = t('admin.editTopic') + `: ${topic.name}`
  dialogMessage.value = ''
  dialogType.value = 'alert'
  showDialog.value = true
}

const openDeleteDialog = (topic: Topic) => {
  isCreating.value = false
  isEditing.value = false
  selectedTopic.value = topic
  dialogTitle.value = t('admin.deleteTopic') + `: ${topic.name}?`
  dialogMessage.value = t('admin.cannotBeUndone')
  dialogType.value = 'confirm'
  pendingAction.value = async () => {
    const success = await topicStore.deleteTopic(topic.id)
    if (!success && topicStore.error) {
      throw new Error(topicStore.error)
    }
  }
  showDialog.value = true
}

const saveTopic = async () => {
  if (!topicName.value.trim()) {
    alert(t('admin.topicRequired'))
    return
  }

  try {
    let result
    if (isCreating.value) {
      result = await topicStore.createTopic(topicName.value, topicDescription.value, parentTopicId.value)
    } else if (isEditing.value && selectedTopic.value) {
      result = await topicStore.updateTopic(selectedTopic.value.id, topicName.value, topicDescription.value)
    }
    
    if (!result && topicStore.error) {
      alert(topicStore.error)
      return
    }
    
    showDialog.value = false
    topicName.value = ''
    topicDescription.value = ''
    selectedTopic.value = null
  } catch (error) {
    alert(error instanceof Error ? error.message : t('admin.failedToSave'))
  }
}

const handleDialogConfirm = async () => {
  if (pendingAction.value) {
    try {
      await pendingAction.value()
      showDialog.value = false
      pendingAction.value = null
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to perform action')
    }
  }
}

const handleDialogClose = () => {
  showDialog.value = false
  if (dialogType.value !== 'confirm') {
    topicName.value = ''
    topicDescription.value = ''
    selectedTopic.value = null
  }
  pendingAction.value = null
}
</script>

<template>
  <div class="admin-topics-container">
    <div class="topics-header">
      <h1>{{ t('admin.manageTopics') }}</h1>
      <button class="primary-btn" @click="openCreateDialog(null)">
        <Plus :size="18" />
        {{ t('admin.createRootTopic') }}
      </button>
    </div>

    <div class="topics-tree">
      <div v-if="topicStore.topics.length === 0" class="empty-state">
        {{ t('admin.noTopics') }}. <a href="#" @click.prevent="openCreateDialog(null)">{{ t('admin.createFirstTopic') }}</a>
      </div>

      <div v-for="topic in topicStore.rootTopics" :key="topic.id" class="topic-item">
        <TopicNode 
          :topic="topic" 
          :expanded-topics="expandedTopics"
          :current-user-id="auth.user?.id"
          :is-admin="auth.user?.roles.includes('admin') ?? false"
          @expand="toggleExpanded" 
          @edit="openEditDialog" 
          @delete="openDeleteDialog" 
          @create-child="openCreateDialog" 
        />
      </div>
    </div>

    <!-- Dialog for creating/editing topics -->
    <Dialog
      :is-open="showDialog"
      :title="dialogTitle"
      :message="dialogMessage"
      :type="dialogType"
      @close="handleDialogClose"
      @confirm="handleDialogConfirm"
    >
      <template v-if="isCreating || isEditing" #content>
        <div class="topic-form">
          <input
            v-model="topicName"
            type="text"
            :placeholder="t('admin.topicName')"
            class="form-input"
            autofocus
          />
          <textarea
            v-model="topicDescription"
            :placeholder="t('admin.topicDescription')"
            class="form-textarea"
            rows="3"
          />
          <div class="dialog-actions">
            <button class="btn btn-primary" @click="saveTopic()">{{ t('common.save') }}</button>
            <button class="btn btn-secondary" @click="handleDialogClose">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script lang="ts">
import TopicNode from '../components/TopicNode.vue'
</script>

<style scoped>
.admin-topics-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.topics-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.topics-header h1 {
  font-size: 1.75rem;
  margin: 0;
}

.primary-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}

.primary-btn:hover {
  background: var(--accent-color);
  opacity: 0.9;
}

.topics-tree {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
}

.empty-state a {
  color: var(--accent-color);
  text-decoration: none;
}

.empty-state a:hover {
  text-decoration: underline;
}

.topic-item {
  border-bottom: 1px solid var(--border-color);
}

.topic-item:last-child {
  border-bottom: none;
}

.topic-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--surface-color);
  color: var(--text-color);
  font-family: inherit;
  font-size: 1rem;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.dialog-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--accent-color);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-color);
}

.btn-secondary:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}
</style>
