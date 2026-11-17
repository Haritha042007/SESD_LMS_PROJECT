import { Assignment } from '../models/Assignment.js'
import { Enrollment } from '../models/Enrollment.js'
import { Quiz } from '../models/Quiz.js'
import { QuizAttempt } from '../models/QuizAttempt.js'
import { Course } from '../models/Course.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { awardStudyXp } from '../services/gamificationService.js'
import { paginationFrom, pageInfo } from '../utils/pagination.js'

export function scoreQuiz(questions, answers) {
  if (answers.length !== questions.length) throw new HttpError(400, 'Submit exactly one answer for each quiz question.')
  for (let index = 0; index < answers.length; index += 1) {
    if (answers[index] < 0 || answers[index] >= questions[index].choices.length) {
      throw new HttpError(400, `Answer ${index + 1} is not a valid choice.`)
    }
  }
  const correctCount = questions.reduce((total, question, index) => total + (answers[index] === question.correctAnswer ? 1 : 0), 0)
  return {
    correctCount,
    score: Math.round(correctCount / questions.length * 100),
    topicResults: questions.map((question, index) => ({ topic: question.topic, correct: answers[index] === question.correctAnswer })),
  }
}

export const createQuiz = asyncHandler(async (req, res) => {
  const { courseId, ...data } = req.validated.body
  const course = await Course.findById(courseId)
  if (!course) throw new HttpError(404, 'Course not found.')
  if (req.user.role !== 'admin' && String(course.teacher) !== req.user.id) {
    throw new HttpError(403, 'You can only create quizzes for courses you own.')
  }
  const quiz = await Quiz.create({ ...data, course: course.id, teacher: course.teacher })
  res.status(201).json({ data: quiz })
})

export const listQuizzes = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId)
  if (!course) throw new HttpError(404, 'Course not found.')
  if (req.user.role === 'student') {
    const enrolled = await Enrollment.exists({ student: req.user.id, course: course.id })
    if (!enrolled) throw new HttpError(403, 'Enroll in this course to access its quizzes.')
  } else if (req.user.role !== 'admin' && String(course.teacher) !== req.user.id) {
    throw new HttpError(403, 'You can only view quizzes for courses you own.')
  }
  const filter = { course: course.id }
  if (req.user.role === 'student') filter.published = true
  const quizzes = await Quiz.find(filter).sort({ createdAt: -1 })
  const data = quizzes.map((quiz) => {
    const item = quiz.toObject()
    if (req.user.role === 'student') {
      item.questions = item.questions.map(({ _id, prompt, topic, choices }) => ({ _id, prompt, topic, choices }))
    }
    return item
  })
  res.json({ data })
})

export const submitQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOne({ _id: req.params.quizId, published: true })
  if (!quiz) throw new HttpError(404, 'Published quiz not found.')
  const enrolled = await Enrollment.exists({ student: req.user.id, course: quiz.course })
  if (!enrolled) throw new HttpError(403, 'Enroll in this course before taking its quizzes.')
  const { answers } = req.validated.body
  const { correctCount, score, topicResults } = scoreQuiz(quiz.questions, answers)
  const attempt = await QuizAttempt.create({
    quiz: quiz.id,
    student: req.user.id,
    answers,
    score,
    correctCount,
    totalQuestions: quiz.questions.length,
    topicResults,
  })
  const previousPass = score >= quiz.passingScore
    ? await QuizAttempt.exists({ quiz: quiz.id, student: req.user.id, score: { $gte: quiz.passingScore } })
    : false
  const rewards = score >= quiz.passingScore && !previousPass ? await awardStudyXp(req.user.id, 25) : null
  res.status(201).json({
    data: {
      attempt,
      passed: score >= quiz.passingScore,
      passingScore: quiz.passingScore,
      rewards,
      feedback: score >= quiz.passingScore ? 'Great work — you passed this quiz.' : 'Review the missed topics and try again.',
    },
  })
})

export const myQuizAttempts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req.query)
  const [attempts, total] = await Promise.all([
    QuizAttempt.find({ student: req.user.id }).populate('quiz', 'title course').sort({ createdAt: -1 }).skip(skip).limit(limit),
    QuizAttempt.countDocuments({ student: req.user.id }),
  ])
  res.json({ data: attempts, pagination: pageInfo(page, limit, total) })
})
