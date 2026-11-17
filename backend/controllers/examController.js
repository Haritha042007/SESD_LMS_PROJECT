import mongoose from 'mongoose'
import { Exam } from '../models/Exam.js'
import { ExamAttempt } from '../models/ExamAttempt.js'
import { Enrollment } from '../models/Enrollment.js'
import { Course } from '../models/Course.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'

const objectiveTypes = new Set(['mcq', 'multiple_select', 'true_false'])

function shuffle(items) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

export function scoreObjectiveQuestion(question, selectedChoices) {
  const expected = question.correctAnswers.map(String).sort()
  const actual = [...new Set(selectedChoices.map(String))].sort()
  if (expected.length !== actual.length || expected.some((id, index) => id !== actual[index])) return 0
  return question.marks
}

function studentQuestion(question, choiceOrder) {
  return {
    id: String(question._id),
    type: question.type,
    prompt: question.prompt,
    marks: question.marks,
    choices: choiceOrder.map((id) => question.choices.find((choice) => String(choice._id) === String(id)))
      .filter(Boolean)
      .map((choice) => ({ id: String(choice._id), text: choice.text })),
  }
}

function examSummary(exam) {
  return {
    id: exam.id,
    title: exam.title,
    instructions: exam.instructions,
    course: exam.course,
    durationMinutes: exam.durationMinutes,
    totalMarks: exam.totalMarks,
    passingMarks: exam.passingMarks,
    questionCount: exam.questions.length,
    published: exam.published,
  }
}

function storedQuestions(questions) {
  return questions.map((question) => {
    const choices = question.choices.map((choice) => ({ _id: new mongoose.Types.ObjectId(), text: choice.text }))
    const correctAnswers = question.correctAnswerIndices.map((index) => choices[index]._id)
    const { correctAnswerIndices, ...details } = question
    return { ...details, choices, correctAnswers }
  })
}

export const createExam = asyncHandler(async (req, res) => {
  const { courseId, ...data } = req.validated.body
  const course = await Course.findById(courseId)
  if (!course) throw new HttpError(404, 'Course not found.')
  if (req.user.role !== 'admin' && String(course.teacher) !== req.user.id) {
    throw new HttpError(403, 'You can only create exams for courses you own.')
  }
  const exam = await Exam.create({ ...data, questions: storedQuestions(data.questions), course: course.id, teacher: course.teacher })
  res.status(201).json({ data: examSummary(exam) })
})

export const listExams = asyncHandler(async (req, res) => {
  const courseIds = req.user.role === 'student'
    ? await Enrollment.find({ student: req.user.id }).distinct('course')
    : req.user.role === 'teacher'
      ? await Course.find({ teacher: req.user.id }).distinct('_id')
      : null
  const filter = req.user.role === 'admin'
    ? {}
    : { course: { $in: courseIds || [] } }
  if (req.user.role === 'student') filter.published = true
  if (req.validated.query.courseId) {
    if (courseIds && !courseIds.some((id) => id.equals(req.validated.query.courseId))) {
      throw new HttpError(403, 'You do not have access to exams for this course.')
    }
    filter.course = req.validated.query.courseId
  }
  if (req.user.role === 'teacher' && req.validated.query.status) filter.published = req.validated.query.status === 'published'
  const exams = await Exam.find(filter).populate('course', 'title').sort({ updatedAt: -1 })
  if (req.user.role !== 'student') {
    return res.json({ data: exams.map((exam) => ({ ...exam.toObject(), id: String(exam._id) })) })
  }
  const attempts = await ExamAttempt.find({ student: req.user.id, exam: { $in: exams.map((exam) => exam.id) } })
    .select('exam status awardedMarks pendingMarks totalMarks expiresAt startedAt')
  const byExam = new Map(attempts.map((attempt) => [String(attempt.exam), attempt]))
  res.json({ data: exams.map((exam) => ({ ...examSummary(exam), course: exam.course, attempt: byExam.get(exam.id) || null })) })
})

export const updateExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.examId)
  if (!exam) throw new HttpError(404, 'Exam not found.')
  if (req.user.role !== 'admin' && String(exam.teacher) !== req.user.id) {
    throw new HttpError(403, 'You can only manage exams for courses you own.')
  }
  if (await ExamAttempt.exists({ exam: exam.id }) && req.validated.body.questions) {
    throw new HttpError(409, 'Questions cannot be changed after a student has started this exam.')
  }
  const updates = { ...req.validated.body }
  if (updates.questions) updates.questions = storedQuestions(updates.questions)
  Object.assign(exam, updates)
  await exam.save()
  res.json({ data: exam })
})

