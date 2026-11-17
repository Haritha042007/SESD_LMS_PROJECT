import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true, trim: true, maxlength: 4000 },
  topic: { type: String, trim: true, maxlength: 100, default: 'General' },
  mode: { type: String, enum: ['ai', 'demo'], default: undefined },
}, { timestamps: true, _id: true })

const assistantConversationSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  title: { type: String, trim: true, maxlength: 120, default: 'New conversation' },
  messages: { type: [messageSchema], default: [] },
}, { timestamps: true })

assistantConversationSchema.index({ student: 1, course: 1, updatedAt: -1 })

export const AssistantConversation = mongoose.model('AssistantConversation', assistantConversationSchema)
