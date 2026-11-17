import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { app } from '../app.js'
import { connectDatabase, disconnectDatabase } from '../config/db.js'
import { env } from '../config/env.js'
import { AssistantConversation } from '../models/AssistantConversation.js'
import { Assignment } from '../models/Assignment.js'
import { Category } from '../models/Category.js'
import { Certificate } from '../models/Certificate.js'
import { CodingProblem } from '../models/CodingProblem.js'
import { Course } from '../models/Course.js'
import { Enrollment } from '../models/Enrollment.js'
import { Exam } from '../models/Exam.js'
import { ExamAttempt } from '../models/ExamAttempt.js'
import { Quiz } from '../models/Quiz.js'
import { QuizAttempt } from '../models/QuizAttempt.js'
import { Submission } from '../models/Submission.js'
import { User } from '../models/User.js'

const created = { users: [], categories: [], courses: [], exams: [], attempts: [], quizzes: [], quizAttempts: [], assignments: [], submissions: [], problems: [], conversations: [] }
let connected = false

after(async () => {
  if (!connected) return
  await Promise.all([
    ExamAttempt.deleteMany({ _id: { $in: created.attempts } }),
    Exam.deleteMany({ _id: { $in: created.exams } }),
    QuizAttempt.deleteMany({ _id: { $in: created.quizAttempts } }),
    Quiz.deleteMany({ _id: { $in: created.quizzes } }),
    Assignment.deleteMany({ _id: { $in: created.assignments } }),
    Submission.deleteMany({ _id: { $in: created.submissions } }),
    CodingProblem.deleteMany({ _id: { $in: created.problems } }),
    AssistantConversation.deleteMany({ _id: { $in: created.conversations } }),
    Enrollment.deleteMany({ course: { $in: created.courses } }),
    Course.deleteMany({ _id: { $in: created.courses } }),
    Category.deleteMany({ _id: { $in: created.categories } }),
    User.deleteMany({ _id: { $in: created.users } }),
  ])
  await disconnectDatabase()
})

function accessToken(user) {
  return jwt.sign(
    { version: 0 },
    env.JWT_SECRET,
    { algorithm: 'HS256', subject: String(user._id), expiresIn: '10m', issuer: 'learnly-api', audience: 'learnly-client' },
  )
}

function asUser(agent, user) {
  return agent.set('Authorization', `Bearer ${accessToken(user)}`)
}

