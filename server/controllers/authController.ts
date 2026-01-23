import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import UserModel from '../models/User.js'
import { issueToken, serializeUser } from '../utils/auth.js'
import { generateVerificationToken, sendVerificationEmail, verifyToken } from '../utils/verification.js'
import { t } from '../i18n/index.js'

const allowedRoles = new Set(['admin', 'editor', 'viewer'])

function sanitizeRoles(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return ['editor']
  }
  const filtered = input.filter((role): role is 'admin' | 'editor' | 'viewer' => allowedRoles.has(role))
  return filtered.length ? Array.from(new Set(filtered)) : ['editor']
}

export async function register(req: Request, res: Response): Promise<void> {
  const { email, name, password, roles } = req.body ?? {}
  if (!email || !name || !password) {
    res.status(400).json({ message: t('emailNamePasswordRequired', req) })
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    res.status(400).json({ message: t('invalidEmailFormat', req) })
    return
  }

  if (password.length < 6) {
    res.status(400).json({ message: t('passwordMinLength', req) })
    return
  }

  const existing = await UserModel.findOne({ email: email.toLowerCase() })
  if (existing) {
    res.status(409).json({ message: t('userAlreadyExists', req) })
    return
  }

  const userCount = await UserModel.estimatedDocumentCount()
  let assignedRoles = sanitizeRoles(roles)

  // First user becomes admin automatically
  if (userCount === 0) {
    if (!assignedRoles.includes('admin')) {
      assignedRoles.push('admin')
    }
  } else {
    // For subsequent users:
    // - If requester is authenticated admin, they can assign any roles
    // - If public signup (no auth), user gets 'editor' role only
    if (req.user?.roles.includes('admin')) {
      // Admin can invite with custom roles
      assignedRoles = assignedRoles.filter(role => role !== 'admin')
      if (!assignedRoles.length) {
        assignedRoles.push('editor')
      }
    } else {
      // Public signup: always gets 'editor' role
      assignedRoles = ['editor']
    }
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await UserModel.create({
    email: email.toLowerCase(),
    name,
    passwordHash,
    roles: assignedRoles,
    emailVerified: false
  })

  const verificationToken = generateVerificationToken(user.email)
  sendVerificationEmail(user.email, verificationToken)

  const token = issueToken(user)
  res.status(201).json({ token, user: serializeUser(user) })
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body ?? {}
  if (!email || !password) {
    res.status(400).json({ message: t('emailAndPasswordRequired', req) })
    return
  }

  const user = await UserModel.findOne({ email: email.toLowerCase() })
  if (!user) {
    res.status(401).json({ message: t('invalidCredentials', req) })
    return
  }

  const valid = await user.comparePassword(password)
  if (!valid) {
    res.status(401).json({ message: t('invalidCredentials', req) })
    return
  }

  const token = issueToken(user)
  res.status(200).json({ token, user: serializeUser(user) })
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: t('unauthorized', req) })
    return
  }

  res.status(200).json({ user: req.user })
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { token } = req.body ?? {}
  if (!token) {
    res.status(400).json({ message: t('verificationTokenRequired', req) })
    return
  }

  const email = verifyToken(token)
  if (!email) {
    res.status(400).json({ message: t('invalidOrExpiredToken', req) })
    return
  }

  const user = await UserModel.findOne({ email })
  if (!user) {
    res.status(404).json({ message: t('userNotFound', req) })
    return
  }

  user.emailVerified = true
  await user.save()

  res.status(200).json({ message: t('emailVerifiedSuccessfully', req), user: serializeUser(user) })
}

export async function resendVerification(req: Request, res: Response): Promise<void> {
  const { email } = req.body ?? {}
  if (!email) {
    res.status(400).json({ message: t('emailIsRequired', req) })
    return
  }

  const user = await UserModel.findOne({ email: email.toLowerCase() })
  if (!user) {
    res.status(404).json({ message: t('userNotFound', req) })
    return
  }

  if (user.emailVerified) {
    res.status(400).json({ message: t('emailAlreadyVerified', req) })
    return
  }

  const verificationToken = generateVerificationToken(user.email)
  sendVerificationEmail(user.email, verificationToken)

  res.status(200).json({ message: t('verificationEmailSent', req) })
}

export async function updateReadingPreferences(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: t('unauthorized', req) })
    return
  }

  const { backgroundId, fontId, fontSize, lineHeight, docWidthId } = req.body ?? {}

  const user = await UserModel.findById(req.user.id)
  if (!user) {
    res.status(404).json({ message: t('userNotFound', req) })
    return
  }

  user.readingPreferences = {
    backgroundId,
    fontId,
    fontSize,
    lineHeight,
    docWidthId
  }

  await user.save()
  res.status(200).json({ user: serializeUser(user) })
}

export async function updateLanguage(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: t('unauthorized', req) })
    return
  }

  const { language } = req.body ?? {}
  if (!language || !['tr', 'en'].includes(language)) {
    res.status(400).json({ message: t('invalidLanguage', req) })
    return
  }

  const user = await UserModel.findById(req.user.id)
  if (!user) {
    res.status(404).json({ message: t('userNotFound', req) })
    return
  }

  user.language = language
  await user.save()
  res.status(200).json({ user: serializeUser(user) })
}
