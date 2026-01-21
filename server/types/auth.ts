export interface ReadingPreferences {
  backgroundId?: string
  fontId?: string
  fontSize?: string
  lineHeight?: number
  docWidthId?: string
}

export interface AuthUser {
  id: string
  email: string
  name: string
  roles: string[]
  emailVerified: boolean
  readingPreferences?: ReadingPreferences
}
