import { Router } from 'express'
import { listUsers, pendingTeachers, reviewTeacher, updateUser } from '../controllers/courseController.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { adminUserUpdateSchema, approvalSchema, listSchema } from '../validation/schemas.js'

const router = Router()

router.use(authenticate, authorize('admin'))
router.get('/teachers/pending', validate(listSchema), pendingTeachers)
router.patch('/:userId/approval', validate(approvalSchema), reviewTeacher)
router.patch('/:userId', validate(adminUserUpdateSchema), updateUser)
router.get('/', validate(listSchema), listUsers)

export default router
