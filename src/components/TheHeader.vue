<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Moon, Sun, PenTool, LogOut, FileText, Settings, Languages, Menu, X, ChevronDown, Users, BookOpen, FolderTree } from 'lucide-vue-next'
import { useAuthStore } from '../stores/authStore'
import { useI18n } from 'vue-i18n'
import { setLanguage } from '../i18n'

const { t, locale } = useI18n()
const isDark = ref(false)
const THEME_KEY = 'haccedit_theme'
const router = useRouter()
const auth = useAuthStore()
const { user, isAuthenticated } = storeToRefs(auth)
const mobileMenuOpen = ref(false)

const userName = computed(() => user.value?.name || user.value?.email || 'User')
const isAdmin = computed(() => auth.hasRole('admin'))
const isWriter = computed(() => auth.hasRole('writer'))
const canWrite = computed(() => auth.canWrite)
const adminDropdownOpen = ref(false)
const mobileAdminExpanded = ref(false)

const showAdminMenu = computed(() => isAuthenticated.value && isAdmin.value)

const closeAdminDropdown = () => {
  adminDropdownOpen.value = false
}

const toggleAdminDropdown = () => {
  adminDropdownOpen.value = !adminDropdownOpen.value
}

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

const signOut = () => {
  mobileMenuOpen.value = false
  auth.logout()
  router.push({ name: 'login' })
}

const closeMobileMenu = () => {
  mobileMenuOpen.value = false
}

// Initial Theme Setup
onMounted(() => {
  const savedTheme = localStorage.getItem(THEME_KEY)
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = false // will flip to true in toggle
    toggleTheme()
  }
})
</script>

