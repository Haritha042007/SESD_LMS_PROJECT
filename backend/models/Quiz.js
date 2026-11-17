import mongoose from 'mongoose'

const questionSchema = new mongoose.Schema({
  prompt: { type: String, required: true, trim: true, maxlength: 1000 },
  topic: { type: String, trim: true, maxlength: 100, default: 'General' },
  choices: {
    type: [{ type: String, trim: true, maxlength: 300 }],
    validate: { validator: (items) => items.length >= 2 && items.length <= 6, message: 'Questions require 2–6 choices.' },
  },
  correctAnswer: { type: Number, required: true, min: 0 },
  explanation: { type: String, trim: true, maxlength: 1000, default: '' },
})

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  questions: { type: [questionSchema], validate: { validator: (items) => items.length > 0, message: 'A quiz requires at least one question.' } },
  passingScore: { type: Number, min: 1, max: 100, default: 70 },
  published: { type: Boolean, default: false },
}, { timestamps: true })

quizSchema.pre('validate', function validateCorrectChoices() {
  for (const question of this.questions) {
    if (question.correctAnswer >= question.choices.length) {
      this.invalidate('questions', 'Correct answer must reference an available choice.')
    }
  }
})

export const Quiz = mongoose.model('Quiz', quizSchema)
