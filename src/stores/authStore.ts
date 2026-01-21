import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiRequest, setApiToken } from '../api/client'

interface ReadingPreferences {
  backgroundId?: string
  fontId?: string
  fontSize?: string
  lineHeight?: number
  docWidthId?: string
}

interface AuthUser {
  id: string
  email: string
  name: string
  roles: string[]
  emailVerified: boolean
  readingPreferences?: ReadingPreferences
}

interface AuthResponse {
  token: string
  user: AuthUser
}

const TOKEN_KEY = 'haccedit_token'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const initialised = ref(false)

  if (token.value) {
    setApiToken(token.value)
  }

  const isAuthenticated = computed(() => Boolean(user.value && token.value))
  const hasRole = (role: 'admin' | 'editor' | 'viewer') => Boolean(user.value?.roles.includes(role))

  const setSession = (value: AuthResponse | null) => {
    if (value) {
      token.value = value.token
      user.value = value.user
      setApiToken(value.token)
      localStorage.setItem(TOKEN_KEY, value.token)
    } else {
      token.value = null
      user.value = null
      setApiToken(null)
      localStorage.removeItem(TOKEN_KEY)
    }
    initialised.value = true
  }

  const login = async (email: string, password: string) => {
    const response = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true
    })
    setSession(response)
    return response.user
  }

  const register = async (payload: { email: string; name: string; password: string; roles?: string[] }) => {
    const response = await apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    setSession(response)
    return response.user
  }

  const loadSession = async () => {
    if (!token.value) {
      initialised.value = true
      return null
    }

    try {
      const response = await apiRequest<{ user: AuthUser }>('/auth/me')
      user.value = response.user
      return response.user
    } catch (error) {
      setSession(null)
      return null
    } finally {
      initialised.value = true
    }
  }

  const logout = () => {
    setSession(null)
  }

  const updateReadingPreferences = async (preferences: ReadingPreferences) => {
    const response = await apiRequest<{ user: AuthUser }>('/auth/reading-preferences', {
      method: 'PATCH',
      body: JSON.stringify(preferences)
    })
    if (user.value) {
      user.value.readingPreferences = response.user.readingPreferences
    }
    return response.user
  }

  return {
    user,
    token,
    initialised,
    isAuthenticated,
    hasRole,
    login,
    register,
    loadSession,
    logout,
    updateReadingPreferences
  }
})
