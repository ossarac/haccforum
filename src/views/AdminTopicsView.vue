<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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

const mergeTargetId = ref<string | null>(null)
const mergeDeleteSource = ref(true)
const mergePreview = ref<{ movedArticles: number; reparentedTopics: number } | null>(null)
const mergeLoading = ref(false)
const mergeError = ref('')
const mergeDrawerOpen = ref(false)
const mergeSourceTopic = ref<Topic | null>(null)

onMounted(async () => {
  // Check auth
  if (!auth.isAuthenticated) {
    router.push('/login')
    return
  }

  if (!auth.user?.roles.includes('admin')) {
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

const selectTopic = (topic: Topic) => {
  selectedTopic.value = topic
  mergePreview.value = null
  mergeError.value = ''
  if (mergeTargetId.value === topic.id) {
    mergeTargetId.value = null
  }
}

const openMergeDrawer = (topic: Topic) => {
  mergeSourceTopic.value = topic
  mergeTargetId.value = null
  mergeDeleteSource.value = true
  mergePreview.value = null
  mergeError.value = ''
  mergeDrawerOpen.value = true
}

const closeMergeDrawer = () => {
  mergeDrawerOpen.value = false
  mergeSourceTopic.value = null
  mergeTargetId.value = null
  mergePreview.value = null
  mergeError.value = ''
}

const mergeTargetOptions = computed(() => {
  return topicStore.flatTopicList.filter(t => t.id !== mergeSourceTopic.value?.id)
})

const isTargetDescendant = computed(() => {
  if (!mergeSourceTopic.value || !mergeTargetId.value) return false
  const target = topicStore.topicsById[mergeTargetId.value]
  if (!target) return false
  return (target.ancestors || []).includes(mergeSourceTopic.value.id)
})

const validateMergeInputs = (): string | null => {
  if (!mergeSourceTopic.value || !mergeTargetId.value) {
    return t('admin.mustSelectSourceTarget')
  }
  if (mergeTargetId.value === mergeSourceTopic.value.id) {
    return t('admin.cannotMergeSame')
  }
  if (isTargetDescendant.value) {
    return t('admin.mergeTargetDescendant')
  }
  return null
}

const previewMerge = async () => {
  mergeError.value = ''
  mergePreview.value = null
  const validationError = validateMergeInputs()
  if (validationError) {
    mergeError.value = validationError
    return
  }
  mergeLoading.value = true
  const result = await topicStore.mergeTopics({
    sourceId: mergeSourceTopic.value!.id,
    targetId: mergeTargetId.value!,
    dryRun: true,
    deleteSource: mergeDeleteSource.value
  })
  mergeLoading.value = false
  if (!result) {
    mergeError.value = topicStore.error || t('admin.mergeFailed')
    return
  }
  mergePreview.value = {
    movedArticles: result.movedArticles,
    reparentedTopics: result.reparentedTopics
  }
}

const executeMerge = async () => {
  mergeError.value = ''
  const validationError = validateMergeInputs()
  if (validationError) {
    mergeError.value = validationError
    return
  }
  mergeLoading.value = true
  const result = await topicStore.mergeTopics({
    sourceId: mergeSourceTopic.value!.id,
    targetId: mergeTargetId.value!,
    dryRun: false,
    deleteSource: mergeDeleteSource.value
  })
  mergeLoading.value = false
  if (!result) {
    mergeError.value = topicStore.error || t('admin.mergeFailed')
    return
  }
  closeMergeDrawer()
  await topicStore.fetchTopics()
  alert(t('admin.mergeCompleted'))
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
          :selected-id="selectedTopic?.id || null"
          @expand="toggleExpanded" 
          @edit="openEditDialog" 
          @delete="openDeleteDialog" 
          @create-child="openCreateDialog" 
          @select="selectTopic"
          @merge="openMergeDrawer"
        />
      </div>
    </div>

    <!-- Merge Drawer Backdrop -->
    <Transition name="fade">
      <div v-if="mergeDrawerOpen" class="drawer-backdrop" @click="closeMergeDrawer"></div>
    </Transition>

    <!-- Merge Drawer -->
    <Transition name="slide">
      <div v-if="mergeDrawerOpen" class="merge-drawer">
        <div class="drawer-header">
          <h2>{{ t('admin.mergePanelTitle') }}</h2>
          <button class="close-btn" @click="closeMergeDrawer" aria-label="Close">×</button>
        </div>

        <div class="drawer-content">
          <!-- Source Topic Card -->
          <div class="topic-card source">
            <div class="card-header">
              <span class="card-label">{{ t('admin.mergeSource') }}</span>
            </div>
            <div class="card-body">
              <h3 class="topic-name">{{ mergeSourceTopic?.name }}</h3>
              <p class="topic-path">{{ topicStore.flatTopicList.find(t => t.id === mergeSourceTopic?.id)?.displayPath }}</p>
              <div class="topic-stats">
                <span class="stat">{{ mergeSourceTopic?.articleCount || 0 }} articles</span>
              </div>
            </div>
          </div>

          <!-- Arrow -->
          <div class="arrow-container">
            <span class="arrow">→</span>
          </div>

          <!-- Target Topic Selection -->
          <div class="topic-card target">
            <div class="card-header">
              <span class="card-label">{{ t('admin.mergeTarget') }}</span>
            </div>
            <div class="card-body">
              <select
                v-model="mergeTargetId"
                class="target-select"
                :disabled="mergeLoading"
              >
                <option :value="null">{{ t('admin.selectTargetTopic') }}</option>
                <option v-for="topic in mergeTargetOptions" :key="topic.id" :value="topic.id">
                  {{ topic.displayPath }}
                </option>
              </select>
              <div v-if="mergeTargetId" class="target-info">
                <p class="topic-path">{{ topicStore.topicsById[mergeTargetId]?.name }}</p>
                <div class="topic-stats">
                  <span class="stat">{{ topicStore.topicsById[mergeTargetId]?.articleCount || 0 }} articles</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Options -->
          <div class="drawer-section">
            <label class="toggle-option">
              <input type="checkbox" v-model="mergeDeleteSource" class="toggle-input" />
              <span class="toggle-label">{{ t('admin.deleteSourceAfter') }}</span>
            </label>
          </div>

          <!-- Error Display -->
          <div v-if="mergeError" class="error-banner">
            {{ mergeError }}
          </div>

          <!-- Preview Results -->
          <Transition name="expand">
            <div v-if="mergePreview" class="preview-banner">
              <div class="preview-title">{{ t('admin.mergeDryRunDone') }}</div>
              <div class="preview-stats">
                <div class="preview-stat">
                  <span class="stat-value">{{ mergePreview.movedArticles }}</span>
                  <span class="stat-label">{{ t('admin.articlesWillMove') }}</span>
                </div>
                <div class="preview-stat">
                  <span class="stat-value">{{ mergePreview.reparentedTopics }}</span>
                  <span class="stat-label">{{ t('admin.subtopicsReparented') }}</span>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Action Buttons -->
        <div class="drawer-footer">
          <button 
            class="btn-outline" 
            :disabled="mergeLoading" 
            @click="previewMerge"
          >
            {{ mergeLoading ? t('common.loading') : t('admin.previewMerge') }}
          </button>
          <button 
            class="btn-solid" 
            :disabled="mergeLoading || !mergePreview" 
            @click="executeMerge"
          >
            {{ mergeLoading ? t('common.loading') : t('admin.executeMerge') }}
          </button>
        </div>
      </div>
    </Transition>

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

/* Drawer Backdrop */
.drawer-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 999;
  backdrop-filter: blur(2px);
}

/* Merge Drawer */
.merge-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 480px;
  max-width: 90vw;
  background: var(--surface-color);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.drawer-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.drawer-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  color: var(--text-secondary);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(125, 125, 125, 0.1);
  color: var(--text-color);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Topic Cards */
.topic-card {
  border: 2px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-color);
}

.topic-card.source {
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.05);
}

.topic-card.target {
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.05);
}

