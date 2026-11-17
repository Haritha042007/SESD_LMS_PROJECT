import { Router } from 'express'
import { login, logout, me, register, updateProfile } from '../controllers/authController.js'
import { authenticate } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimits.js'
import { validate } from '../middleware/validate.js'
import { loginSchema, registerSchema, updateProfileSchema } from '../validation/schemas.js'

const router = Router()

router.post('/register', authLimiter, validate(registerSchema), register)
router.post('/login', authLimiter, validate(loginSchema), login)
router.post('/logout', authenticate, logout)
router.get('/me', authenticate, me)
router.patch('/me', authenticate, validate(updateProfileSchema), updateProfile)

export default router