test('database workflows integrate authentication, learning, assessments, privacy, and cleanup', async () => {
  await connectDatabase()
  connected = true
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const passwordHash = await User.hashPassword('Integration-Test-Password-123')
  const [teacher, student, otherTeacher, otherStudent, admin] = await Promise.all([
    User.create({ name: 'Integration Teacher', email: `teacher-${suffix}@example.test`, passwordHash, role: 'teacher', approvalStatus: 'approved' }),
    User.create({ name: 'Integration Student', email: `student-${suffix}@example.test`, passwordHash, role: 'student' }),
    User.create({ name: 'Other Teacher', email: `other-${suffix}@example.test`, passwordHash, role: 'teacher', approvalStatus: 'approved' }),
    User.create({ name: 'Other Student', email: `other-student-${suffix}@example.test`, passwordHash, role: 'student' }),
    User.create({ name: 'Integration Admin', email: `admin-${suffix}@example.test`, passwordHash, role: 'admin' }),
  ])
  created.users.push(teacher._id, student._id, otherTeacher._id, otherStudent._id, admin._id)

  const studentLogin = await request(app).post('/api/auth/login')
    .send({ email: student.email, password: 'Integration-Test-Password-123' })
    .expect(200)
  assert.equal(studentLogin.body.data.user._id, String(student._id))
  const studentMe = await request(app).get('/api/auth/me')
    .set('Authorization', `Bearer ${studentLogin.body.data.token}`)
    .expect(200)
  assert.equal(studentMe.body.data.user.role, 'student')

  const categoryResponse = await asUser(request(app).post('/api/courses/admin/categories'), admin)
    .send({ name: `Integration ${suffix}`, description: 'Temporary integration-test category.' })
    .expect(201)
  const category = categoryResponse.body.data
  created.categories.push(category._id)
  const createdCourse = await asUser(request(app).post('/api/courses'), teacher).send({
    title: `Integration Course ${suffix}`,
    description: 'A temporary course used by the database integration test.',
    category: category.name,
    level: 'Beginner',
    status: 'published',
    studyNotes: 'Adding two and two gives four.',
    lessons: [{ title: 'Addition', description: 'Learn basic addition.', topic: 'Arithmetic', durationMinutes: 10 }],
  })
  assert.equal(createdCourse.status, 201, JSON.stringify(createdCourse.body))
  const courseId = createdCourse.body.data._id
  created.courses.push(courseId)
  const course = await Course.findById(courseId)
  assert.ok(course)
  const courseList = await request(app).get('/api/courses').expect(200)
  assert.ok(courseList.body.data.some((item) => item._id === courseId))
  await asUser(request(app).post(`/api/courses/${courseId}/enroll`), student).send({}).expect(201)
  const lessonId = String(course.lessons[0]._id)
  const progress = await asUser(request(app).post(`/api/progress/${courseId}/lessons/${lessonId}/complete`), student).send({}).expect(200)
  assert.equal(progress.body.data.progressPercent, 100)
  assert.ok(await Certificate.exists({ student: student._id, course: course._id }))

  const examCreate = await asUser(request(app).post('/api/exams'), teacher).send({
    title: `Integration Exam ${suffix}`,
    courseId: String(courseId),
    instructions: 'Answer both questions.',
    durationMinutes: 10,
    totalMarks: 3,
    passingMarks: 2,
    randomizeQuestions: true,
    randomizeChoices: true,
    published: false,
    questions: [
      { type: 'mcq', prompt: 'What is 2 + 2?', marks: 1, choices: [{ text: '4' }, { text: '5' }], correctAnswerIndices: [0] },
      { type: 'short_answer', prompt: 'Explain the answer.', marks: 2 },
    ],
  }).expect(201)
  const exam = await Exam.findById(examCreate.body.data.id)
  assert.ok(exam)
  await asUser(request(app).patch(`/api/exams/${exam.id}`), teacher).send({ published: true }).expect(200)
  created.exams.push(exam._id)

  const quizCreated = await asUser(request(app).post('/api/quizzes'), teacher).send({
    title: `Integration Quiz ${suffix}`,
    courseId: String(courseId),
    passingScore: 70,
    published: true,
    questions: [{ prompt: 'What is 2 + 2?', topic: 'Arithmetic', choices: ['4', '5'], correctAnswer: 0, explanation: 'Four is the sum of two and two.' }],
  }).expect(201)
  const quiz = quizCreated.body.data
  created.quizzes.push(quiz._id)

  const publishedExams = await asUser(request(app).get('/api/exams'), student).expect(200)
  assert.equal(publishedExams.body.data.length, 1)
  assert.equal(JSON.stringify(publishedExams.body.data).includes('correctAnswers'), false)

  const quizPayload = await asUser(request(app).get(`/api/quizzes/course/${course.id}`), student).expect(200)
  assert.equal(quizPayload.body.data[0].questions[0].correctAnswer, undefined)
  assert.equal(quizPayload.body.data[0].questions[0].explanation, undefined)
  const quizResult = await asUser(request(app).post(`/api/quizzes/${quiz._id}/submit`), student)
    .send({ answers: [0] })
    .expect(201)
  const quizAttempt = quizResult.body.data.attempt
  created.quizAttempts.push(quizAttempt._id)
  assert.equal(quizAttempt.score, 100)

  const assignmentCreated = await asUser(request(app).post('/api/assignments'), teacher).send({
    title: `Integration Assignment ${suffix}`,
    instructions: 'Submit a short explanation of the arithmetic example.',
    courseId: String(courseId),
    maxScore: 5,
    published: true,
  }).expect(201)
  const assignment = assignmentCreated.body.data
  created.assignments.push(assignment._id)
  const assignmentList = await asUser(request(app).get('/api/assignments'), student).expect(200)
  assert.ok(assignmentList.body.data.some((item) => item.assignment._id === assignment._id))
  const submissionResponse = await asUser(request(app).post(`/api/assignments/${assignment._id}/submit`), student)
    .send({ text: 'Adding two and two gives four.' })
    .expect(201)
  const submission = submissionResponse.body.data.submission
  created.submissions.push(submission._id)
  const studentPrivateSubmissions = await asUser(request(app).get(`/api/assignments/submissions?assignmentId=${assignment._id}`), student).expect(200)
  assert.equal(studentPrivateSubmissions.body.data.length, 1)
  const otherStudentPrivateSubmissions = await asUser(request(app).get(`/api/assignments/submissions?assignmentId=${assignment._id}`), otherStudent).expect(200)
  assert.equal(otherStudentPrivateSubmissions.body.data.length, 0)
  const teacherSubmissions = await asUser(request(app).get(`/api/assignments/submissions?assignmentId=${assignment._id}`), teacher).expect(200)
  assert.equal(teacherSubmissions.body.data.length, 1)
  await asUser(request(app).patch(`/api/assignments/submissions/${submission._id}/grade`), teacher)
    .send({ score: 5, feedback: 'Well done.' })
    .expect(200)

  const conversationResponse = await asUser(request(app).post('/api/assistant/conversations'), student)
    .send({ courseId: String(courseId) })
    .expect(201)
  const conversation = conversationResponse.body.data
  created.conversations.push(conversation._id)
  const previousAiKey = env.AI_API_KEY
  try {
    env.AI_API_KEY = ''
    const messageResponse = await asUser(request(app).post(`/api/assistant/conversations/${conversation._id}/messages`), student)
      .send({ question: 'Explain addition.', topic: 'Arithmetic' })
      .expect(200)
    assert.equal(messageResponse.body.data.mode, 'demo')
    assert.match(messageResponse.body.data.conversation.messages[1].content, /Demo mode/)
    const storedConversation = await asUser(request(app).get(`/api/assistant/conversations/${conversation._id}`), student).expect(200)
    assert.equal(storedConversation.body.data.messages.length, 2)
    await asUser(request(app).get(`/api/assistant/conversations/${conversation._id}`), otherTeacher).expect(403)
  } finally {
    env.AI_API_KEY = previousAiKey
  }

  const codingProblemResponse = await asUser(request(app).post('/api/coding/problems'), teacher).send({
    title: `Integration Coding ${suffix}`,
    difficulty: 'beginner',
    description: 'Read two integers and print their sum.',
    sampleCases: [{ input: '2 3\n', output: '5\n' }],
    testCases: [{ input: '2 3\n', output: '5\n' }],
    published: true,
  }).expect(201)
  const codingProblem = codingProblemResponse.body.data
  created.problems.push(codingProblem._id)
  const studentProblems = await asUser(request(app).get('/api/coding/problems'), student).expect(200)
  const visibleProblem = studentProblems.body.data.find((item) => item._id === codingProblem._id)
  assert.ok(visibleProblem)
  assert.equal(visibleProblem.testCases, undefined)
  await asUser(request(app).patch(`/api/coding/problems/${codingProblem._id}`), otherTeacher)
    .send({ published: false })
    .expect(403)

  const started = await asUser(request(app).post(`/api/exams/${exam.id}/start`), student).send({}).expect(201)
  const attempt = await ExamAttempt.findById(started.body.data.attemptId)
  created.attempts.push(attempt._id)
  const objectiveQuestion = exam.questions.find((item) => item.type === 'mcq')
  const writtenQuestion = exam.questions.find((item) => item.type === 'short_answer')
  const objectiveChoice = objectiveQuestion.choices.find((choice) => choice.text === '4')
  const submitted = await asUser(request(app).post(`/api/exams/attempts/${attempt.id}/submit`), student)
    .send({ answers: [{ questionId: objectiveQuestion.id, selectedChoices: [objectiveChoice.id] }, { questionId: writtenQuestion.id, text: 'Two plus two is four.' }] })
    .expect(201)
  assert.equal(submitted.body.data.result.objectiveMarks, 1)
  assert.equal(submitted.body.data.result.pendingMarks, 2)
  await asUser(request(app).post(`/api/exams/attempts/${attempt.id}/submit`), student)
    .send({ answers: [] })
    .expect(409)
  await asUser(request(app).get(`/api/exams/${exam.id}/attempts`), otherTeacher).expect(403)

  const graded = await asUser(request(app).patch(`/api/exams/attempts/${attempt.id}/grade`), teacher)
    .send({ grades: [{ questionId: writtenQuestion.id, marksAwarded: 2, feedback: 'Clear explanation.' }] })
    .expect(200)
  assert.equal(graded.body.data.attempt.awardedMarks, 3)
  assert.equal(graded.body.data.passed, true)
  await asUser(request(app).get('/api/exams/admin/reports'), student).expect(403)

  const expiredQuestionId = new mongoose.Types.ObjectId()
  const expiredChoiceId = new mongoose.Types.ObjectId()
  const expiredExam = await Exam.create({
    title: `Expired Exam ${suffix}`,
    course: course._id,
    teacher: teacher._id,
    durationMinutes: 1,
    totalMarks: 1,
    passingMarks: 1,
    published: true,
    questions: [{ _id: expiredQuestionId, type: 'mcq', prompt: 'Choose the answer.', marks: 1, choices: [{ _id: expiredChoiceId, text: 'Correct' }, { text: 'Incorrect' }], correctAnswers: [expiredChoiceId] }],
  })
  created.exams.push(expiredExam._id)
  const expiredAttempt = await ExamAttempt.create({
    exam: expiredExam._id,
    student: student._id,
    startedAt: new Date(Date.now() - 120_000),
    expiresAt: new Date(Date.now() - 60_000),
    questionOrder: [expiredQuestionId],
    choiceOrders: [{ question: expiredQuestionId, choices: [expiredChoiceId, expiredExam.questions[0].choices[1]._id] }],
    totalMarks: 1,
  })
  created.attempts.push(expiredAttempt._id)
  const lateSubmit = await asUser(request(app).post(`/api/exams/attempts/${expiredAttempt.id}/submit`), student)
    .send({ answers: [{ questionId: expiredQuestionId.toString(), selectedChoices: [expiredChoiceId.toString()] }] })
    .expect(201)
  assert.equal(lateSubmit.body.data.result.timedOut, true)
  assert.equal(lateSubmit.body.data.result.objectiveMarks, 0)

  const deleted = await asUser(request(app).delete(`/api/courses/${course.id}`), admin).expect(200)
  assert.equal(deleted.body.data.message, 'Course deleted.')
  assert.equal(await Exam.countDocuments({ course: course._id }), 0)
  assert.equal(await ExamAttempt.countDocuments({ _id: { $in: created.attempts } }), 0)
  assert.equal(await Quiz.countDocuments({ _id: quiz._id }), 0)
  assert.equal(await QuizAttempt.countDocuments({ _id: quizAttempt._id }), 0)
  assert.equal(await AssistantConversation.countDocuments({ _id: conversation._id }), 0)
  assert.equal(await Assignment.countDocuments({ _id: assignment._id }), 0)
  assert.equal(await Submission.countDocuments({ _id: submission._id }), 0)
  assert.equal(await Certificate.countDocuments({ student: student._id, course: course._id }), 0)
})
