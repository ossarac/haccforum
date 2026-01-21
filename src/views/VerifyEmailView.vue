<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiRequest } from '../api/client'

const route = useRoute()
const router = useRouter()

const isVerifying = ref(true)
const success = ref(false)
const errorMessage = ref('')

onMounted(async () => {
  const token = route.query.token as string
  
  if (!token) {
    errorMessage.value = 'No verification token provided'
    isVerifying.value = false
    return
  }

  try {
    await apiRequest('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
      skipAuth: true
    })
    success.value = true
  } catch (error: any) {
    errorMessage.value = error.message || 'Verification failed'
  } finally {
    isVerifying.value = false
  }
})

const goToHome = () => {
  router.push('/')
}
</script>

<template>
  <div class="verify-container">
    <div class="verify-card">
      <div v-if="isVerifying" class="verify-state">
        <div class="spinner"></div>
        <h2>Verifying your email...</h2>
        <p>Please wait a moment</p>
      </div>

      <div v-else-if="success" class="verify-state success">
        <div class="icon">✓</div>
        <h2>Email Verified!</h2>
        <p>Your email has been successfully verified. You can now enjoy full access to HaccForum.</p>
        <button class="primary" @click="goToHome">Go to Home</button>
      </div>

      <div v-else class="verify-state error">
        <div class="icon">✗</div>
        <h2>Verification Failed</h2>
        <p>{{ errorMessage }}</p>
        <button class="primary" @click="goToHome">Go to Home</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.verify-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 80px);
  padding: 2rem 1rem;
}

.verify-card {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 3rem 2.5rem;
  width: min(500px, 100%);
  box-shadow: var(--shadow-sm);
}

.verify-state {
  text-align: center;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
  margin: 0 auto 1.5rem;
}

.success .icon {
  background: #10b981;
  color: white;
}

.error .icon {
  background: #ef4444;
  color: white;
}

.verify-state h2 {
  margin-bottom: 0.75rem;
  font-size: 1.75rem;
}

.verify-state p {
  color: var(--text-secondary);
  margin-bottom: 2rem;
  line-height: 1.6;
}

.primary {
  width: 100%;
}
</style>
