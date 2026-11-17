import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student', required: true },
  status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  approvalStatus: { type: String, enum: ['not_required', 'pending', 'approved', 'rejected'], default: 'not_required' },
  bio: { type: String, trim: true, maxlength: 1000, default: '' },
  avatarUrl: { type: String, trim: true, maxlength: 500, default: '' },
  interests: { type: [String], default: [] },
  xp: { type: Number, min: 0, default: 0 },
  streakDays: { type: Number, min: 0, default: 0 },
  badges: { type: [String], default: [] },
  lastStudyDate: { type: Date, default: null },
  tokenVersion: { type: Number, default: 0, select: false },
}, { timestamps: true, toJSON: { transform(_doc, ret) { delete ret.passwordHash; delete ret.tokenVersion; return ret } } })

userSchema.index({ role: 1, status: 1 })
userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash)
}
userSchema.statics.hashPassword = (password) => bcrypt.hash(password, 12)

export const User = mongoose.model('User', userSchema)
