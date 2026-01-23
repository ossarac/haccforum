<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useArticleStore } from '../stores/articleStore'
import { useAuthStore } from '../stores/authStore'
import Dialog from '../components/Dialog.vue'
import { Plus, Trash2 } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const articleStore = useArticleStore()
const auth = useAuthStore()

const isLoading = computed(() => articleStore.loadingStates['drafts'] ?? false)
const drafts = computed(() => articleStore.userDrafts)
const deletingId = ref<string | null>(null)
const showDeleteConfirm = ref(false)
const draftToDelete = ref<string | null>(null)

const editDraft = (id: string) => {
  router.push(`/editor/${id}`)
}

const deleteDraftPermanently = async () => {
  if (!draftToDelete.value) return
  
  const id = draftToDelete.value
  draftToDelete.value = null
  deletingId.value = id
  try {
    await articleStore.deleteDraft(id)
  } catch (error) {
    console.error('[drafts] Failed to delete draft:', error)
  } finally {
    deletingId.value = null
  }
}

const openDeleteConfirm = (id: string) => {
  draftToDelete.value = id
  showDeleteConfirm.value = true
}

const createNewDraft = () => {
  router.push('/editor')
}

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(async () => {
  if (!auth.isAuthenticated) {
    router.push({ name: 'login', query: { redirect: '/drafts' } })
    return
  }
  
  try {
    await articleStore.fetchUserDrafts()
  } catch (error) {
    console.error('[drafts] Failed to load drafts:', error)
  }
})
</script>

<template>
  <div class="container mobile-padding">
    <div class="drafts-layout">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <h1>{{ t('drafts.myDrafts') }}</h1>
          <p class="subtitle">{{ t('drafts.saveAndManage') }}</p>
        </div>
        <button class="primary" @click="createNewDraft">
          <Plus :size="18" />
          <span class="desktop-only">{{ t('drafts.newDraft') }}</span>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading">
        <p>{{ t('drafts.loadingDrafts') }}</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="drafts.length === 0" class="empty-state">
        <div class="empty-icon">📝</div>
        <h2>{{ t('drafts.noDrafts') }}</h2>
        <p>{{ t('drafts.startWriting') }}</p>
        <button class="primary" @click="createNewDraft">
          <Plus :size="18" />
          {{ t('drafts.createFirstDraft') }}
        </button>
      </div>

      <!-- Drafts List -->
      <div v-else class="drafts-grid">
        <div v-for="draft in drafts" :key="draft.id" class="draft-card">
          <div class="draft-header">
            <div class="draft-title-section">
              <h3 class="draft-title">{{ draft.title || t('drafts.untitledDraft') }}</h3>
              <p class="draft-meta">
                {{ t('drafts.lastUpdated') }} {{ formatDateTime(draft.updatedAt) }}
              </p>
            </div>
            <div class="draft-actions">
              <button
                class="icon-btn delete-btn"
                @click="openDeleteConfirm(draft.id)"
                :disabled="deletingId === draft.id"
                :title="t('drafts.deleteDraft')"
              >
                <Trash2 :size="24" />
              </button>
            </div>
          </div>

          <!-- Preview of content -->
          <div class="draft-preview">
            <p>{{ draft.content.substring(0, 120).replace(/<[^>]*>/g, '') }}...</p>
          </div>

          <!-- Action buttons -->
          <div class="draft-footer">
            <button class="secondary-btn" @click="editDraft(draft.id)">
              {{ t('drafts.continueEditing') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <Dialog
    :is-open="showDeleteConfirm"
    type="confirm"
    :title="t('drafts.deleteDraft')"
    :message="t('drafts.deleteConfirmation')"
    :confirm-text="t('common.delete')"
    :cancel-text="t('common.cancel')"
    @confirm="deleteDraftPermanently"
    @close="showDeleteConfirm = false"
  />
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.mobile-padding {
  padding: 0 1rem;
}

.drafts-layout {
  padding: 2rem 0;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 3rem;
  gap: 2rem;
}

.header-content h1 {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0;
  margin-bottom: 0.5rem;
  color: var(--text-color);
}

.subtitle {
  color: var(--text-secondary);
  margin: 0;
  font-size: 1.1rem;
}

.loading,
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: var(--text-color);
}

.empty-state p {
  margin-bottom: 2rem;
  font-size: 1.1rem;
}

.drafts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.draft-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  background: var(--surface-color);
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.draft-card:hover {
  border-color: var(--accent-color);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
}

.draft-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  gap: 1rem;
}

.draft-title-section {
  flex: 1;
  min-width: 0;
}

.draft-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-color);
  word-break: break-word;
  line-height: 1.4;
}

.draft-meta {
  margin: 0.5rem 0 0 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.draft-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-secondary);
  padding: 0;
}

.icon-btn svg {
  width: 18px;
  height: 18px;
}

.icon-btn:hover {
  background: var(--bg-color);
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.delete-btn {
  color: #ef4444;
  border-color: #ef4444;
}

.delete-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  border-color: #dc2626;
  color: #dc2626;
}

.draft-preview {
  flex: 1;
  margin-bottom: 1rem;
}

.draft-preview p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.draft-footer {
  display: flex;
  gap: 0.75rem;
}

.secondary-btn {
  flex: 1;
  padding: 0.75rem 1rem;
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

.primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.desktop-only {
  display: inline;
}

@media (max-width: 600px) {
  .drafts-layout {
    padding: 1rem 0;
  }

  .header {
    flex-direction: column;
    margin-bottom: 2rem;
  }

  .header-content h1 {
    font-size: 2rem;
  }

  .drafts-grid {
    grid-template-columns: 1fr;
  }

  .desktop-only {
    display: none;
  }
}
</style>
