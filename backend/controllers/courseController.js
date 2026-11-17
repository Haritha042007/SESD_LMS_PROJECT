import { Course } from '../models/Course.js'
import { Category } from '../models/Category.js'
import { Enrollment } from '../models/Enrollment.js'
import { Quiz } from '../models/Quiz.js'
import { QuizAttempt } from '../models/QuizAttempt.js'
import { Assignment } from '../models/Assignment.js'
import { Submission } from '../models/Submission.js'
import { Certificate } from '../models/Certificate.js'
import { Exam } from '../models/Exam.js'
import { ExamAttempt } from '../models/ExamAttempt.js'
import { AssistantConversation } from '../models/AssistantConversation.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { pageInfo, paginationFrom } from '../utils/pagination.js'

async function getManageableCourse(courseId, user) {
  const course = await Course.findById(courseId)
  if (!course) throw new HttpError(404, 'Course not found.')
  if (user.role !== 'admin' && String(course.teacher) !== user.id) {
    throw new HttpError(403, 'You can only manage courses you own.')
  }
  return course
}

export const listCourses = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req.query)
  const filter = { status: 'published' }
  if (req.query.category) filter.category = req.query.category
  if (req.query.level) filter.level = req.query.level
  if (req.query.search) {
    const escaped = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
      { category: { $regex: escaped, $options: 'i' } },
    ]
  }
  const [items, total] = await Promise.all([
    Course.find(filter).populate('teacher', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Course.countDocuments(filter),
  ])
  res.json({ data: items, pagination: pageInfo(page, limit, total) })
})

export const listManagedCourses = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req.query)
  const filter = req.user.role === 'admin' ? {} : { teacher: req.user.id }
  if (req.query.status) filter.status = req.query.status
  if (req.query.category) filter.category = req.query.category
  if (req.query.search) filter.title = { $regex: req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
  const [items, total] = await Promise.all([
    Course.find(filter).populate('teacher', 'name email').sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Course.countDocuments(filter),
  ])
  res.json({ data: items, pagination: pageInfo(page, limit, total) })
})

export const getCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId).populate('teacher', 'name bio')
  if (!course) throw new HttpError(404, 'Course not found.')
  if (course.status !== 'published' && req.user?.role !== 'admin' && String(course.teacher.id || course.teacher) !== req.user?.id) {
    throw new HttpError(404, 'Course not found.')
  }
  let hasFullAccess = req.user?.role === 'admin'
    || (req.user?.role === 'teacher' && String(course.teacher.id || course.teacher) === req.user.id)
  if (req.user?.role === 'student' && course.status === 'published') {
    const enrolled = await Enrollment.exists({ course: course.id, student: req.user.id })
    hasFullAccess ||= Boolean(enrolled)
  }
  if (!hasFullAccess) {
    const result = course.toObject()
    result.lessons = result.lessons.map(({ _id, title, description, durationMinutes, topic }) => ({ _id, title, description, durationMinutes, topic }))
    return res.json({ data: result })
  }
  res.json({ data: course })
})

export const createCourse = asyncHandler(async (req, res) => {
  const data = req.validated.body
  if (!await Category.exists({ name: data.category })) throw new HttpError(400, 'Choose an existing course category.')
  const course = await Course.create({ ...data, teacher: req.user.id })
  res.status(201).json({ data: course })
})

export const updateCourse = asyncHandler(async (req, res) => {
  const course = await getManageableCourse(req.params.courseId, req.user)
  if (req.validated.body.category && !await Category.exists({ name: req.validated.body.category })) {
    throw new HttpError(400, 'Choose an existing course category.')
  }
  const updated = await Course.findByIdAndUpdate(course.id, { $set: req.validated.body }, { new: true, runValidators: true })
  res.json({ data: updated })
})

