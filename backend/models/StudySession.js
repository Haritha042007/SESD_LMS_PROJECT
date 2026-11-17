import mongoose from 'mongoose'

const studySessionSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  durationMinutes: { type: Number, required: true, min: 1, max: 1440 },
  studiedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true })

export const StudySession = mongoose.model('StudySession', studySessionSchema)
