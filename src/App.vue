<script setup lang="ts">
import { RouterView } from 'vue-router'
import { onMounted } from 'vue'
import { useAuthStore } from './stores/authStore'
import TheHeader from './components/TheHeader.vue'

const auth = useAuthStore()

onMounted(() => {
  if (!auth.initialised) {
    auth.loadSession()
  }
})
</script>

<template>
  <div class="app-layout">
    <TheHeader />

    <main>
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  background-color: var(--bg-color);
  color: var(--text-color);
}
</style>
