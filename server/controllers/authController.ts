import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import UserModel, { type UserRole, type UserStatus } from '../models/User.js'
import { issueToken, serializeUser } from '../utils/auth.js'
import { generateVerificationToken, sendVerificationEmail, verifyToken } from '../utils/verification.js'
import { t } from '../i18n/index.js'

const allowedRoles = new Set<UserRole>(['admin', 'writer', 'viewer'])

function sanitizeRole(input: unknown): UserRole {
  if (typeof input === 'string' && allowedRoles.has(input as UserRole)) {
    return input as UserRole
  }
  return 'viewer'
}

export async function register(req: Request, res: Response): Promise<void> {
  const { email, name, password, requestedRole, applicationNote } = req.body ?? {}
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
  
  let assignedRoles: UserRole[] = ['viewer']
  let status: UserStatus = 'pending'
  const sanitizedRequestedRole = sanitizeRole(requestedRole)

  // First user becomes admin automatically and is auto-approved
  if (userCount === 0) {
    assignedRoles = ['admin', 'writer', 'viewer']
    status = 'approved'
  } else if (req.user?.roles.includes('admin')) {
    // Admin creating a user - auto-approve with requested role
    assignedRoles = sanitizedRequestedRole === 'writer' ? ['writer', 'viewer'] : ['viewer']
    status = 'approved'
  }
  // For public signup, user starts as pending viewer

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await UserModel.create({
    email: email.toLowerCase(),
    name,
    passwordHash,
    roles: assignedRoles,
    status,
    requestedRole: sanitizedRequestedRole !== 'viewer' ? sanitizedRequestedRole : undefined,
    applicationNote: sanitizedRequestedRole === 'writer' && applicationNote ? applicationNote.slice(0, 2000) : undefined,
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

  // Check if user account is approved
  if (user.status === 'pending') {
    res.status(403).json({ 
      message: t('accountPendingApproval', req),
      code: 'PENDING_APPROVAL'
    })
    return
  }

  if (user.status === 'rejected') {
    res.status(403).json({ 
      message: t('accountRejected', req),
      code: 'ACCOUNT_REJECTED',
      adminNote: user.adminNote
    })
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