.card-header {
  padding: 0.75rem 1rem;
  background: rgba(125, 125, 125, 0.05);
  border-bottom: 1px solid var(--border-color);
}

.card-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.card-body {
  padding: 1rem;
}

.topic-name {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-color);
}

.topic-path {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-family: monospace;
}

.topic-stats {
  display: flex;
  gap: 1rem;
}

.stat {
  font-size: 0.875rem;
  color: var(--text-secondary);
  background: rgba(125, 125, 125, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.arrow-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: -0.5rem 0;
}

.arrow {
  font-size: 2rem;
  color: var(--accent-color);
  font-weight: 300;
}

.target-select {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--border-color);
  border-radius: 6px;
  background: var(--surface-color);
  color: var(--text-color);
  font-size: 1rem;
  margin-bottom: 0.75rem;
  transition: all 0.2s;
}

.target-select:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.target-info {
  animation: fadeIn 0.3s ease;
}

/* Drawer Section */
.drawer-section {
  padding: 1rem;
  border-radius: 6px;
  background: rgba(125, 125, 125, 0.05);
}

.toggle-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  user-select: none;
}

.toggle-input {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: var(--accent-color);
}

.toggle-label {
  font-size: 0.95rem;
  color: var(--text-color);
  font-weight: 500;
}

/* Banners */
.error-banner {
  padding: 1rem;
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: 6px;
  color: #dc2626;
  font-size: 0.9rem;
}

.preview-banner {
  padding: 1.25rem;
  background: rgba(59, 130, 246, 0.1);
  border: 2px solid rgba(59, 130, 246, 0.3);
  border-radius: 8px;
}

.preview-title {
  font-weight: 600;
  color: var(--accent-color);
  margin-bottom: 1rem;
  font-size: 0.95rem;
}

.preview-stats {
  display: flex;
  gap: 1.5rem;
}

.preview-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--accent-color);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-align: center;
}

/* Drawer Footer */
.drawer-footer {
  padding: 1.5rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 0.75rem;
  flex-shrink: 0;
}

.btn-outline {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border: 2px solid var(--border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--text-color);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-outline:hover:not(:disabled) {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: rgba(59, 130, 246, 0.05);
}

.btn-outline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-solid {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  background: var(--accent-color);
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-solid:hover:not(:disabled) {
  background: var(--accent-color);
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-solid:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 200px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Remove old merge panel styles */
.merge-panel,
.merge-hint,
.merge-form,
.form-group,
.checkbox-label,
.pill,
.actions-row,
.preview-box {
  display: none;
}
</style>
