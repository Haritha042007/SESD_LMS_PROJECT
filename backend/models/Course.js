import mongoose from 'mongoose'

const resourceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  url: { type: String, required: true, trim: true, maxlength: 2048 },
  type: { type: String, enum: ['video', 'document', 'link', 'file'], default: 'link' },
}, { _id: true })

const lessonSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  videoUrl: { type: String, trim: true, maxlength: 2048, default: '' },
  durationMinutes: { type: Number, min: 0, default: 0 },
  topic: { type: String, trim: true, maxlength: 100, default: 'General' },
  resources: { type: [resourceSchema], default: [] },
}, { timestamps: true })

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  category: { type: String, required: true, trim: true, maxlength: 80, index: true },
  level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  lessons: { type: [lessonSchema], default: [] },
  studyNotes: { type: String, trim: true, maxlength: 50000, default: '' },
  enrollmentCount: { type: Number, min: 0, default: 0 },
  objectives: { type: [String], default: [] },
}, { timestamps: true })

courseSchema.index({ title: 'text', description: 'text', category: 'text' })

export const Course = mongoose.model('Course', courseSchema)
