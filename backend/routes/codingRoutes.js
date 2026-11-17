import { Router } from 'express'
import {
  adminCodingActivity, codingLeaderboard, codingProgress, createProblem, deleteProblem,
  getProblem, listManagedProblems, listProblems, mySubmissions, runProblem,
  submitSolution, updateProblem,
} from '../controllers/codingController.js'
import { authenticate, authorize, requireApprovedTeacher } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { codeExecutionLimiter } from '../middleware/rateLimits.js'
import {
  codingListSchema, codingProblemParamSchema, codingProblemSchema, codingProblemUpdateSchema,
  codingRunSchema,
} from '../validation/schemas.js'

const router = Router()
router.use(authenticate)
router.get('/leaderboard', codingLeaderboard)
router.get('/admin/activity', authorize('admin'), adminCodingActivity)
router.get('/manage/problems', authorize('teacher', 'admin'), requireApprovedTeacher, validate(codingListSchema), listManagedProblems)
router.post('/problems', authorize('teacher', 'admin'), requireApprovedTeacher, validate(codingProblemSchema), createProblem)
router.get('/problems', authorize('student'), validate(codingListSchema), listProblems)
router.get('/problems/:problemId', validate(codingProblemParamSchema), getProblem)
router.patch('/problems/:problemId', authorize('teacher', 'admin'), requireApprovedTeacher, validate(codingProblemUpdateSchema), updateProblem)
router.delete('/problems/:problemId', authorize('teacher', 'admin'), requireApprovedTeacher, validate(codingProblemParamSchema), deleteProblem)
router.post('/problems/:problemId/run', authorize('student'), codeExecutionLimiter, validate(codingRunSchema), runProblem)
router.post('/problems/:problemId/submit', authorize('student'), codeExecutionLimiter, validate(codingRunSchema), submitSolution)
router.get('/submissions/me', authorize('student'), mySubmissions)
router.get('/progress/me', authorize('student'), codingProgress)
export default router
