import { randomBytes } from 'node:crypto'
import { Assignment } from '../models/Assignment.js'
import { Certificate } from '../models/Certificate.js'
import { Course } from '../models/Course.js'
import { Enrollment } from '../models/Enrollment.js'
import { QuizAttempt } from '../models/QuizAttempt.js'
import { StudySession } from '../models/StudySession.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { awardStudyXp } from '../services/gamificationService.js'
import { getRuleBasedRecommendations } from '../services/recommendationService.js'

export const completeLesson = asyncHandler(async (req, res) => {
  const { courseId, lessonId } = req.params
  const course = await Course.findOne({ _id: courseId, status: 'published' })
  if (!course) throw new HttpError(404, 'Published course not found.')
  const lesson = course.lessons.id(lessonId)
  if (!lesson) throw new HttpError(404, 'Lesson not found in this course.')
  const update = await Enrollment.updateOne(
    { student: req.user.id, course: course.id, completedLessons: { $ne: lesson._id } },
    { $addToSet: { completedLessons: lesson._id } },
  )
  if (update.matchedCount === 0) {
    const enrolled = await Enrollment.exists({ student: req.user.id, course: course.id })
    if (!enrolled) throw new HttpError(403, 'Enroll in this course before recording progress.')
  }
  const enrollment = await Enrollment.findOne({ student: req.user.id, course: course.id })
  const completed = enrollment.completedLessons.length
  const total = course.lessons.length
  const percent = total ? Math.round(completed / total * 100) : 0
  let certificate = null
  if (total > 0 && completed === total) {
    enrollment.completedAt ||= new Date()
    await enrollment.save()
    try {
      certificate = await Certificate.create({
        certificateId: `LN-${new Date().getFullYear()}-${randomBytes(6).toString('hex').toUpperCase()}`,
        student: req.user.id,
        course: course.id,
      })
    } catch (error) {
      if (error?.code !== 11000) throw error
      certificate = await Certificate.findOne({ student: req.user.id, course: course.id })
    }
  }
  const rewards = update.modifiedCount ? await awardStudyXp(req.user.id, 10) : null
  res.json({
    data: {
      enrollment,
      progressPercent: percent,
      ...(rewards ? { rewards } : {}),
      ...(certificate ? { certificate } : {}),
      message: update.modifiedCount ? 'Lesson marked complete.' : 'Lesson was already completed.',
    },
  })
})

export const myProgress = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ student: req.user.id })
    .populate({ path: 'course', select: 'title category lessons teacher status' })
    .sort({ enrolledAt: -1 })
  const data = enrollments.filter((item) => item.course).map((item) => {
    const totalLessons = item.course.lessons.length
    return {
      enrollmentId: item.id,
      course: { id: item.course.id, title: item.course.title, category: item.course.category },
      completedLessons: item.completedLessons,
      totalLessons,
      progressPercent: totalLessons ? Math.round(item.completedLessons.length / totalLessons * 100) : 0,
      enrolledAt: item.enrolledAt,
      completedAt: item.completedAt,
    }
  })
  const sessions = await StudySession.aggregate([
    { $match: { student: req.user._id } },
    { $group: { _id: null, totalMinutes: { $sum: '$durationMinutes' }, count: { $sum: 1 } } },
  ])
  const user = await User.findById(req.user.id)
  res.json({
    data: {
      courses: data,
      studyTimeMinutes: sessions[0]?.totalMinutes || 0,
      studySessions: sessions[0]?.count || 0,
      xp: user.xp,
      streakDays: user.streakDays,
      completedCourses: data.filter((item) => item.completedAt).length,
    },
  })
})

