import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { writeLimiter } from './middleware/rateLimits.js'
import analyticsRoutes from './routes/analyticsRoutes.js'
import assistantRoutes from './routes/assistantRoutes.js'
import examRoutes from './routes/examRoutes.js'
import assignmentRoutes from './routes/assignmentRoutes.js'
import authRoutes from './routes/authRoutes.js'
import certificateRoutes from './routes/certificateRoutes.js'
import codingRoutes from './routes/codingRoutes.js'
import courseRoutes from './routes/courseRoutes.js'
import leaderboardRoutes from './routes/leaderboardRoutes.js'
import progressRoutes from './routes/progressRoutes.js'
import quizRoutes from './routes/quizRoutes.js'
import userRoutes from './routes/userRoutes.js'

export const app = express()

const allowedOrigins = env.CORS_ORIGIN.split(',').map((item) => item.trim()).filter(Boolean)
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    return callback(null, false)
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: false, limit: '1mb' }))
app.use('/api', writeLimiter)

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'learnly-api' }))
app.use('/api/auth', authRoutes)
app.use('/api/courses', courseRoutes)
app.use('/api/users', userRoutes)
app.use('/api/progress', progressRoutes)
app.use('/api/quizzes', quizRoutes)
app.use('/api/assignments', assignmentRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/assistant', assistantRoutes)
app.use('/api/exams', examRoutes)
app.use('/api/certificates', certificateRoutes)
app.use('/api/coding', codingRoutes)
app.use('/api/leaderboard', leaderboardRoutes)
app.use(notFound)
app.use(errorHandler)
