import mongoose from 'mongoose'

const responseSchema = new mongoose.Schema({
  question: { type: mongoose.Schema.Types.ObjectId, required: true },
  selectedChoices: [{ type: mongoose.Schema.Types.ObjectId }],
  text: { type: String, trim: true, maxlength: 5000, default: '' },
  marksAwarded: { type: Number, min: 0, default: null },
  feedback: { type: String, trim: true, maxlength: 2000, default: '' },
}, { _id: false })

const choiceOrderSchema = new mongoose.Schema({
  question: { type: mongoose.Schema.Types.ObjectId, required: true },
  choices: [{ type: mongoose.Schema.Types.ObjectId }],
}, { _id: false })

const examAttemptSchema = new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['in_progress', 'submitted', 'graded'], default: 'in_progress', index: true },
  startedAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date, required: true },
  submittedAt: { type: Date, default: null },
  timedOut: { type: Boolean, default: false },
  questionOrder: [{ type: mongoose.Schema.Types.ObjectId }],
  choiceOrders: { type: [choiceOrderSchema], default: [] },
  responses: { type: [responseSchema], default: [] },
  objectiveMarks: { type: Number, min: 0, default: 0 },
  awardedMarks: { type: Number, min: 0, default: 0 },
  pendingMarks: { type: Number, min: 0, default: 0 },
  totalMarks: { type: Number, min: 1, required: true },
  feedback: { type: String, trim: true, maxlength: 5000, default: '' },
}, { timestamps: true })

examAttemptSchema.index({ exam: 1, student: 1 }, { unique: true })
examAttemptSchema.index({ student: 1, createdAt: -1 })

export const ExamAttempt = mongoose.model('ExamAttempt', examAttemptSchema)
