import mongoose from 'mongoose'

const codingSubmissionSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  problem: { type: mongoose.Schema.Types.ObjectId, ref: 'CodingProblem', required: true, index: true },
  language: { type: String, enum: ['python', 'c', 'cpp', 'java'], required: true },
  sourceCode: { type: String, required: true, maxlength: 20000 },
  status: { type: String, enum: ['accepted', 'wrong_answer', 'runtime_error', 'compile_error', 'time_limit', 'error'], required: true },
  passedTests: { type: Number, min: 0, required: true },
  totalTests: { type: Number, min: 0, required: true },
  output: { type: String, maxlength: 10000, default: '' },
}, { timestamps: true })

codingSubmissionSchema.index({ student: 1, problem: 1, status: 1 })
codingSubmissionSchema.index({ createdAt: -1 })

export const CodingSubmission = mongoose.model('CodingSubmission', codingSubmissionSchema)
