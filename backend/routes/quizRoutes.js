import { Router } from 'express'
import { createQuiz, listQuizzes, myQuizAttempts, submitQuiz } from '../controllers/quizController.js'
import { authenticate, authorize, requireApprovedTeacher } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { idParamSchema, quizSchema, quizSubmitSchema } from '../validation/schemas.js'

const router = Router()

router.post('/', authenticate, authorize('teacher', 'admin'), requireApprovedTeacher, validate(quizSchema), createQuiz)
router.get('/attempts/me', authenticate, authorize('student'), myQuizAttempts)
router.get('/course/:courseId', authenticate, requireApprovedTeacher, validate(idParamSchema('courseId')), listQuizzes)
router.post('/:quizId/submit', authenticate, authorize('student'), validate(quizSubmitSchema), submitQuiz)

export default router