export const deleteCourse = asyncHandler(async (req, res) => {
  const course = await getManageableCourse(req.params.courseId, req.user)
  if (await Enrollment.exists({ course: course.id }) && req.user.role !== 'admin') {
    course.status = 'archived'
    await course.save()
    return res.json({ data: { message: 'Course archived because students are enrolled.', course } })
  }
  const quizIds = await Quiz.find({ course: course.id }).distinct('_id')
  const assignmentIds = await Assignment.find({ course: course.id }).distinct('_id')
  const examIds = await Exam.find({ course: course.id }).distinct('_id')
  await Promise.all([
    course.deleteOne(),
    Enrollment.deleteMany({ course: course.id }),
    Quiz.deleteMany({ _id: { $in: quizIds } }),
    QuizAttempt.deleteMany({ quiz: { $in: quizIds } }),
    Assignment.deleteMany({ _id: { $in: assignmentIds } }),
    Submission.deleteMany({ assignment: { $in: assignmentIds } }),
    ExamAttempt.deleteMany({ exam: { $in: examIds } }),
    Exam.deleteMany({ _id: { $in: examIds } }),
    AssistantConversation.deleteMany({ course: course.id }),
    Certificate.deleteMany({ course: course.id }),
  ])
  res.json({ data: { message: 'Course deleted.' } })
})

export const enroll = asyncHandler(async (req, res) => {
  const course = await Course.findOne({ _id: req.params.courseId, status: 'published' })
  if (!course) throw new HttpError(404, 'Published course not found.')
  let enrollment
  try {
    enrollment = await Enrollment.create({ student: req.user.id, course: course.id })
  } catch (error) {
    if (error?.code !== 11000) throw error
    enrollment = await Enrollment.findOne({ student: req.user.id, course: course.id })
    return res.status(200).json({ data: { enrollment, message: 'Already enrolled.' } })
  }
  await Course.updateOne({ _id: course.id }, { $inc: { enrollmentCount: 1 } })
  res.status(201).json({ data: { enrollment } })
})

export const listCategories = asyncHandler(async (_req, res) => {
  const categories = await Category.find().sort({ name: 1 })
  res.json({ data: categories })
})

export const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create(req.validated.body)
  res.status(201).json({ data: category })
})

export const updateCategory = asyncHandler(async (req, res) => {
  const current = await Category.findById(req.params.categoryId)
  if (!current) throw new HttpError(404, 'Category not found.')
  if (req.validated.body.name && req.validated.body.name !== current.name && await Course.exists({ category: current.name })) {
    throw new HttpError(409, 'Reassign courses before renaming this category.')
  }
  const category = await Category.findByIdAndUpdate(req.params.categoryId, { $set: req.validated.body }, { new: true, runValidators: true })
  res.json({ data: category })
})

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.categoryId)
  if (!category) throw new HttpError(404, 'Category not found.')
  if (await Course.exists({ category: category.name })) {
    throw new HttpError(409, 'Reassign or remove courses in this category before deleting it.')
  }
  await category.deleteOne()
  res.json({ data: { message: 'Category deleted.' } })
})

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req.query)
  const filter = {}
  if (req.query.role) filter.role = req.query.role
  if (req.query.status) filter.status = req.query.status
  if (req.query.search) {
    const escaped = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [{ name: { $regex: escaped, $options: 'i' } }, { email: { $regex: escaped, $options: 'i' } }]
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ])
  res.json({ data: items, pagination: pageInfo(page, limit, total) })
})

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId)
  if (!user) throw new HttpError(404, 'User not found.')
  if (user.id === req.user.id && req.validated.body.status === 'disabled') {
    throw new HttpError(400, 'You cannot disable your own admin account.')
  }
  if (user.role === 'admin' && req.validated.body.role && req.validated.body.role !== 'admin') {
    throw new HttpError(400, 'Admin roles cannot be changed through this endpoint.')
  }
  Object.assign(user, req.validated.body)
  if (req.validated.body.status === 'disabled') user.tokenVersion += 1
  if (req.validated.body.role && req.validated.body.role !== user.role) {
    user.tokenVersion += 1
    user.approvalStatus = req.validated.body.role === 'teacher' ? 'pending' : 'not_required'
  }
  await user.save()
  res.json({ data: { user } })
})

export const reviewTeacher = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.userId, role: 'teacher' })
  if (!user) throw new HttpError(404, 'Teacher account not found.')
  if (user.approvalStatus !== 'pending') throw new HttpError(409, 'This teacher application has already been reviewed.')
  user.approvalStatus = req.validated.body.decision
  if (user.approvalStatus === 'rejected') user.tokenVersion += 1
  await user.save()
  res.json({ data: { user, message: `Teacher application ${user.approvalStatus}.` } })
})

export const pendingTeachers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req.query)
  const filter = { role: 'teacher', approvalStatus: 'pending' }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ])
  res.json({ data: items, pagination: pageInfo(page, limit, total) })
})
