import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import env from '../config/env.js'
import type { AuthUser } from '../types/auth.js'

interface TokenPayload {
  id: string
  email: string
  name: string
  roles: string[]
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

export function requireAnyRole(...allowed: Array<'admin' | 'editor' | 'viewer'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      unauthorized(res)
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