export const recordStudySession = asyncHandler(async (req, res) => {
  const { courseId, durationMinutes } = req.validated.body
  if (durationMinutes > 240) throw new HttpError(400, 'A single study session cannot exceed 4 hours.')
  if (courseId) {
    const enrolled = await Enrollment.exists({ student: req.user.id, course: courseId })
    if (!enrolled) throw new HttpError(403, 'Enroll in the course before logging study time.')
  }
  const studiedAt = new Date()
  const dayStart = new Date(studiedAt)
  dayStart.setUTCHours(0, 0, 0, 0)
  const daily = await StudySession.aggregate([
    { $match: { student: req.user._id, studiedAt: { $gte: dayStart } } },
    { $group: { _id: null, minutes: { $sum: '$durationMinutes' } } },
  ])
  if ((daily[0]?.minutes || 0) + durationMinutes > 720) {
    throw new HttpError(409, 'Your daily study-time limit of 12 hours has been reached.')
  }
  const session = await StudySession.create({ student: req.user.id, course: courseId || null, durationMinutes, studiedAt })
  const rewards = await awardStudyXp(req.user.id, Math.min(30, Math.ceil(durationMinutes / 5)), session.studiedAt)
  res.status(201).json({ data: { session, rewards } })
})

export const recommendations = asyncHandler(async (req, res) => {
  const result = await getRuleBasedRecommendations(req.user.id)
  res.json({ data: result })
})

export const leaderboard = asyncHandler(async (_req, res) => {
  const users = await User.find({ role: 'student', status: 'active' })
    .select('name xp streakDays')
    .sort({ xp: -1, streakDays: -1 })
    .limit(20)
  res.json({ data: users.map((user, index) => ({ rank: index + 1, user })) })
})

export const createCertificate = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId)
  if (!course) throw new HttpError(404, 'Course not found.')
  const enrollment = await Enrollment.findOne({ student: req.user.id, course: course.id })
  if (!enrollment?.completedAt || !course.lessons.length || enrollment.completedLessons.length < course.lessons.length) {
    throw new HttpError(409, 'Complete every course lesson before requesting a certificate.')
  }
  let certificate = await Certificate.findOne({ student: req.user.id, course: course.id })
  if (!certificate) {
    try {
      certificate = await Certificate.create({
        certificateId: `LN-${new Date().getFullYear()}-${randomBytes(6).toString('hex').toUpperCase()}`,
        student: req.user.id,
        course: course.id,
      })
    } catch (error) {
      if (error?.code !== 11000) throw error
      certificate = await Certificate.findOne({ student: req.user.id, course: course.id })
    }
  }
  res.status(201).json({ data: { certificate } })
})

export const listCertificates = asyncHandler(async (req, res) => {
  const certificates = await Certificate.find({ student: req.user.id })
    .populate('course', 'title category')
    .sort({ issuedAt: -1 })
  res.json({ data: certificates })
})

export const verifyCertificate = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findOne({ certificateId: req.params.certificateId })
    .populate('student', 'name')
    .populate('course', 'title')
  if (!certificate) throw new HttpError(404, 'Certificate not found.')
  res.json({ data: { valid: true, certificateId: certificate.certificateId, studentName: certificate.student.name, courseTitle: certificate.course.title, issuedAt: certificate.issuedAt } })
})

export const listStudySessions = asyncHandler(async (req, res) => {
  const sessions = await StudySession.find({ student: req.user.id })
    .populate('course', 'title')
    .sort({ studiedAt: -1 })
    .limit(100)
  res.json({ data: sessions })
})

export async function getStudentDashboardStats(userId) {
  const [courses, attempts, sessions] = await Promise.all([
    Enrollment.countDocuments({ student: userId }),
    QuizAttempt.find({ student: userId }).select('score'),
    StudySession.aggregate([{ $match: { student: userId } }, { $group: { _id: null, minutes: { $sum: '$durationMinutes' } } }]),
  ])
  const averageScore = attempts.length ? Math.round(attempts.reduce((sum, item) => sum + item.score, 0) / attempts.length) : 0
  const user = await User.findById(userId)
  return { enrolledCourses: courses, quizzesTaken: attempts.length, averageQuizScore: averageScore, studyTimeMinutes: sessions[0]?.minutes || 0, xp: user.xp, streakDays: user.streakDays }
}

export async function getTeacherDashboardStats(userId) {
  const courses = await Course.find({ teacher: userId }).select('_id title enrollmentCount status')
  const courseIds = courses.map((course) => course._id)
  const [enrollments, assignments] = await Promise.all([
    Enrollment.countDocuments({ course: { $in: courseIds } }),
    Assignment.countDocuments({ course: { $in: courseIds } }),
  ])
  return { courses: courses.length, publishedCourses: courses.filter((course) => course.status === 'published').length, students: enrollments, assignments }
}
