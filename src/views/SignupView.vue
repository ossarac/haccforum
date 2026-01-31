<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore'

const { t } = useI18n()
const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const requestedRole = ref<'viewer' | 'writer'>('viewer')
const applicationNote = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)
const registrationComplete = ref(false)

const router = useRouter()
const auth = useAuthStore()

const showApplicationNote = computed(() => requestedRole.value === 'writer')

// Clear application note when switching to viewer
watch(requestedRole, (newRole) => {
  if (newRole === 'viewer') {
    applicationNote.value = ''
  }
})

const handleSubmit = async () => {
  errorMessage.value = ''

  if (!name.value || !email.value || !password.value) {
    errorMessage.value = t('signup.allFieldsRequired')
    return
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = t('signup.passwordsDoNotMatch')
    return
  }

  if (password.value.length < 6) {
    errorMessage.value = t('auth.passwordLength')
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.value)) {
    errorMessage.value = t('signup.invalidEmail')
    return
  }

  // If requesting writer role, require application note
  if (requestedRole.value === 'writer' && !applicationNote.value.trim()) {
    errorMessage.value = t('signup.applicationNoteRequired')
    return
  }

  isSubmitting.value = true

  try {
    await auth.register({
      email: email.value,
      name: name.value,
      password: password.value,
      requestedRole: requestedRole.value,
      applicationNote: requestedRole.value === 'writer' ? applicationNote.value : undefined
    })
    registrationComplete.value = true
  } catch (error: any) {
    errorMessage.value = error.message || t('signup.failedToCreateAccount')
  } finally {
    isSubmitting.value = false
  }
}

const goToLogin = () => {
  router.push('/login')
}

const goToHome = () => {
  router.push('/')
}
</script>

<template>
  <div class="auth-container">
    <!-- Registration success message -->
    <div v-if="registrationComplete" class="auth-card success-card">
      <div class="success-icon">✓</div>
      <h1>{{ t('signup.registrationComplete') }}</h1>
      <p class="success-message">{{ t('signup.pendingApprovalMessage') }}</p>
      <p class="success-details">{{ t('signup.verifyEmailReminder') }}</p>
      <button class="primary" @click="goToHome">{{ t('signup.goToHome') }}</button>
    </div>

    <!-- Registration form -->
    <div v-else class="auth-card">
      <h1>{{ t('signup.createAccount') }}</h1>
      <p class="subtitle">{{ t('signup.joinMessage') }}</p>

      <form @submit.prevent="handleSubmit" class="form">
        <label class="field">
          <span>{{ t('auth.name') }}</span>
          <input v-model="name" type="text" autocomplete="name" placeholder="Your name" />
        </label>

        <label class="field">
          <span>{{ t('auth.email') }}</span>
          <input v-model="email" type="email" autocomplete="email" placeholder="you@example.com" />
        </label>

        <label class="field">
          <span>{{ t('auth.password') }}</span>
          <input v-model="password" type="password" autocomplete="new-password" :placeholder="t('signup.atLeast6Characters')" />
        </label>

        <label class="field">
          <span>{{ t('signup.confirmPassword') }}</span>
          <input v-model="confirmPassword" type="password" autocomplete="new-password" :placeholder="t('signup.repeatPassword')" />
        </label>

        <div class="field">
          <span>{{ t('signup.accountType') }}</span>
          <div class="role-options">
            <label class="role-option">
              <input type="radio" v-model="requestedRole" value="viewer" />
              <div class="role-content">
                <strong>{{ t('signup.roleViewer') }}</strong>
                <span>{{ t('signup.roleViewerDesc') }}</span>
              </div>
            </label>
            <label class="role-option">
              <input type="radio" v-model="requestedRole" value="writer" />
              <div class="role-content">
                <strong>{{ t('signup.roleWriter') }}</strong>
                <span>{{ t('signup.roleWriterDesc') }}</span>
              </div>
            </label>
          </div>
        </div>

        <label v-if="showApplicationNote" class="field">
          <span>{{ t('signup.applicationNote') }}</span>
          <textarea 
            v-model="applicationNote" 
            :placeholder="t('signup.applicationNotePlaceholder')"
            rows="4"
            maxlength="2000"
          ></textarea>
          <span class="char-count">{{ applicationNote.length }}/2000</span>
        </label>

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

        <button class="primary" type="submit" :disabled="isSubmitting">
          <span v-if="!isSubmitting">{{ t('signup.signUp') }}</span>
          <span v-else>{{ t('signup.creatingAccount') }}</span>
        </button>

        <p class="approval-notice">{{ t('signup.approvalNotice') }}</p>

        <div class="divider">
          <span>{{ t('signup.alreadyHaveAccount') }}</span>
        </div>

        <button type="button" class="secondary" @click="goToLogin">
          {{ t('auth.login') }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.auth-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 80px);
  padding: 2rem 1rem;
}

.auth-card {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 2.5rem;
  width: min(480px, 100%);
  box-shadow: var(--shadow-sm);
}

.auth-card h1 {
  margin-bottom: 0.5rem;
  font-size: 1.75rem;
}

.subtitle {
  margin-bottom: 2rem;
  color: var(--text-secondary);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.field input:not([type="radio"]),
.field textarea {
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-color);
  font-family: inherit;
  font-size: 0.95rem;
  resize: vertical;
}

.field input:focus,
.field textarea:focus {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.role-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.role-option {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.role-option:hover {
  border-color: var(--accent-color);
  background: var(--bg-color);
}

.role-option:has(input:checked) {
  border-color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 10%, transparent);
}

.role-option input[type="radio"] {
  margin-top: 0.25rem;
  accent-color: var(--accent-color);
}

.role-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.role-content strong {
  color: var(--text-color);
  font-weight: 600;
}

.role-content span {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.char-count {
  align-self: flex-end;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.approval-notice {
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-align: center;
  padding: 0.75rem;
  background: color-mix(in srgb, var(--warning-color, #f59e0b) 10%, transparent);
  border-radius: var(--radius-sm);
  margin: 0;
}

.primary,
.secondary {
  width: 100%;
}

.secondary {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-color);
}

.secondary:hover {
  background: var(--bg-color);
}

.error {
  color: #dc2626;
  font-size: 0.85rem;
}

.divider {
  text-align: center;
  position: relative;
  margin: 0.5rem 0;
}

.divider span {
  background: var(--surface-color);
  padding: 0 1rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
  position: relative;
  z-index: 1;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--border-color);
}

/* Success card styling */
.success-card {
  text-align: center;
}

.success-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 1.5rem;
  background: color-mix(in srgb, var(--success-color, #22c55e) 15%, transparent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--success-color, #22c55e);
}

.success-message {
  color: var(--text-color);
  font-size: 1rem;
  margin-bottom: 1rem;
}

.success-details {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}
</style>
