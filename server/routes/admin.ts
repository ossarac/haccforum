import { Router } from 'express'
import {
  listUsers,
  getPendingUsers,
  approveUser,
  rejectUser,
  updateUserRole,
  deleteUser,
  getSettings,
  updateSettings,
  getPublicSettings
} from '../controllers/adminController.js'
import { authenticate, requireAnyRole } from '../middleware/auth.js'

const router = Router()

// Public endpoint for settings that affect guest access
router.get('/settings/public', getPublicSettings)

// All other routes require admin
router.use(authenticate)
router.use(requireAnyRole('admin'))

// User management
router.get('/users', listUsers)
router.get('/users/pending', getPendingUsers)
router.patch('/users/:id/approve', approveUser)
router.patch('/users/:id/reject', rejectUser)
router.patch('/users/:id/role', updateUserRole)
router.delete('/users/:id', deleteUser)

// Settings management
router.get('/settings', getSettings)
router.patch('/settings', updateSettings)

export default router
