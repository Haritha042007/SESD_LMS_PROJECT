import { Router } from 'express'
import { completeLesson, listStudySessions, myProgress, recordStudySession, recommendations } from '../controllers/learningController.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { progressSchema, studySessionSchema } from '../validation/schemas.js'

const router = Router()

router.use(authenticate, authorize('student'))
router.get('/me', myProgress)
router.post('/study-sessions', validate(studySessionSchema), recordStudySession)
router.get('/study-sessions', listStudySessions)
router.post('/:courseId/lessons/:lessonId/complete', validate(progressSchema), completeLesson)
router.get('/recommendations', recommendations)

export default router
