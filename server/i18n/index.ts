import type { Request } from 'express'
import { en } from './locales/en.js'
import { tr } from './locales/tr.js'

export type TranslationKey = keyof typeof en

const translations = {
  en,
  tr
}

/**
 * Get translation for a key based on user's language preference
 * Falls back to English if key not found or language not supported
 */
export function t(key: TranslationKey, req?: Request): string {
  const language = req?.user?.language || 'en'
  const locale = translations[language as keyof typeof translations] || translations.en
  return locale[key] || en[key] || key
}

/**
 * Get user's preferred language from request
 */
export function getUserLanguage(req?: Request): string {
  return req?.user?.language || 'en'
}