<template>
  <header class="main-header">
    <div class="container flex-row justify-between">
      <RouterLink to="/" class="logo-area flex-row gap-2" @click="closeMobileMenu">
        <div class="logo-icon">H</div>
        <span class="logo-text">HaccForum</span>
      </RouterLink>
      
      <!-- Desktop Navigation -->
      <nav class="desktop-nav flex-row gap-4">
        <RouterLink to="/" class="icon-btn" :title="t('nav.home')">
          <span class="desktop-only">{{ t('nav.home') }}</span>
        </RouterLink>

        <RouterLink v-if="canWrite" to="/editor" class="icon-btn" :title="t('nav.write')">
          <PenTool :size="20" />
          <span class="desktop-only">{{ t('nav.write') }}</span>
        </RouterLink>

        <RouterLink v-if="isAuthenticated && canWrite" to="/drafts" class="icon-btn" :title="t('nav.drafts')">
          <FileText :size="20" />
          <span class="desktop-only">{{ t('nav.drafts') }}</span>
        </RouterLink>

        <!-- Admin Dropdown -->
        <div v-if="showAdminMenu" class="admin-dropdown-container" @mouseleave="closeAdminDropdown">
          <button 
            class="icon-btn admin-btn" 
            @click="toggleAdminDropdown"
            @mouseenter="adminDropdownOpen = true"
            :title="t('nav.admin')"
          >
            <Settings :size="20" />
            <span class="desktop-only">{{ t('nav.admin') }}</span>
            <ChevronDown :size="16" class="chevron" :class="{ rotated: adminDropdownOpen }" />
          </button>
          <transition name="dropdown">
            <div v-if="adminDropdownOpen" class="admin-dropdown">
              <div class="admin-dropdown-menu">
                <RouterLink v-if="isAdmin" to="/admin/users" class="dropdown-item" @click="closeAdminDropdown">
                  <Users :size="18" />
                  <span>Users</span>
                </RouterLink>
                <RouterLink v-if="isAdmin" to="/admin/articles" class="dropdown-item" @click="closeAdminDropdown">
                  <BookOpen :size="18" />
                  <span>{{ t('nav.articles') }}</span>
                </RouterLink>
                <RouterLink to="/admin/topics" class="dropdown-item" @click="closeAdminDropdown">
                  <FolderTree :size="18" />
                  <span>{{ t('nav.topics') }}</span>
                </RouterLink>
                <RouterLink v-if="isAdmin" to="/admin/settings" class="dropdown-item" @click="closeAdminDropdown">
                  <Settings :size="18" />
                  <span>Settings</span>
                </RouterLink>
              </div>
            </div>
          </transition>
        </div>


        <button @click="toggleLanguage" class="icon-btn language-btn" :title="t('language.select')">
          <Languages :size="20" />
          <span class="desktop-only">{{ locale === 'tr' ? 'TR' : 'EN' }}</span>
        </button>

        <button @click="toggleTheme" class="icon-btn" :title="t('nav.toggleTheme')">
          <Sun v-if="!isDark" :size="20" />
          <Moon v-else :size="20" />
        </button>

        <RouterLink v-if="!isAuthenticated" :to="{ name: 'login', query: { redirect: $route.fullPath } }" class="icon-btn" :title="t('nav.login')">
          <span class="desktop-only">{{ t('nav.login') }}</span>
        </RouterLink>

        <div v-else class="user-chip">
          <span class="name">{{ userName }}</span>
          <button class="icon-btn logout" @click="signOut" :title="t('nav.signOut')">
            <LogOut :size="18" />
          </button>
        </div>
      </nav>

      <!-- Mobile Menu Toggle -->
      <button class="mobile-menu-toggle mobile-only" @click="mobileMenuOpen = !mobileMenuOpen" :title="t('nav.menu')">
        <X v-if="mobileMenuOpen" :size="24" />
        <Menu v-else :size="24" />
      </button>
    </div>
  </header>

  <!-- Mobile Navigation Menu -->
  <transition name="slide-down">
    <div v-if="mobileMenuOpen" class="mobile-nav">
      <div class="mobile-nav-content">
        <RouterLink to="/" class="mobile-nav-item" @click="closeMobileMenu">
          <span>{{ t('nav.home') }}</span>
        </RouterLink>
        
        <RouterLink v-if="canWrite" to="/editor" class="mobile-nav-item" @click="closeMobileMenu">
          <PenTool :size="20" />
          <span>{{ t('nav.write') }}</span>
        </RouterLink>

        <RouterLink v-if="isAuthenticated && canWrite" to="/drafts" class="mobile-nav-item" @click="closeMobileMenu">
          <FileText :size="20" />
          <span>{{ t('nav.drafts') }}</span>
        </RouterLink>

        <!-- Mobile Admin Section -->
        <template v-if="showAdminMenu">
          <button class="mobile-nav-item admin-item" @click="mobileAdminExpanded = !mobileAdminExpanded">
            <Settings :size="20" />
            <span>{{ t('nav.admin') }}</span>
            <ChevronDown :size="18" class="mobile-chevron" :class="{ rotated: mobileAdminExpanded }" />
          </button>
          <transition name="expand">
            <div v-if="mobileAdminExpanded" class="mobile-admin-submenu">
              <RouterLink v-if="isAdmin" to="/admin/users" class="mobile-nav-item submenu-item" @click="closeMobileMenu">
                <Users :size="18" />
                <span>Users</span>
              </RouterLink>
              <RouterLink v-if="isAdmin" to="/admin/articles" class="mobile-nav-item submenu-item" @click="closeMobileMenu">
                <BookOpen :size="18" />
                <span>{{ t('nav.articles') }}</span>
              </RouterLink>
              <RouterLink to="/admin/topics" class="mobile-nav-item submenu-item" @click="closeMobileMenu">
                <FolderTree :size="18" />
                <span>{{ t('nav.topics') }}</span>
              </RouterLink>
              <RouterLink v-if="isAdmin" to="/admin/settings" class="mobile-nav-item submenu-item" @click="closeMobileMenu">
                <Settings :size="18" />
                <span>Settings</span>
              </RouterLink>
            </div>
          </transition>
        </template>
        
        <div class="mobile-nav-divider"></div>
        
        <button @click="toggleLanguage" class="mobile-nav-item">
          <Languages :size="20" />
          <span>{{ locale === 'tr' ? 'Türkçe' : 'English' }}</span>
        </button>

        <button @click="toggleTheme" class="mobile-nav-item">
          <Sun v-if="!isDark" :size="20" />
          <Moon v-else :size="20" />
          <span>{{ isDark ? t('nav.lightMode') : t('nav.darkMode') }}</span>
        </button>
        
        <div class="mobile-nav-divider"></div>
        
        <RouterLink v-if="!isAuthenticated" :to="{ name: 'login', query: { redirect: $route.fullPath } }" class="mobile-nav-item primary-item" @click="closeMobileMenu">
          <span>{{ t('nav.login') }}</span>
        </RouterLink>

        <div v-else class="mobile-user-section">
          <div class="mobile-user-info">
            <span class="mobile-user-name">{{ userName }}</span>
          </div>
          <button @click="signOut" class="mobile-nav-item logout-item">
            <LogOut :size="20" />
            <span>{{ t('nav.signOut') }}</span>
          </button>
        </div>
      </div>
    </div>
  </transition>

  <!-- Backdrop for mobile menu -->
  <transition name="fade">
    <div v-if="mobileMenuOpen" class="mobile-backdrop" @click="closeMobileMenu"></div>
  </transition>
</template>

<style scoped>
.main-header {
  border-bottom: 1px solid var(--border-color);
  background-color: var(--surface-color);
  position: sticky;
  top: 0;
  z-index: 50;
  padding: 0.5rem 0;
}

