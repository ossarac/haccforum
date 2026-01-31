<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore'
import { apiRequest } from '../api/client'
import Dialog from '../components/Dialog.vue'
import { Check, X, UserPlus, Users, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp, Shield } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

interface User {
  id: string
  email: string
  name: string
  roles: string[]
  status: 'pending' | 'approved' | 'rejected'
  requestedRole?: string
  applicationNote?: string
  adminNote?: string
  emailVerified: boolean
  createdAt: string
  updatedAt: string
}

const users = ref<User[]>([])
const loading = ref(true)
const error = ref('')
const activeTab = ref<'pending' | 'approved' | 'rejected' | 'all'>('pending')
const expandedUsers = ref<Set<string>>(new Set())
const updatingRole = ref<string | null>(null)

// Dialog state
const showDialog = ref(false)
const dialogTitle = ref('')
const dialogMessage = ref('')
const dialogType = ref<'alert' | 'confirm'>('alert')
const pendingAction = ref<(() => Promise<void>) | null>(null)
const selectedUser = ref<User | null>(null)
const adminNote = ref('')
const grantWriterRole = ref(false)

onMounted(async () => {
  if (!auth.isAuthenticated) {
    router.push('/login')
    return
  }

  if (!auth.hasRole('admin')) {
    router.push('/')
    return
  }

  await loadUsers()
})

const loadUsers = async () => {
  loading.value = true
  error.value = ''
  try {
    const statusParam = activeTab.value === 'all' ? '' : `?status=${activeTab.value}`
    users.value = await apiRequest<User[]>(`/admin/users${statusParam}`)
  } catch (err: any) {
    error.value = err.message || t('admin.failedToLoadUsers')
  } finally {
    loading.value = false
  }
}

const filteredUsers = computed(() => {
  if (activeTab.value === 'all') return users.value
  return users.value.filter(u => u.status === activeTab.value)
})

const pendingCount = computed(() => users.value.filter(u => u.status === 'pending').length)

const toggleExpanded = (userId: string) => {
  if (expandedUsers.value.has(userId)) {
    expandedUsers.value.delete(userId)
  } else {
    expandedUsers.value.add(userId)
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const openApproveDialog = (user: User) => {
  selectedUser.value = user
  adminNote.value = ''
  grantWriterRole.value = user.requestedRole === 'writer'
  dialogTitle.value = t('admin.approveUser')
  dialogMessage.value = ''
  dialogType.value = 'confirm'
  pendingAction.value = approveUser
  showDialog.value = true
}

const openRejectDialog = (user: User) => {
  selectedUser.value = user
  adminNote.value = ''
  dialogTitle.value = t('admin.rejectUser')
  dialogMessage.value = ''
  dialogType.value = 'confirm'
  pendingAction.value = rejectUser
  showDialog.value = true
}

const approveUser = async () => {
  if (!selectedUser.value) return
  
  try {
    const roles = grantWriterRole.value ? ['writer', 'viewer'] : ['viewer']
    await apiRequest(`/admin/users/${selectedUser.value.id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ roles, adminNote: adminNote.value || undefined })
    })
    await loadUsers()
  } catch (err: any) {
    throw new Error(err.message || t('admin.failedToApproveUser'))
  }
}

const rejectUser = async () => {
  if (!selectedUser.value) return
  
  try {
    await apiRequest(`/admin/users/${selectedUser.value.id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ adminNote: adminNote.value || undefined })
    })
    await loadUsers()
  } catch (err: any) {
    throw new Error(err.message || t('admin.failedToRejectUser'))
  }
}

const handleDialogConfirm = async () => {
  if (pendingAction.value) {
    try {
      await pendingAction.value()
      showDialog.value = false
    } catch (err: any) {
      error.value = err.message
    }
  }
}

const handleDialogCancel = () => {
  showDialog.value = false
  selectedUser.value = null
  adminNote.value = ''
}

const switchTab = (tab: typeof activeTab.value) => {
  activeTab.value = tab
  loadUsers()
}

const getRoleBadgeClass = (role: string) => {
  switch (role) {
    case 'admin': return 'badge-admin'
    case 'writer': return 'badge-writer'
    default: return 'badge-viewer'
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending': return Clock
    case 'approved': return CheckCircle
    case 'rejected': return XCircle
    default: return Clock
  }
}

const hasWriterRole = (user: User) => user.roles.includes('writer')