export const deleteExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.examId)
  if (!exam) throw new HttpError(404, 'Exam not found.')
  if (req.user.role !== 'admin' && String(exam.teacher) !== req.user.id) {
    throw new HttpError(403, 'You can only delete exams for courses you own.')
  }
  if (await ExamAttempt.exists({ exam: exam.id })) throw new HttpError(409, 'An exam with student attempts cannot be deleted.')
  await exam.deleteOne()
  res.json({ data: { message: 'Exam deleted.' } })
})

export const startExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findOne({ _id: req.params.examId, published: true })
  if (!exam) throw new HttpError(404, 'Published exam not found.')
  const enrolled = await Enrollment.exists({ student: req.user.id, course: exam.course })
  if (!enrolled) throw new HttpError(403, 'Enroll in this course before starting its exam.')

  const existing = await ExamAttempt.findOne({ exam: exam.id, student: req.user.id })
  if (existing) {
    if (existing.status !== 'in_progress') throw new HttpError(409, 'You have already submitted this exam.')
    const questions = existing.questionOrder.map((id) => exam.questions.find((question) => question._id.equals(id))).filter(Boolean)
    return res.json({ data: { attemptId: existing.id, startedAt: existing.startedAt, expiresAt: existing.expiresAt, exam: examSummary(exam), questions: questions.map((question) => studentQuestion(question, existing.choiceOrders.find((item) => item.question.equals(question._id))?.choices || question.choices.map((choice) => choice._id))) } })
  }

  const questionOrder = exam.randomizeQuestions ? shuffle(exam.questions.map((question) => question._id)) : exam.questions.map((question) => question._id)
  const choiceOrders = exam.questions.map((question) => ({
    question: question._id,
    choices: exam.randomizeChoices && objectiveTypes.has(question.type) ? shuffle(question.choices.map((choice) => choice._id)) : question.choices.map((choice) => choice._id),
  }))
  const startedAt = new Date()
  let attempt
  try {
    attempt = await ExamAttempt.create({
      exam: exam.id,
      student: req.user.id,
      startedAt,
      expiresAt: new Date(startedAt.getTime() + exam.durationMinutes * 60_000),
      questionOrder,
      choiceOrders,
      totalMarks: exam.totalMarks,
    })
  } catch (error) {
    if (error?.code !== 11000) throw error
    throw new HttpError(409, 'An exam attempt already exists. Refresh the exam list.')
  }
  const orderedQuestions = questionOrder.map((id) => exam.questions.find((question) => question._id.equals(id))).filter(Boolean)
  res.status(201).json({
    data: {
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      exam: examSummary(exam),
      questions: orderedQuestions.map((question) => studentQuestion(question, choiceOrders.find((item) => item.question.equals(question._id)).choices)),
    },
  })
})

export const submitExam = asyncHandler(async (req, res) => {
  const attempt = await ExamAttempt.findOne({ _id: req.params.attemptId, student: req.user.id })
  if (!attempt) throw new HttpError(404, 'Exam attempt not found.')
  if (attempt.status !== 'in_progress') throw new HttpError(409, 'This exam attempt has already been submitted.')
  const exam = await Exam.findById(attempt.exam)
  if (!exam) throw new HttpError(404, 'Exam not found.')
  const now = new Date()
  const timedOut = now >= attempt.expiresAt
  const submittedAnswers = req.validated.body.answers
  const answerByQuestion = new Map(submittedAnswers.map((answer) => [answer.questionId, answer]))
  if (answerByQuestion.size !== submittedAnswers.length) {
    throw new HttpError(400, 'A question can only be answered once per submission.')
  }
  const examQuestionIds = new Set(attempt.questionOrder.map(String))
  if ([...answerByQuestion.keys()].some((id) => !examQuestionIds.has(id))) {
    throw new HttpError(400, 'Answers contain a question that is not part of this exam.')
  }
  if (timedOut) answerByQuestion.clear()

  let objectiveMarks = 0
  let pendingMarks = 0
  const responses = exam.questions.map((question) => {
    const answer = answerByQuestion.get(String(question._id))
    if (question.type === 'short_answer') {
      if (answer?.selectedChoices.length) throw new HttpError(400, 'Short-answer questions do not accept selected choices.')
      pendingMarks += question.marks
      return { question: question._id, text: answer?.text || '', marksAwarded: null }
    }
    if (answer?.text) throw new HttpError(400, 'Objective questions do not accept text answers.')
    const selectedChoices = answer?.selectedChoices || []
    if (new Set(selectedChoices).size !== selectedChoices.length) throw new HttpError(400, 'An answer cannot select the same choice more than once.')
    if (selectedChoices.some((id) => !question.choices.some((choice) => String(choice._id) === id))) {
      throw new HttpError(400, 'An answer contains an invalid choice.')
    }
    const marksAwarded = scoreObjectiveQuestion(question, selectedChoices)
    objectiveMarks += marksAwarded
    return { question: question._id, selectedChoices, marksAwarded }
  })
  const status = pendingMarks ? 'submitted' : 'graded'
  const saved = await ExamAttempt.findOneAndUpdate(
    { _id: attempt.id, student: req.user.id, status: 'in_progress' },
    {
      $set: {
        status,
        responses,
        objectiveMarks,
        awardedMarks: objectiveMarks,
        pendingMarks,
        submittedAt: now,
        timedOut,
      },
    },
    { new: true, runValidators: true },
  )
  if (!saved) throw new HttpError(409, 'This exam attempt has already been submitted.')
  res.status(201).json({ data: { attempt: saved, result: { status, objectiveMarks, pendingMarks, awardedMarks: objectiveMarks, totalMarks: exam.totalMarks, passingMarks: exam.passingMarks, passed: status === 'graded' && objectiveMarks >= exam.passingMarks, timedOut } } })
})

