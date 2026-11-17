import { Router } from 'express'
import {
  adminExamReports, createExam, deleteExam, gradeExamAttempt, listExams,
  listTeacherAttempts, startExam, studentExamHistory, submitExam, updateExam,
} from '../controllers/examController.js'
import { authenticate, authorize, requireApprovedTeacher } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  examGradeSchema, examListSchema, examParamSchema, examSchema, examSubmitSchema, examUpdateSchema,
} from '../validation/schemas.js'

const router = Router()
router.use(authenticate)
router.post('/', authorize('teacher', 'admin'), requireApprovedTeacher, validate(examSchema), createExam)
router.get('/attempts/me', authorize('student'), studentExamHistory)
router.get('/admin/reports', authorize('admin'), adminExamReports)
router.get('/:examId/attempts', authorize('teacher', 'admin'), requireApprovedTeacher, validate(examParamSchema), listTeacherAttempts)
router.patch('/attempts/:attemptId/grade', authorize('teacher', 'admin'), requireApprovedTeacher, validate(examGradeSchema), gradeExamAttempt)
router.post('/:examId/start', authorize('student'), validate(examParamSchema), startExam)
router.post('/attempts/:attemptId/submit', authorize('student'), validate(examSubmitSchema), submitExam)
router.get('/', validate(examListSchema), listExams)
router.patch('/:examId', authorize('teacher', 'admin'), requireApprovedTeacher, validate(examUpdateSchema), updateExam)
router.delete('/:examId', authorize('teacher', 'admin'), requireApprovedTeacher, validate(examParamSchema), deleteExam)
export default router
