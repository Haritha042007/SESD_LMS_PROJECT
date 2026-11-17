import mongoose from 'mongoose'

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  instructions: { type: String, required: true, trim: true, maxlength: 5000 },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  dueAt: { type: Date, default: null },
  maxScore: { type: Number, min: 1, max: 1000, default: 100 },
  published: { type: Boolean, default: true },
}, { timestamps: true })

export const Assignment = mongoose.model('Assignment', assignmentSchema)
