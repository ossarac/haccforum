import { Router } from 'express'
import { login, me, register, verifyEmail, resendVerification, updateReadingPreferences, updateLanguage } from '../controllers/authController.js'
import { authenticate, optionalAuthenticate } from '../middleware/auth.js'

const router = Router()

router.post('/register', optionalAuthenticate, register)
router.post('/login', login)
router.get('/me', authenticate, me)
router.post('/verify-email', verifyEmail)
router.post('/resend-verification', resendVerification)
router.patch('/reading-preferences', authenticate, updateReadingPreferences)
router.patch('/language', authenticate, updateLanguage)

export default router
