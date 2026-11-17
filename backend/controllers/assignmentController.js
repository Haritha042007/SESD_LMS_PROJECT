import { Assignment } from '../models/Assignment.js'
import { Enrollment } from '../models/Enrollment.js'
import { Submission } from '../models/Submission.js'
import { Course } from '../models/Course.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { paginationFrom, pageInfo } from '../utils/pagination.js'

export const createAssignment = asyncHandler(async (req, res) => {
  const { courseId, ...data } = req.validated.body
  const course = await Course.findById(courseId)
  if (!course) throw new HttpError(404, 'Course not found.')
  if (req.user.role !== 'admin' && String(course.teacher) !== req.user.id) {
    throw new HttpError(403, 'You can only create assignments for courses you own.')
  }
  const assignment = await Assignment.create({ ...data, course: course.id, teacher: course.teacher })
  res.status(201).json({ data: assignment })
})

export const listAssignments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req.query)
  let filter = {}
  let permittedCourseIds
  if (req.user.role === 'student') {
    permittedCourseIds = await Enrollment.find({ student: req.user.id }).distinct('course')
    filter = { course: { $in: permittedCourseIds }, published: true }
  } else if (req.user.role === 'teacher') {
    permittedCourseIds = await Course.find({ teacher: req.user.id }).distinct('_id')
    filter = { course: { $in: permittedCourseIds } }
  }
  if (req.query.courseId) {
    if (permittedCourseIds && !permittedCourseIds.some((id) => id.equals(req.query.courseId))) {
      throw new HttpError(403, 'You do not have access to assignments for this course.')
    }
    filter.course = req.query.courseId
  }
  const [items, total] = await Promise.all([
    Assignment.find(filter).populate('course', 'title').sort({ dueAt: 1, createdAt: -1 }).skip(skip).limit(limit),
    Assignment.countDocuments(filter),
  ])
  if (req.user.role === 'student') {
    const ids = items.map((item) => item.id)
    const submissions = await Submission.find({ student: req.user.id, assignment: { $in: ids } }).select('assignment status score feedback submittedAt')
    const byAssignment = new Map(submissions.map((item) => [String(item.assignment), item]))
    return res.json({ data: items.map((item) => ({ assignment: item, submission: byAssignment.get(item.id) || null })), pagination: pageInfo(page, limit, total) })
  }
  res.json({ data: items, pagination: pageInfo(page, limit, total) })
})

export const submitAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findOne({ _id: req.params.assignmentId, published: true })
  if (!assignment) throw new HttpError(404, 'Assignment not found.')
  const enrolled = await Enrollment.exists({ student: req.user.id, course: assignment.course })
  if (!enrolled) throw new HttpError(403, 'Enroll in this course before submitting work.')
  const submission = await Submission.findOneAndUpdate(
    { assignment: assignment.id, student: req.user.id },
    { $set: { ...req.validated.body, status: 'submitted', score: null, feedback: '', gradedBy: null, gradedAt: null } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  )
  res.status(201).json({ data: { submission } })
})

export const listSubmissions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req.query)
  const filter = {}
  if (req.user.role === 'student') {
    filter.student = req.user.id
  } else if (req.user.role === 'teacher') {
    const courseIds = await Course.find({ teacher: req.user.id }).distinct('_id')
    const assignmentIds = await Assignment.find({ course: { $in: courseIds } }).distinct('_id')
    filter.assignment = { $in: assignmentIds }
    if (req.query.assignmentId) {
      const assignment = await Assignment.findById(req.query.assignmentId)
      if (!assignment || !courseIds.some((id) => id.equals(assignment.course))) throw new HttpError(403, 'You can only view submissions for your courses.')
      filter.assignment = assignment.id
    }
  } else if (req.query.assignmentId) {
    filter.assignment = req.query.assignmentId
  }
  const [submissions, total] = await Promise.all([
    Submission.find(filter)
      .populate('assignment', 'title maxScore course')
      .populate('student', 'name')
      .populate('gradedBy', 'name')
      .sort({ updatedAt: -1 })
      .skip(skip).limit(limit),
    Submission.countDocuments(filter),
  ])
  res.json({ data: submissions, pagination: pageInfo(page, limit, total) })
})

export const gradeSubmission = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.submissionId).populate('assignment', 'maxScore course')
  if (!submission) throw new HttpError(404, 'Submission not found.')
  if (req.user.role !== 'admin') {
    const course = await Course.findOne({ _id: submission.assignment.course, teacher: req.user.id })
    if (!course) throw new HttpError(403, 'You can only grade submissions for courses you own.')
  }
  const { score, feedback } = req.validated.body
  if (score > submission.assignment.maxScore) {
    throw new HttpError(400, `Score cannot exceed the assignment maximum of ${submission.assignment.maxScore}.`)
  }
  submission.score = score
  submission.feedback = feedback
  submission.status = 'graded'
  submission.gradedBy = req.user.id
  submission.gradedAt = new Date()
  await submission.save()
  res.json({ data: { submission } })
})