export const studentExamHistory = asyncHandler(async (req, res) => {
  const attempts = await ExamAttempt.find({ student: req.user.id }).populate('exam', 'title course passingMarks').sort({ startedAt: -1 })
  res.json({ data: attempts })
})

export const listTeacherAttempts = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.examId).populate('course', 'title')
  if (!exam) throw new HttpError(404, 'Exam not found.')
  if (req.user.role !== 'admin' && String(exam.teacher) !== req.user.id) {
    throw new HttpError(403, 'You can only review attempts for exams you created.')
  }
  const attempts = await ExamAttempt.find({ exam: exam.id }).populate('student', 'name email').sort({ submittedAt: -1, startedAt: -1 })
  res.json({ data: { exam: { id: exam.id, title: exam.title, totalMarks: exam.totalMarks, passingMarks: exam.passingMarks, questions: exam.questions.map((question) => ({ id: question.id, prompt: question.prompt, type: question.type, marks: question.marks })) }, attempts } })
})

export const gradeExamAttempt = asyncHandler(async (req, res) => {
  const attempt = await ExamAttempt.findById(req.params.attemptId).populate('exam')
  if (!attempt) throw new HttpError(404, 'Exam attempt not found.')
  if (req.user.role !== 'admin' && String(attempt.exam.teacher) !== req.user.id) {
    throw new HttpError(403, 'You can only grade attempts for exams you created.')
  }
  if (attempt.status === 'in_progress') throw new HttpError(409, 'The student has not submitted this exam.')
  const marksByQuestion = new Map(req.validated.body.grades.map((grade) => [grade.questionId, grade]))
  const shortQuestions = attempt.exam.questions.filter((question) => question.type === 'short_answer')
  if (marksByQuestion.size !== shortQuestions.length || shortQuestions.some((question) => !marksByQuestion.has(String(question._id)))) {
    throw new HttpError(400, 'Provide a mark and feedback for every short-answer question.')
  }
  const responses = attempt.responses.map((response) => {
    const grade = marksByQuestion.get(String(response.question))
    if (!grade) return response
    const question = shortQuestions.find((item) => item._id.equals(response.question))
    if (grade.marksAwarded > question.marks) throw new HttpError(400, `Marks cannot exceed ${question.marks} for a question.`)
    response.marksAwarded = grade.marksAwarded
    response.feedback = grade.feedback
    return response
  })
  const totalAwarded = responses.reduce((sum, response) => sum + (response.marksAwarded || 0), 0)
  const graded = await ExamAttempt.findOneAndUpdate(
    { _id: attempt.id, status: { $in: ['submitted', 'graded'] } },
    { $set: { status: 'graded', responses, awardedMarks: totalAwarded, pendingMarks: 0, feedback: req.validated.body.feedback || '' } },
    { new: true, runValidators: true },
  )
  if (!graded) throw new HttpError(409, 'This exam attempt can no longer be graded.')
  res.json({ data: { attempt: graded, passed: totalAwarded >= attempt.exam.passingMarks } })
})

export const adminExamReports = asyncHandler(async (_req, res) => {
  const [examCount, attempts, recent] = await Promise.all([
    Exam.countDocuments(),
    ExamAttempt.aggregate([
      { $group: { _id: null, total: { $sum: 1 }, submitted: { $sum: { $cond: [{ $ne: ['$status', 'in_progress'] }, 1, 0] } }, graded: { $sum: { $cond: [{ $eq: ['$status', 'graded'] }, 1, 0] } }, averageMarks: { $avg: '$awardedMarks' } } },
    ]),
    ExamAttempt.find().populate('exam', 'title').populate('student', 'name email').sort({ createdAt: -1 }).limit(50),
  ])
  res.json({ data: { examCount, ...(attempts[0] || { total: 0, submitted: 0, graded: 0, averageMarks: 0 }), recent } })
})
