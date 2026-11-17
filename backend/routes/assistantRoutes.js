import { Router } from 'express'
import {
  createConversation, deleteConversations, getAssistantStatus, getConversation, listAssistantCourses,
  listConversations, sendMessage,
} from '../controllers/assistantController.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  assistantConversationSchema, assistantCourseSchema, assistantListSchema, assistantMessageSchema,
} from '../validation/schemas.js'

const router = Router()
router.use(authenticate, authorize('student'))
router.get('/status', getAssistantStatus)
router.get('/courses', listAssistantCourses)
router.get('/conversations', validate(assistantListSchema), listConversations)
router.post('/conversations', validate(assistantCourseSchema), createConversation)
router.get('/conversations/:conversationId', validate(assistantConversationSchema), getConversation)
router.delete('/conversations', validate(assistantListSchema), deleteConversations)
router.post('/conversations/:conversationId/messages', validate(assistantMessageSchema), sendMessage)

export default router
