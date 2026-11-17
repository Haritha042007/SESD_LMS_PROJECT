import mongoose from 'mongoose'

const choiceSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 500 },
}, { _id: true })

const questionSchema = new mongoose.Schema({
  type: { type: String, enum: ['mcq', 'multiple_select', 'true_false', 'short_answer'], required: true },
  prompt: { type: String, required: true, trim: true, maxlength: 2000 },
  choices: { type: [choiceSchema], default: [] },
  correctAnswers: [{ type: mongoose.Schema.Types.ObjectId }],
  acceptedAnswers: [{ type: String, trim: true, maxlength: 300 }],
  marks: { type: Number, min: 1, max: 1000, required: true },
}, { timestamps: false })

const examSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  instructions: { type: String, trim: true, maxlength: 5000, default: '' },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  durationMinutes: { type: Number, min: 1, max: 360, required: true },
  totalMarks: { type: Number, min: 1, max: 10000, required: true },
  passingMarks: { type: Number, min: 0, max: 10000, required: true },
  randomizeQuestions: { type: Boolean, default: true },
  randomizeChoices: { type: Boolean, default: true },
  published: { type: Boolean, default: false, index: true },
  questions: { type: [questionSchema], validate: (questions) => questions.length >= 1 && questions.length <= 100 },
}, { timestamps: true })

examSchema.pre('validate', function validateExamMarks() {
  const sum = this.questions.reduce((total, question) => total + question.marks, 0)
  if (sum !== this.totalMarks) this.invalidate('totalMarks', 'Total marks must equal the sum of question marks.')
  if (this.passingMarks > this.totalMarks) this.invalidate('passingMarks', 'Passing marks cannot exceed total marks.')
  for (const question of this.questions) {
    if (['mcq', 'multiple_select', 'true_false'].includes(question.type)) {
      if (question.choices.length < 2) this.invalidate('questions', 'Objective questions need at least two choices.')
      if (!question.correctAnswers.length) this.invalidate('questions', 'Objective questions need at least one correct answer.')
      if (question.type !== 'multiple_select' && question.correctAnswers.length !== 1) {
        this.invalidate('questions', 'Single-choice and true/false questions require exactly one correct answer.')
      }
      if (question.correctAnswers.some((answer) => !question.choices.some((choice) => choice._id.equals(answer)))) {
        this.invalidate('questions', 'Correct answers must reference available choices.')
      }
    } else if (question.choices.length || question.correctAnswers.length) {
      this.invalidate('questions', 'Short-answer questions must not contain objective answer keys.')
    }
  }
})

export const Exam = mongoose.model('Exam', examSchema)
