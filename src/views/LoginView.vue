<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const redirect = () => {
  const target = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  router.push(target)
}

const handleSubmit = async () => {
  if (!email.value || !password.value) {
    errorMessage.value = 'Enter email and password'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    await auth.login(email.value, password.value)
    redirect()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to login'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <h1>Welcome Back</h1>
      <p class="subtitle">Sign in to continue editing</p>

      <form @submit.prevent="handleSubmit" class="form">
        <label class="field">
          <span>Email</span>
          <input v-model="email" type="email" autocomplete="email" placeholder="you@example.com" />
        </label>

        <label class="field">
          <span>Password</span>
          <input v-model="password" type="password" autocomplete="current-password" />
        </label>

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

        <button class="primary" type="submit" :disabled="isSubmitting">
          <span v-if="!isSubmitting">Sign In</span>
          <span v-else>Signing In…</span>
        </button>

        <div class="divider">
          <span>Don't have an account?</span>
        </div>

        <button type="button" class="secondary" @click="router.push('/signup')">
          Sign Up
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
  width: min(420px, 100%);
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

.field input {
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-color);
}

.field input:focus {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.primary {
  width: 100%;
}

.secondary {
  width: 100%;
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
</style>
