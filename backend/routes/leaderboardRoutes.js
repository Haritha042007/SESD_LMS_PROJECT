import { Router } from 'express'
import { leaderboard } from '../controllers/learningController.js'

const router = Router()
router.get('/', leaderboard)
export default router
