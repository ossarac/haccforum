import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import env from '../config/env.js'
import type { AuthUser } from '../types/auth.js'
import { getSetting, SETTINGS_KEYS } from '../models/Settings.js'

interface TokenPayload {
  id: string
  email: string
  name: string
  roles: string[]
  status: string
  language?: string
  emailVerified?: boolean
  readingPreferences?: any
  iat: number
  exp: number
}

function unauthorized(res: Response) {
  return res.status(401).json({ message: 'Unauthorized' })
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    unauthorized(res)
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as TokenPayload
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      roles: decoded.roles,
      status: decoded.status as 'pending' | 'approved' | 'rejected',
      language: decoded.language,
      emailVerified: decoded.emailVerified,
      readingPreferences: decoded.readingPreferences
    }
    next()
  } catch (error) {
    console.warn('[auth] token verification failed', error)
    unauthorized(res)
  }
}

export function optionalAuthenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    next()
    return
  }

  if (!authHeader.startsWith('Bearer ')) {
    // Skip auth silently for invalid format
    next()
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as TokenPayload
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      roles: decoded.roles,
      status: decoded.status as 'pending' | 'approved' | 'rejected',
      language: decoded.language,
      emailVerified: decoded.emailVerified,
      readingPreferences: decoded.readingPreferences
    }
    next()
  } catch (error) {
    console.warn('[auth] optional token verification failed', error)
    // Don't reject - just proceed without user
    next()
  }
}

export function requireAnyRole(...allowed: Array<'admin' | 'writer' | 'viewer'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      unauthorized(res)
      return
    }

    // Must be approved to access role-protected routes
    if (req.user.status !== 'approved') {
      res.status(403).json({ message: 'Account not approved' })
      return
    }

    const hasRole = req.user.roles.some((role: string) => allowed.includes(role as typeof allowed[number]))
    if (!hasRole) {
      res.status(403).json({ message: 'Forbidden' })
      return
    }

    next()
  }
}

// Middleware to require approved status
export function requireApproved(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    unauthorized(res)
    return
  }

  if (req.user.status !== 'approved') {
    res.status(403).json({ 
      message: 'Account not approved',
      code: 'NOT_APPROVED'
    })
    return
  }

  next()
}

// Middleware to check guest access for reading content
export async function requireAuthIfGuestDisabled(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const guestAccessEnabled = await getSetting(SETTINGS_KEYS.GUEST_ACCESS_ENABLED, true)
    
    if (guestAccessEnabled) {
      // Guest access is enabled, anyone can proceed
      next()
      return
    }

    // Guest access is disabled, require authenticated and approved user
    if (!req.user) {
      res.status(401).json({ 
        message: 'Authentication required',
        code: 'GUEST_ACCESS_DISABLED'
      })
      return
    }

    if (req.user.status !== 'approved') {
      res.status(403).json({ 
        message: 'Account not approved',
        code: 'NOT_APPROVED'
      })
      return
    }

    next()
  } catch (error) {
    console.error('[auth] requireAuthIfGuestDisabled error', error)
    // Fail open - allow access if settings can't be read
    next()
  }
}
