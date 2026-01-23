import { createI18n } from 'vue-i18n'
import tr from './locales/tr'
import en from './locales/en'

const LANGUAGE_KEY = 'haccedit_language'

// Get saved language or default to Turkish
const savedLanguage = localStorage.getItem(LANGUAGE_KEY) || 'tr'

export const i18n = createI18n({
  legacy: false,
  locale: savedLanguage,
  fallbackLocale: 'en',
  messages: {
    tr,
    en
  }
})

export function setLanguage(locale: string) {
  i18n.global.locale.value = locale as 'tr' | 'en'
  localStorage.setItem(LANGUAGE_KEY, locale)
}

export function getLanguage() {
  return i18n.global.locale.value
}
