<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore'
import { apiRequest } from '../api/client'
import { Settings, Eye, EyeOff, Save } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

interface SiteSettings {
  guestAccessEnabled: boolean
  requireEmailVerification: boolean
}

const settings = ref<SiteSettings>({
  guestAccessEnabled: true,
  requireEmailVerification: false
})
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')

onMounted(async () => {
  if (!auth.isAuthenticated) {
    router.push('/login')
    return
  }

  if (!auth.hasRole('admin')) {
    router.push('/')
    return
  }

  await loadSettings()
})

const loadSettings = async () => {
  loading.value = true
  error.value = ''
  try {
    settings.value = await apiRequest<SiteSettings>('/admin/settings')
  } catch (err: any) {
    error.value = err.message || t('admin.failedToLoadSettings')
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    settings.value = await apiRequest<SiteSettings>('/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings.value)
    })
    success.value = t('admin.settingsSaved')
    setTimeout(() => { success.value = '' }, 3000)
  } catch (err: any) {
    error.value = err.message || t('admin.failedToSaveSettings')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="admin-settings">
    <header class="page-header">
      <div class="header-content">
        <h1>
          <Settings class="icon" />
          {{ t('admin.siteSettings') }}
        </h1>
        <p class="subtitle">{{ t('admin.configureAccessSettings') }}</p>
      </div>
    </header>

    <div v-if="loading" class="loading">
      {{ t('common.loading') }}
    </div>

    <div v-else class="settings-form">
      <div v-if="error" class="error-message">{{ error }}</div>
      <div v-if="success" class="success-message">{{ success }}</div>

      <div class="setting-group">
        <h2>{{ t('admin.accessControl') }}</h2>
        
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">
              <component :is="settings.guestAccessEnabled ? Eye : EyeOff" class="setting-icon" />
              {{ t('admin.guestAccess') }}
            </div>
            <p class="setting-description">{{ t('admin.guestAccessDescription') }}</p>
          </div>
          <label class="toggle">
            <input 
              type="checkbox" 
              v-model="settings.guestAccessEnabled"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="setting-note" v-if="!settings.guestAccessEnabled">
          <strong>{{ t('admin.note') }}:</strong> {{ t('admin.guestAccessDisabledNote') }}
        </div>
      </div>

      <div class="form-actions">
        <button class="primary" @click="saveSettings" :disabled="saving">
          <Save class="btn-icon" />
          <span v-if="!saving">{{ t('common.save') }}</span>
          <span v-else>{{ t('common.saving') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-settings {
  max-width: 700px;
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

.loading {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
}

.settings-form {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.5rem;
}

.error-message,
.success-message {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

.error-message {
  background: color-mix(in srgb, #dc2626 15%, transparent);
  color: #dc2626;
  border: 1px solid color-mix(in srgb, #dc2626 30%, transparent);
}

.success-message {
  background: color-mix(in srgb, #22c55e 15%, transparent);
  color: #16a34a;
  border: 1px solid color-mix(in srgb, #22c55e 30%, transparent);
}

.setting-group {
  margin-bottom: 2rem;
}

.setting-group h2 {
  font-size: 1.1rem;
  margin-bottom: 1rem;
  color: var(--text-color);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1rem;
  background: var(--bg-color);
  border-radius: var(--radius-sm);
  margin-bottom: 0.75rem;
}

.setting-info {
  flex: 1;
  padding-right: 1rem;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 0.25rem;
}

.setting-icon {
  width: 18px;
  height: 18px;
  color: var(--accent-color);
}

.setting-description {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0;
}

.setting-note {
  padding: 0.75rem 1rem;
  background: color-mix(in srgb, #f59e0b 10%, transparent);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.setting-note strong {
  color: #b45309;
}

/* Toggle switch */
.toggle {
  position: relative;
  display: inline-block;
  width: 52px;
  height: 28px;
  flex-shrink: 0;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--border-color);
  transition: 0.3s;
  border-radius: 28px;
}

.toggle-slider::before {
  position: absolute;
  content: '';
  height: 22px;
  width: 22px;
  left: 3px;
  bottom: 3px;
  background: white;
  transition: 0.3s;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle input:checked + .toggle-slider {
  background: var(--accent-color);
}

.toggle input:checked + .toggle-slider::before {
  transform: translateX(24px);
}

.toggle input:focus + .toggle-slider {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color) 30%, transparent);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
  margin-top: 1rem;
}

.primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-icon {
  width: 18px;
  height: 18px;
}
</style>
