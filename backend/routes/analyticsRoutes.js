import { Router } from 'express'
import { dashboardAnalytics, detailedAnalytics } from '../controllers/analyticsController.js'
import { authenticate, authorize, requireApprovedTeacher } from '../middleware/auth.js'

const router = Router()

router.use(authenticate, authorize('student', 'teacher', 'admin'))
router.get('/dashboard', requireApprovedTeacher, dashboardAnalytics)
router.get('/details', requireApprovedTeacher, detailedAnalytics)

export default router
