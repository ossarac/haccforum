<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

const router = useRouter()
const auth = useAuthStore()

const handleSubmit = async () => {
  errorMessage.value = ''

  if (!name.value || !email.value || !password.value) {
    errorMessage.value = 'All fields are required'
    return
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match'
    return
  }

  if (password.value.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters'
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.value)) {
    errorMessage.value = 'Please enter a valid email address'
    return
  }

  isSubmitting.value = true

  try {
    await auth.register({
      email: email.value,
      name: name.value,
      password: password.value
    })
    router.push('/')
  } catch (error: any) {
    errorMessage.value = error.message || 'Failed to create account'
  } finally {
    isSubmitting.value = false
  }
}

const goToLogin = () => {
  router.push('/login')
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <h1>Create Account</h1>
      <p class="subtitle">Join HaccForum to start writing and collaborating</p>

      <form @submit.prevent="handleSubmit" class="form">
        <label class="field">
          <span>Name</span>
          <input v-model="name" type="text" autocomplete="name" placeholder="Your name" />
        </label>

        <label class="field">
          <span>Email</span>
          <input v-model="email" type="email" autocomplete="email" placeholder="you@example.com" />
        </label>

        <label class="field">
          <span>Password</span>
          <input v-model="password" type="password" autocomplete="new-password" placeholder="At least 6 characters" />
        </label>

        <label class="field">
          <span>Confirm Password</span>
          <input v-model="confirmPassword" type="password" autocomplete="new-password" placeholder="Repeat password" />
        </label>

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

        <button class="primary" type="submit" :disabled="isSubmitting">
          <span v-if="!isSubmitting">Sign Up</span>
          <span v-else>Creating Account…</span>
        </button>

        <div class="divider">
          <span>Already have an account?</span>
        </div>

        <button type="button" class="secondary" @click="goToLogin">
          Sign In
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
</style>
