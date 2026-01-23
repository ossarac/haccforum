import jwt from 'jsonwebtoken'
import type { UserDocument } from '../models/User.js'
import env from '../config/env.js'
import type { AuthUser } from '../types/auth.js'

export function serializeUser(user: UserDocument): AuthUser {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    roles: user.roles,
    emailVerified: user.emailVerified,
    language: user.language,
    readingPreferences: user.readingPreferences
  }
}

export function issueToken(user: UserDocument): string {
  return jwt.sign(serializeUser(user), env.jwtSecret, { expiresIn: '12h' })
}
