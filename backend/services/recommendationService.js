import { Enrollment } from '../models/Enrollment.js'
import { QuizAttempt } from '../models/QuizAttempt.js'

export async function getRuleBasedRecommendations(studentId) {
  const attempts = await QuizAttempt.find({ student: studentId }).sort({ createdAt: -1 }).limit(100).select('topicResults')
  const topicScores = new Map()
  for (const attempt of attempts) {
    for (const result of attempt.topicResults) {
      const score = topicScores.get(result.topic) || { correct: 0, total: 0 }
      score.total += 1
      score.correct += result.correct ? 1 : 0
      topicScores.set(result.topic, score)
    }
  }
  const weakTopics = [...topicScores.entries()]
    .map(([topic, score]) => ({ topic, score: Math.round(score.correct / score.total * 100) }))
    .filter((item) => item.score < 70)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)

  const enrollments = await Enrollment.find({ student: studentId, completedAt: null })
    .populate({ path: 'course', select: 'title lessons' })
  const lessons = enrollments.flatMap(({ course, completedLessons }) => {
    if (!course) return []
    return course.lessons
      .filter((lesson) => !completedLessons.some((id) => id.equals(lesson._id)))
      .filter((lesson) => weakTopics.some((topic) => topic.topic.toLowerCase() === lesson.topic.toLowerCase()))
      .map((lesson) => ({ courseId: course.id, courseTitle: course.title, lessonId: lesson.id, title: lesson.title, topic: lesson.topic }))
  }).slice(0, 10)

  return {
    method: 'rule-based',
    weakTopics,
    recommendedLessons: lessons,
    message: weakTopics.length
      ? 'Review lessons in topics where recent quiz accuracy is below 70%.'
      : 'Complete quizzes to receive topic-based revision recommendations.',
  }
}