const updateUserRole = async (user: User, grantWriter: boolean) => {
  updatingRole.value = user.id
  error.value = ''
  try {
    const roles = grantWriter ? ['writer', 'viewer'] : ['viewer']
    await apiRequest(`/admin/users/${user.id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ roles })
    })
    // Update local state
    const targetUser = users.value.find(u => u.id === user.id)
    if (targetUser) {
      targetUser.roles = roles
    }
  } catch (err: any) {
    error.value = err.message || t('admin.failedToUpdateRole')
  } finally {
    updatingRole.value = null
  }
}
</script>

<template>
  <div class="admin-users">
    <header class="page-header">
      <div class="header-content">
        <h1>
          <Users class="icon" />
          {{ t('admin.userManagement') }}
        </h1>
        <p class="subtitle">{{ t('admin.manageSignupRequests') }}</p>
      </div>
    </header>

    <div class="tabs">
      <button 
        :class="['tab', { active: activeTab === 'pending' }]"
        @click="switchTab('pending')"
      >
        <Clock class="tab-icon" />
        {{ t('admin.pending') }}
        <span v-if="pendingCount > 0" class="badge">{{ pendingCount }}</span>
      </button>
      <button 
        :class="['tab', { active: activeTab === 'approved' }]"
        @click="switchTab('approved')"
      >
        <CheckCircle class="tab-icon" />
        {{ t('admin.approved') }}
      </button>
      <button 
        :class="['tab', { active: activeTab === 'rejected' }]"
        @click="switchTab('rejected')"
      >
        <XCircle class="tab-icon" />
        {{ t('admin.rejected') }}
      </button>
      <button 
        :class="['tab', { active: activeTab === 'all' }]"
        @click="switchTab('all')"
      >
        <Users class="tab-icon" />
        {{ t('admin.allUsers') }}
      </button>
    </div>

    <div v-if="loading" class="loading">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-else-if="filteredUsers.length === 0" class="empty-state">
      <UserPlus class="empty-icon" />
      <p>{{ t('admin.noUsersInCategory') }}</p>
    </div>

    <div v-else class="users-list">
      <div 
        v-for="user in filteredUsers" 
        :key="user.id" 
        class="user-card"
        :class="[`status-${user.status}`]"
      >
        <div class="user-header" @click="toggleExpanded(user.id)">
          <div class="user-info">
            <div class="user-name">
              {{ user.name }}
              <component 
                :is="getStatusIcon(user.status)" 
                :class="['status-icon', `status-${user.status}`]" 
              />
            </div>
            <div class="user-email">{{ user.email }}</div>
          </div>
          <div class="user-meta">
            <div class="roles">
              <span 
                v-for="role in user.roles" 
                :key="role" 
                :class="['role-badge', getRoleBadgeClass(role)]"
              >
                {{ t(`admin.role.${role}`) }}
              </span>
            </div>
            <component 
              :is="expandedUsers.has(user.id) ? ChevronUp : ChevronDown" 
              class="expand-icon"
            />
          </div>
        </div>

        <div v-if="expandedUsers.has(user.id)" class="user-details">
          <div class="detail-row">
            <span class="label">{{ t('admin.registeredAt') }}:</span>
            <span>{{ formatDate(user.createdAt) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">{{ t('admin.emailVerified') }}:</span>
            <span :class="user.emailVerified ? 'verified' : 'not-verified'">
              {{ user.emailVerified ? t('common.yes') : t('common.no') }}
            </span>
          </div>
          <div v-if="user.requestedRole && user.requestedRole !== 'viewer'" class="detail-row">
            <span class="label">{{ t('admin.requestedRole') }}:</span>
            <span class="role-badge badge-writer">{{ t(`admin.role.${user.requestedRole}`) }}</span>
          </div>
          <div v-if="user.applicationNote" class="application-note">
            <span class="label">{{ t('admin.applicationNote') }}:</span>
            <p>{{ user.applicationNote }}</p>
          </div>
          <div v-if="user.adminNote" class="admin-note">
            <span class="label">{{ t('admin.adminNote') }}:</span>
            <p>{{ user.adminNote }}</p>
          </div>

          <!-- Role editing for approved users (non-admins only) -->
          <div v-if="user.status === 'approved' && !user.roles.includes('admin')" class="role-editor">
            <span class="label">
              <Shield class="label-icon" />
              {{ t('admin.changeRole') }}:
            </span>
            <div class="role-toggle">
              <button 
                :class="['role-option', { active: !hasWriterRole(user) }]"
                :disabled="updatingRole === user.id"
                @click.stop="updateUserRole(user, false)"
              >
                {{ t('admin.role.viewer') }}
              </button>
              <button 
                :class="['role-option', { active: hasWriterRole(user) }]"
                :disabled="updatingRole === user.id"
                @click.stop="updateUserRole(user, true)"
              >
                {{ t('admin.role.writer') }}
              </button>
            </div>
            <span v-if="updatingRole === user.id" class="updating-indicator">
              {{ t('common.saving') }}...
            </span>
          </div>

          <div v-if="user.status === 'pending'" class="user-actions">
            <button class="btn-approve" @click.stop="openApproveDialog(user)">
              <Check class="btn-icon" />
              {{ t('admin.approve') }}
            </button>
            <button class="btn-reject" @click.stop="openRejectDialog(user)">
              <X class="btn-icon" />
              {{ t('admin.reject') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <Dialog
      :is-open="showDialog"
      :title="dialogTitle"
      :message="dialogMessage"
      :type="dialogType"
      @confirm="handleDialogConfirm"
      @cancel="handleDialogCancel"
      @close="handleDialogCancel"
    >
      <template #content>
        <div class="dialog-content">
          <div v-if="selectedUser && pendingAction === approveUser" class="approval-options">
            <p>{{ t('admin.approveUserMessage', { name: selectedUser.name }) }}</p>
            
            <label v-if="selectedUser.requestedRole === 'writer'" class="checkbox-field">
              <input type="checkbox" v-model="grantWriterRole" />
              <span>{{ t('admin.grantWriterRole') }}</span>
            </label>
          </div>

          <div v-if="selectedUser && pendingAction === rejectUser" class="rejection-info">
            <p>{{ t('admin.rejectUserMessage', { name: selectedUser.name }) }}</p>
          </div>

          <label class="field">
            <span>{{ t('admin.adminNoteOptional') }}</span>
            <textarea 
              v-model="adminNote" 
              :placeholder="t('admin.adminNotePlaceholder')"
              rows="3"
            ></textarea>
          </label>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.admin-users {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.page-header {
  margin-bottom: 2rem;
}

.header-content h1 {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
}

.header-content .icon {
  width: 28px;
  height: 28px;
  color: var(--accent-color);
}

.subtitle {
  color: var(--text-secondary);
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.5rem;
  flex-wrap: wrap;
}

.tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab:hover {
  background: var(--bg-color);
  color: var(--text-color);
}

.tab.active {
  background: var(--accent-color);
  color: white;
}

.tab-icon {
  width: 16px;
  height: 16px;
}

.tab .badge {
  background: #dc2626;
  color: white;
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-weight: 600;
}

.loading,
.error-message,
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

.error-message {
  color: #dc2626;
}

.empty-state .empty-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.users-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.user-card {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.user-card.status-pending {
  border-left: 3px solid #f59e0b;
}

.user-card.status-approved {
  border-left: 3px solid #22c55e;
}

.user-card.status-rejected {
  border-left: 3px solid #dc2626;
}

.user-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.user-header:hover {
  background: var(--bg-color);
}

.user-info {
  flex: 1;
}

.user-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--text-color);
}

.status-icon {
  width: 16px;
  height: 16px;
}

.status-icon.status-pending {
  color: #f59e0b;
}

.status-icon.status-approved {
  color: #22c55e;
}

.status-icon.status-rejected {
  color: #dc2626;
}

.user-email {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.roles {
  display: flex;
  gap: 0.25rem;
}

.role-badge {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-weight: 500;
}

.badge-admin {
  background: #7c3aed;
  color: white;
}

.badge-writer {
  background: #2563eb;
  color: white;
}

.badge-viewer {
  background: var(--bg-color);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.expand-icon {
  width: 20px;
  height: 20px;
  color: var(--text-secondary);
}

.user-details {
  padding: 1rem;
  border-top: 1px solid var(--border-color);
  background: var(--bg-color);
}

.detail-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.detail-row .label {
  color: var(--text-secondary);
  font-weight: 500;
}

.verified {
  color: #22c55e;
}

.not-verified {
  color: #dc2626;
}

.application-note,
.admin-note {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: var(--radius-sm);
}

.application-note {
  background: color-mix(in srgb, var(--accent-color) 10%, transparent);
}

.admin-note {
  background: color-mix(in srgb, #f59e0b 10%, transparent);
}

.application-note .label,
.admin-note .label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.application-note p,
.admin-note p {
  margin: 0;
  font-size: 0.9rem;
  white-space: pre-wrap;
}

.user-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.btn-approve,
.btn-reject {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-approve {
  background: #22c55e;
  color: white;
}

.btn-approve:hover {
  background: #16a34a;
}

.btn-reject {
  background: #dc2626;
  color: white;
}

.btn-reject:hover {
  background: #b91c1c;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

/* Dialog content */
.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dialog-content p {
  margin: 0;
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  cursor: pointer;
}

.checkbox-field input {
  accent-color: var(--accent-color);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field span {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.field textarea {
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-color);
  color: var(--text-color);
  font-family: inherit;
  resize: vertical;
}

.field textarea:focus {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

/* Role editor */
.role-editor {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: rgba(125, 125, 125, 0.05);
  border-radius: var(--radius-sm);
  margin-top: 0.5rem;
}

.role-editor .label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}

.role-editor .label-icon {
  width: 16px;
  height: 16px;
  color: var(--accent-color);
}

.role-toggle {
  display: flex;
  gap: 0.25rem;
  background: var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.2rem;
}

.role-option {
  padding: 0.4rem 0.8rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  border-radius: calc(var(--radius-sm) - 2px);
  cursor: pointer;
  transition: all 0.15s ease;
}

.role-option:hover:not(.active):not(:disabled) {
  color: var(--text-color);
}

.role-option.active {
  background: var(--surface-color);
  color: var(--accent-color);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.role-option:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.updating-indicator {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-style: italic;
}
</style>
