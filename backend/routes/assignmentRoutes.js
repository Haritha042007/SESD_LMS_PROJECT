import { Router } from 'express'
import { createAssignment, gradeSubmission, listAssignments, listSubmissions, submitAssignment } from '../controllers/assignmentController.js'
import { authenticate, authorize, requireApprovedTeacher } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { assignmentSchema, gradeSchema, listSchema, submissionSchema } from '../validation/schemas.js'

const router = Router()

router.use(authenticate)
router.get('/', validate(listSchema), listAssignments)
router.post('/', authorize('teacher', 'admin'), requireApprovedTeacher, validate(assignmentSchema), createAssignment)
router.get('/submissions', authorize('student', 'teacher', 'admin'), validate(listSchema), listSubmissions)
router.post('/:assignmentId/submit', authorize('student'), validate(submissionSchema), submitAssignment)
router.patch('/submissions/:submissionId/grade', authorize('teacher', 'admin'), requireApprovedTeacher, validate(gradeSchema), gradeSubmission)

export default router
