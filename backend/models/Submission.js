import mongoose from 'mongoose'

const submissionSchema = new mongoose.Schema({
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, trim: true, maxlength: 10000, default: '' },
  fileUrl: { type: String, trim: true, maxlength: 2048, default: '' },
  status: { type: String, enum: ['submitted', 'graded'], default: 'submitted' },
  score: { type: Number, min: 0, max: 1000, default: null },
  feedback: { type: String, trim: true, maxlength: 5000, default: '' },
  gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  gradedAt: { type: Date, default: null },
}, { timestamps: true })

submissionSchema.index({ assignment: 1, student: 1 }, { unique: true })
export const Submission = mongoose.model('Submission', submissionSchema)
