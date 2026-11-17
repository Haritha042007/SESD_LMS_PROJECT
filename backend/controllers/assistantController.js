import { AssistantConversation } from '../models/AssistantConversation.js'
import { Course } from '../models/Course.js'
import { Enrollment } from '../models/Enrollment.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { answerLearningQuestion } from '../services/learningAssistant.js'
import { env } from '../config/env.js'

async function requireEnrollment(studentId, courseId) {
  if (!await Course.exists({ _id: courseId, status: 'published' })) {
    throw new HttpError(404, 'Course not found.')
  }
  const enrollment = await Enrollment.exists({ student: studentId, course: courseId })
  if (!enrollment) throw new HttpError(403, 'Enroll in this course to use the learning assistant.')
}

export const listAssistantCourses = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ student: req.user.id })
    .populate({ path: 'course', match: { status: 'published' }, select: 'title category lessons' })
  const courses = enrollments.filter((item) => item.course).map(({ course }) => ({
    id: course.id,
    title: course.title,
    category: course.category,
    topics: [...new Set(course.lessons.map((lesson) => lesson.topic).filter(Boolean))],
  }))
  res.json({ data: courses })
})

export const getAssistantStatus = (_req, res) => {
  res.json({ data: { mode: env.AI_API_KEY ? 'ai' : 'demo' } })
}

export const listConversations = asyncHandler(async (req, res) => {
  const { courseId } = req.validated.query
  await requireEnrollment(req.user.id, courseId)
  const conversations = await AssistantConversation.find({ student: req.user.id, course: courseId })
    .select('title createdAt updatedAt')
    .sort({ updatedAt: -1 })
    .limit(30)
  res.json({ data: conversations })
})

export const createConversation = asyncHandler(async (req, res) => {
  const { courseId } = req.validated.body
  await requireEnrollment(req.user.id, courseId)
  const conversation = await AssistantConversation.create({ student: req.user.id, course: courseId })
  res.status(201).json({ data: conversation })
})

export const getConversation = asyncHandler(async (req, res) => {
  const conversation = await AssistantConversation.findOne({
    _id: req.validated.params.conversationId,
    student: req.user.id,
  }).populate({ path: 'course', select: 'status' })
  if (!conversation || conversation.course?.status !== 'published') throw new HttpError(404, 'Conversation not found.')
  await requireEnrollment(req.user.id, conversation.course.id)
  res.json({ data: conversation })
})

export const deleteConversations = asyncHandler(async (req, res) => {
  const { courseId } = req.validated.query
  await requireEnrollment(req.user.id, courseId)
  const result = await AssistantConversation.deleteMany({ student: req.user.id, course: courseId })
  res.json({ data: { deletedCount: result.deletedCount } })
})

export const sendMessage = asyncHandler(async (req, res) => {
  const { question, topic } = req.validated.body
  const conversation = await AssistantConversation.findOne({
    _id: req.validated.params.conversationId,
    student: req.user.id,
  })
  if (!conversation) throw new HttpError(404, 'Conversation not found.')
  await requireEnrollment(req.user.id, conversation.course)

  const course = await Course.findOne({ _id: conversation.course, status: 'published' })
  if (!course) throw new HttpError(404, 'Course not found.')
  if (!course.lessons.some((lesson) => lesson.topic === topic) && topic !== 'General') {
    throw new HttpError(400, 'Choose a topic from this course.')
  }
  const history = conversation.messages.map(({ role, content }) => ({ role, content }))
  const { answer, mode } = await answerLearningQuestion({ course, question, topic, history })
  conversation.messages.push({ role: 'user', content: question, topic })
  conversation.messages.push({ role: 'assistant', content: answer, topic, mode })
  if (conversation.title === 'New conversation') conversation.title = question.slice(0, 120)
  if (conversation.messages.length > 40) conversation.messages.splice(0, conversation.messages.length - 40)
  await conversation.save()
  res.json({ data: { conversation, mode } })
})
