<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router'
import { ref, onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Moon, Sun, PenTool, LogOut, FileText, Settings, Languages } from 'lucide-vue-next'
import { useAuthStore } from './stores/authStore'
import { useI18n } from 'vue-i18n'
import { setLanguage } from './i18n'

const { t, locale } = useI18n()
const isDark = ref(false)
const THEME_KEY = 'haccedit_theme'
const router = useRouter()
const auth = useAuthStore()
const { user, isAuthenticated } = storeToRefs(auth)

const userName = computed(() => user.value?.name || user.value?.email || 'User')
const isAdmin = computed(() => auth.hasRole('admin'))

const toggleTheme = () => {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  localStorage.setItem(THEME_KEY, isDark.value ? 'dark' : 'light')
}

const toggleLanguage = async () => {
  const newLang = locale.value === 'tr' ? 'en' : 'tr'
  setLanguage(newLang)
  
  // If user is authenticated, save preference to profile
  if (isAuthenticated.value) {
    try {
      await auth.updateLanguagePreference(newLang)
    } catch (error) {
      console.error('Failed to save language preference:', error)
    }
  }
}

onMounted(() => {
  const savedTheme = localStorage.getItem(THEME_KEY)
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = false // will flip to true in toggle
    toggleTheme()
  }
  if (!auth.initialised) {
    auth.loadSession()
  }
})

const goHome = () => router.push('/')

const goToLogin = () => router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })

const signOut = () => {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="app-layout">
    <header class="main-header">
      <div class="container flex-row justify-between">
        <div class="logo-area flex-row gap-2" @click="goHome">
          <div class="logo-icon">H</div>
          <span class="logo-text">HaccForum</span>
        </div>
        
        <nav class="flex-row gap-4">
          <button @click="router.push('/')" class="icon-btn" :title="t('nav.home')">
            <span class="desktop-only">{{ t('nav.home') }}</span>
          </button>
          <button @click="router.push('/editor')" class="icon-btn" :title="t('nav.write')">
            <PenTool :size="20" />
            <span class="desktop-only">{{ t('nav.write') }}</span>
          </button>
          <button v-if="isAuthenticated" @click="router.push('/drafts')" class="icon-btn" :title="t('nav.drafts')">
            <FileText :size="20" />
            <span class="desktop-only">{{ t('nav.drafts') }}</span>
          </button>
          <button v-if="isAuthenticated && isAdmin" @click="router.push('/admin/articles')" class="icon-btn admin-btn" :title="t('nav.admin') + ' - ' + t('nav.articles')">
            <Settings :size="20" />
            <span class="desktop-only">{{ t('nav.articles') }}</span>
          </button>
          <button v-if="isAuthenticated && (isAdmin || auth.hasRole('editor'))" @click="router.push('/admin/topics')" class="icon-btn admin-btn" :title="t('nav.manageTopics')">
            <Settings :size="20" />
            <span class="desktop-only">{{ t('nav.topics') }}</span>
          </button>
          <button @click="toggleLanguage" class="icon-btn language-btn" :title="t('language.select')">
            <Languages :size="20" />
            <span class="desktop-only">{{ locale === 'tr' ? 'TR' : 'EN' }}</span>
          </button>
          <button @click="toggleTheme" class="icon-btn" :title="t('nav.toggleTheme')">
            <Sun v-if="!isDark" :size="20" />
            <Moon v-else :size="20" />
          </button>
          <button v-if="!isAuthenticated" @click="goToLogin" class="icon-btn" :title="t('nav.login')">
            <span class="desktop-only">{{ t('nav.login') }}</span>
          </button>
          <div v-else class="user-chip">
            <span class="name">{{ userName }}</span>
            <button class="icon-btn logout" @click="signOut" :title="t('nav.signOut')">
              <LogOut :size="18" />
            </button>
          </div>
        </nav>
      </div>
    </header>

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

.main-header {
  border-bottom: 1px solid var(--border-color);
  background-color: var(--surface-color);
  position: sticky;
  top: 0;
  z-index: 50;
  padding: 0.5rem 0;
}

.main-header .container {
  max-width: 1200px;
  padding: 0 1rem;
}

.logo-area {
  cursor: pointer;
  font-weight: 700;
  font-size: 1.1rem;
}

.logo-icon {
  background: var(--accent-color);
  color: white;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 0.9rem;
}

.icon-btn {
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.6rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.icon-btn:hover {
  color: var(--text-color);
  background: rgba(125, 125, 125, 0.08);
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-sm);
  background: rgba(125, 125, 125, 0.08);
  color: var(--text-secondary);
}

.user-chip .name {
  font-size: 0.85rem;
  font-weight: 500;
}

.logout {
  padding: 0.2rem;
}

.admin-btn {
  color: var(--accent-color);
}

.admin-btn:hover {
  background: rgba(125, 125, 125, 0.12);
}

.language-btn {
  font-weight: 600;
}

@media (max-width: 600px) {
  .desktop-only {
    display: none;
  }
}
</style>