.logo-area {
  cursor: pointer;
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--text-color);
  text-decoration: none;
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
  text-decoration: none;
  line-height: normal; /* Fix for alignment */
}

/* RouterLink overrides */
a.icon-btn:hover,
button.icon-btn:hover {
  color: var(--text-color);
  background: rgba(125, 125, 125, 0.08);
}

/* Active state for router links */
.router-link-active.icon-btn:not(.logo-area) {
  color: var(--accent-color);
  background: rgba(125, 125, 125, 0.05);
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

/* Admin Dropdown Styles */
.admin-dropdown-container {
  position: relative;
}

.admin-btn .chevron {
  transition: transform 0.2s ease;
  margin-left: 2px;
}

.admin-btn .chevron.rotated {
  transform: rotate(180deg);
}

.admin-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  padding-top: 0.5rem;
  min-width: 180px;
  z-index: 100;
}

.admin-dropdown::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 0.5rem;
}

.admin-dropdown-menu {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  color: var(--text-color);
  text-decoration: none;
  font-size: 0.9rem;
  transition: all 0.15s;
}

.dropdown-item:hover {
  background: rgba(125, 125, 125, 0.08);
  color: var(--accent-color);
}

.dropdown-item.router-link-active {
  background: rgba(125, 125, 125, 0.05);
  color: var(--accent-color);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.language-btn {
  font-weight: 600;
}

.mobile-menu-toggle {
  display: none;
}

.mobile-nav {
  display: none;
}

.mobile-backdrop {
  display: none;
}

.mobile-only {
  display: none;
}

@media (max-width: 768px) {
  .desktop-nav {
    display: none !important;
  }

  .mobile-only {
    display: flex;
  }

  .mobile-menu-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-color);
    padding: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .mobile-menu-toggle:hover {
    color: var(--accent-color);
  }

  .mobile-nav {
    display: block;
    position: fixed;
    top: 60px;
    left: 0;
    right: 0;
    background: var(--surface-color);
    border-bottom: 1px solid var(--border-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 100;
    max-height: calc(100vh - 60px);
    overflow-y: auto;
  }

  .mobile-nav-content {
    display: flex;
    flex-direction: column;
    padding: 0.5rem 0;
  }

  .mobile-nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: transparent;
    border: none;
    color: var(--text-color);
    font-size: 1rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
    border-left: 3px solid transparent;
    text-decoration: none;
  }

  .mobile-nav-item:hover {
    background: rgba(125, 125, 125, 0.08);
    border-left-color: var(--accent-color);
  }

  .mobile-nav-item.admin-item {
    color: var(--accent-color);
  }

  .mobile-nav-item .mobile-chevron {
    margin-left: auto;
    transition: transform 0.2s ease;
  }

  .mobile-nav-item .mobile-chevron.rotated {
    transform: rotate(180deg);
  }

  .mobile-admin-submenu {
    background: rgba(125, 125, 125, 0.03);
    overflow: hidden;
  }

  .mobile-nav-item.submenu-item {
    padding-left: 2.5rem;
    color: var(--accent-color);
    font-size: 0.95rem;
  }

  .expand-enter-active,
  .expand-leave-active {
    transition: all 0.2s ease;
    max-height: 300px;
  }

  .expand-enter-from,
  .expand-leave-to {
    max-height: 0;
    opacity: 0;
  }

  .mobile-nav-item.primary-item {
    background: var(--accent-color);
    color: white;
    margin: 0 1rem;
    border-radius: var(--radius-sm);
    justify-content: center;
    font-weight: 600;
  }

  .mobile-nav-item.primary-item:hover {
    background: color-mix(in srgb, var(--accent-color) 90%, black);
    border-left-color: transparent;
  }

  .mobile-nav-item.logout-item {
    color: #b91c1c;
  }

  .mobile-nav-divider {
    height: 1px;
    background: var(--border-color);
    margin: 0.5rem 1rem;
  }

  .mobile-user-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .mobile-user-info {
    padding: 1rem 1.5rem;
    background: rgba(125, 125, 125, 0.05);
    border-left: 3px solid var(--accent-color);
  }

  .mobile-user-name {
    font-weight: 600;
    color: var(--text-color);
  }

  .mobile-backdrop {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99;
  }

  .slide-down-enter-active,
  .slide-down-leave-active {
    transition: transform 0.3s ease, opacity 0.3s ease;
  }

  .slide-down-enter-from,
  .slide-down-leave-to {
    transform: translateY(-100%);
    opacity: 0;
  }

  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.3s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
}

@media (max-width: 600px) {
  .desktop-only {
    display: none;
  }
}
</style>
