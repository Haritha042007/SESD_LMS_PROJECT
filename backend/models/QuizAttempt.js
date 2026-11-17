import mongoose from 'mongoose'

const quizAttemptSchema = new mongoose.Schema({
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  answers: [{ type: Number, min: 0 }],
  score: { type: Number, min: 0, max: 100, required: true },
  correctCount: { type: Number, min: 0, required: true },
  totalQuestions: { type: Number, min: 1, required: true },
  topicResults: [{ topic: String, correct: Boolean }],
}, { timestamps: true })

quizAttemptSchema.index({ student: 1, createdAt: -1 })
export const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema)
