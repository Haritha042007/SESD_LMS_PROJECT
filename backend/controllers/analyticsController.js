import { Assignment } from '../models/Assignment.js'
import { Course } from '../models/Course.js'
import { Enrollment } from '../models/Enrollment.js'
import { QuizAttempt } from '../models/QuizAttempt.js'
import { Quiz } from '../models/Quiz.js'
import { StudySession } from '../models/StudySession.js'
import { Submission } from '../models/Submission.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getStudentDashboardStats, getTeacherDashboardStats } from './learningController.js'

async function adminStats() {
  const [students, teachers, pendingTeachers, courses, publishedCourses, enrollments, submissions] = await Promise.all([
    User.countDocuments({ role: 'student', status: 'active' }),
    User.countDocuments({ role: 'teacher', status: 'active', approvalStatus: 'approved' }),
    User.countDocuments({ role: 'teacher', approvalStatus: 'pending' }),
    Course.countDocuments(),
    Course.countDocuments({ status: 'published' }),
    Enrollment.countDocuments(),
    Submission.countDocuments(),
  ])
  return { students, teachers, pendingTeachers, courses, publishedCourses, enrollments, submissions }
}

export const dashboardAnalytics = asyncHandler(async (req, res) => {
  let data
  if (req.user.role === 'student') data = await getStudentDashboardStats(req.user.id)
  else if (req.user.role === 'teacher') data = await getTeacherDashboardStats(req.user.id)
  else data = await adminStats()
  res.json({ data })
})

export const detailedAnalytics = asyncHandler(async (req, res) => {
  let teacherCourseIds = []
  if (req.user.role === 'teacher') teacherCourseIds = await Course.find({ teacher: req.user.id }).distinct('_id')
  const enrollmentMatch = req.user.role === 'student'
    ? { student: req.user._id }
    : req.user.role === 'teacher'
      ? { course: { $in: teacherCourseIds } }
      : {}
  const sessionMatch = req.user.role === 'student'
    ? { student: req.user._id }
    : req.user.role === 'teacher'
      ? { course: { $in: teacherCourseIds } }
      : {}
  const [progress, quizScores, studyMinutes, enrollmentsByCourse, pendingReviews] = await Promise.all([
    Enrollment.aggregate([
      { $match: enrollmentMatch },
      { $lookup: { from: 'courses', localField: 'course', foreignField: '_id', as: 'course' } },
      { $unwind: '$course' },
      { $project: { courseTitle: '$course.title', totalLessons: { $size: '$course.lessons' }, completedLessons: { $size: '$completedLessons' }, completedAt: 1 } },
    ]),
    QuizAttempt.aggregate([
      { $match: req.user.role === 'student' ? { student: req.user._id } : req.user.role === 'teacher' ? { quiz: { $in: await Quiz.find({ course: { $in: teacherCourseIds } }).distinct('_id') } } : {} },
      { $group: { _id: null, attempts: { $sum: 1 }, averageScore: { $avg: '$score' }, bestScore: { $max: '$score' } } },
    ]),
    StudySession.aggregate([{ $match: sessionMatch }, { $group: { _id: null, totalMinutes: { $sum: '$durationMinutes' }, sessions: { $sum: 1 } } }]),
    req.user.role === 'student'
      ? Enrollment.aggregate([{ $match: { student: req.user._id } }, { $group: { _id: '$course', students: { $sum: 1 } } }])
      : Course.find(req.user.role === 'teacher' ? { teacher: req.user.id } : {}).select('title enrollmentCount status'),
    req.user.role === 'teacher'
      ? (async () => {
        const courseIds = await Course.find({ teacher: req.user.id }).distinct('_id')
        const assignmentIds = await Assignment.find({ course: { $in: courseIds } }).distinct('_id')
        return Submission.countDocuments({ assignment: { $in: assignmentIds }, status: 'submitted' })
      })()
      : Promise.resolve(0),
  ])
  const score = quizScores[0] || { attempts: 0, averageScore: 0, bestScore: 0 }
  res.json({
    data: {
      courseProgress: progress.map((item) => ({
        ...item,
        progressPercent: item.totalLessons ? Math.round(item.completedLessons / item.totalLessons * 100) : 0,
      })),
      quizzes: { attempts: score.attempts, averageScore: Math.round(score.averageScore || 0), bestScore: score.bestScore },
      study: studyMinutes[0] || { totalMinutes: 0, sessions: 0 },
      courses: enrollmentsByCourse,
      pendingReviews,
      ...(req.user.role === 'admin' ? { platform: await adminStats() } : {}),
    },
  })
})
