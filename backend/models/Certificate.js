import mongoose from 'mongoose'

const certificateSchema = new mongoose.Schema({
  certificateId: { type: String, required: true, unique: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  issuedAt: { type: Date, default: Date.now },
}, { timestamps: true })

certificateSchema.index({ student: 1, course: 1 }, { unique: true })
export const Certificate = mongoose.model('Certificate', certificateSchema)
