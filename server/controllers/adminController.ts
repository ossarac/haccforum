import type { Request, Response } from 'express'
import UserModel, { type UserRole, type UserStatus } from '../models/User.js'
import { getSetting, setSetting, SETTINGS_KEYS } from '../models/Settings.js'
import { serializeUser } from '../utils/auth.js'
import { t } from '../i18n/index.js'

interface UserListItem {
  id: string
  email: string
  name: string
  roles: UserRole[]
  status: UserStatus
  requestedRole?: UserRole
  applicationNote?: string
  adminNote?: string
  emailVerified: boolean
  createdAt: string
  updatedAt: string
}

function formatUser(user: any): UserListItem {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    roles: user.roles,
    status: user.status,
    requestedRole: user.requestedRole,
    applicationNote: user.applicationNote,
    adminNote: user.adminNote,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt?.toISOString(),
    updatedAt: user.updatedAt?.toISOString()
  }
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.query

    const filter: Record<string, any> = {}
    if (status && ['pending', 'approved', 'rejected'].includes(status as string)) {
      filter.status = status
    }

    const users = await UserModel.find(filter)
      .sort({ createdAt: -1 })
      .lean()

    res.json(users.map(formatUser))
  } catch (error) {
    console.error('[admin] listUsers error', error)
    res.status(500).json({ message: t('serverError', req) })
  }
}

export async function getPendingUsers(req: Request, res: Response): Promise<void> {
  try {
    const users = await UserModel.find({ status: 'pending' })
      .sort({ createdAt: 1 }) // Oldest first for queue-style processing
      .lean()

    res.json(users.map(formatUser))
  } catch (error) {
    console.error('[admin] getPendingUsers error', error)
    res.status(500).json({ message: t('serverError', req) })
  }
}

export async function approveUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { roles, adminNote } = req.body ?? {}

    const user = await UserModel.findById(id)
    if (!user) {
      res.status(404).json({ message: t('userNotFound', req) })
      return
    }

    if (user.status === 'approved') {
      res.status(400).json({ message: t('userAlreadyApproved', req) })
      return
    }

    // Determine which roles to assign
    let assignedRoles: UserRole[] = ['viewer']
    if (Array.isArray(roles) && roles.length > 0) {
      // Admin explicitly specifying roles
      const validRoles = roles.filter((r: string): r is UserRole => 
        ['writer', 'viewer'].includes(r)
      )
      if (validRoles.includes('writer')) {
        assignedRoles = ['writer', 'viewer']
      }
    } else if (user.requestedRole === 'writer') {
      // Grant the requested role
      assignedRoles = ['writer', 'viewer']
    }

    user.status = 'approved'
    user.roles = assignedRoles
    if (adminNote) {
      user.adminNote = adminNote.slice(0, 1000)
    }
    await user.save()

    res.json({ 
      message: t('userApproved', req),
      user: formatUser(user)
    })
  } catch (error) {
    console.error('[admin] approveUser error', error)
    res.status(500).json({ message: t('serverError', req) })
  }
}

export async function rejectUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { adminNote } = req.body ?? {}

    const user = await UserModel.findById(id)
    if (!user) {
      res.status(404).json({ message: t('userNotFound', req) })
      return
    }

    if (user.status === 'rejected') {
      res.status(400).json({ message: t('userAlreadyRejected', req) })
      return
    }

    user.status = 'rejected'
    if (adminNote) {
      user.adminNote = adminNote.slice(0, 1000)
    }
    await user.save()

    res.json({ 
      message: t('userRejected', req),
      user: formatUser(user)
    })
  } catch (error) {
    console.error('[admin] rejectUser error', error)
    res.status(500).json({ message: t('serverError', req) })
  }
}

export async function updateUserRole(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { roles } = req.body ?? {}

    if (!Array.isArray(roles)) {
      res.status(400).json({ message: t('rolesRequired', req) })
      return
    }

    const user = await UserModel.findById(id)
    if (!user) {
      res.status(404).json({ message: t('userNotFound', req) })
      return
    }

    // Cannot demote self if admin
    if (user._id.toString() === req.user?.id && user.roles.includes('admin')) {
      res.status(400).json({ message: t('cannotDemoteSelf', req) })
      return
    }

    // Validate roles - admin cannot be assigned through this endpoint
    const validRoles: UserRole[] = roles.filter((r: string): r is UserRole => 
      ['writer', 'viewer'].includes(r)
    )
    
    // Preserve admin role if user already has it
    if (user.roles.includes('admin')) {
      if (!validRoles.includes('admin' as any)) {
        validRoles.unshift('admin' as UserRole)
      }
    }

    // Ensure at least viewer role
    if (!validRoles.includes('viewer')) {
      validRoles.push('viewer')
    }

    user.roles = validRoles
    await user.save()

    res.json({ 
      message: t('userRoleUpdated', req),
      user: formatUser(user)
    })
  } catch (error) {
    console.error('[admin] updateUserRole error', error)
    res.status(500).json({ message: t('serverError', req) })
  }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    const user = await UserModel.findById(id)
    if (!user) {
      res.status(404).json({ message: t('userNotFound', req) })
      return
    }

    // Cannot delete self
    if (user._id.toString() === req.user?.id) {
      res.status(400).json({ message: t('cannotDeleteSelf', req) })
      return
    }

    // Cannot delete other admins
    if (user.roles.includes('admin')) {
      res.status(400).json({ message: t('cannotDeleteAdmin', req) })
      return
    }

    await UserModel.findByIdAndDelete(id)

    res.json({ message: t('userDeleted', req) })
  } catch (error) {
    console.error('[admin] deleteUser error', error)
    res.status(500).json({ message: t('serverError', req) })
  }
}

// Settings management
export async function getSettings(req: Request, res: Response): Promise<void> {
  try {
    const guestAccessEnabled = await getSetting(SETTINGS_KEYS.GUEST_ACCESS_ENABLED, true)
    const requireEmailVerification = await getSetting(SETTINGS_KEYS.REQUIRE_EMAIL_VERIFICATION, false)

    res.json({
      guestAccessEnabled,
      requireEmailVerification
    })
  } catch (error) {
    console.error('[admin] getSettings error', error)
    res.status(500).json({ message: t('serverError', req) })
  }
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  try {
    const { guestAccessEnabled, requireEmailVerification } = req.body ?? {}

    if (typeof guestAccessEnabled === 'boolean') {
      await setSetting(SETTINGS_KEYS.GUEST_ACCESS_ENABLED, guestAccessEnabled)
    }

    if (typeof requireEmailVerification === 'boolean') {
      await setSetting(SETTINGS_KEYS.REQUIRE_EMAIL_VERIFICATION, requireEmailVerification)
    }

    // Return updated settings
    const settings = {
      guestAccessEnabled: await getSetting(SETTINGS_KEYS.GUEST_ACCESS_ENABLED, true),
      requireEmailVerification: await getSetting(SETTINGS_KEYS.REQUIRE_EMAIL_VERIFICATION, false)
    }

    res.json(settings)
  } catch (error) {
    console.error('[admin] updateSettings error', error)
    res.status(500).json({ message: t('serverError', req) })
  }
}

// Public endpoint to get guest access setting (for frontend)
export async function getPublicSettings(req: Request, res: Response): Promise<void> {
  try {
    const guestAccessEnabled = await getSetting(SETTINGS_KEYS.GUEST_ACCESS_ENABLED, true)

    res.json({
      guestAccessEnabled
    })
  } catch (error) {
    console.error('[admin] getPublicSettings error', error)
    res.status(500).json({ message: t('serverError', req) })
  }
}
