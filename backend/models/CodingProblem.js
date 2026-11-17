import mongoose from 'mongoose'

const caseSchema = new mongoose.Schema({
  input: { type: String, maxlength: 2000, default: '' },
  output: { type: String, required: true, maxlength: 2000 },
}, { _id: false })

const starterCodeSchema = new mongoose.Schema({
  python: { type: String, maxlength: 10000, default: '' },
  c: { type: String, maxlength: 10000, default: '' },
  cpp: { type: String, maxlength: 10000, default: '' },
  java: { type: String, maxlength: 10000, default: '' },
}, { _id: false })

const codingProblemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true, index: true },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  inputDescription: { type: String, trim: true, maxlength: 2000, default: '' },
  outputDescription: { type: String, trim: true, maxlength: 2000, default: '' },
  sampleCases: { type: [caseSchema], validate: (cases) => cases.length >= 1 && cases.length <= 3 },
  testCases: { type: [caseSchema], validate: (cases) => cases.length >= 1 && cases.length <= 5 },
  starterCode: { type: starterCodeSchema, default: () => ({}) },
  published: { type: Boolean, default: false, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
}, { timestamps: true })

codingProblemSchema.index({ published: 1, difficulty: 1, createdAt: -1 })

export const CodingProblem = mongoose.model('CodingProblem', codingProblemSchema)
