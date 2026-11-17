import { initialTodos } from '../data'

const tokenKey = 'learnly-access-token'
const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '')

function getToken() {
  return window.sessionStorage.getItem(tokenKey)
}

function setToken(token) {
  if (token) window.sessionStorage.setItem(tokenKey, token)
  else window.sessionStorage.removeItem(tokenKey)
}

async function request(path, { body, method = 'GET', query, authenticated = true } = {}) {
  const url = new URL(`${apiBaseUrl}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
    }
  }
  const headers = { Accept: 'application/json' }
  const token = authenticated && getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response
  try {
    response = await window.fetch(url, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch (error) {
    throw new Error(`Could not reach the LMS API at ${apiBaseUrl}. Check that the backend is running and CORS allows this frontend origin.`)
  }

  let result
  try {
    result = await response.json()
  } catch {
    result = null
  }
  if (!response.ok) {
    if (response.status === 401 && token) {
      setToken(null)
      window.dispatchEvent(new CustomEvent('learnly:unauthorized'))
    }
    const details = result?.error?.details?.map((item) => item.message).filter(Boolean)
    throw new Error(details?.length ? details.join(' ') : result?.error?.message || `Request failed (${response.status}).`)
  }
  return result?.data
}

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

function normalizeCourse(course, progress = 0) {
  const lessonList = Array.isArray(course.lessons) ? course.lessons : []
  const totalMinutes = lessonList.reduce((total, lesson) => total + (Number(lesson.durationMinutes) || 0), 0)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const categoryColors = {
    Statistics: 'blue',
    Algorithms: 'orange',
    'Critical Thinking': 'green',
    'Artificial Intelligence': 'pink',
  }
  return {
    ...course,
    id: String(course._id || course.id),
    teacher: typeof course.teacher === 'object' ? course.teacher?.name || 'Learnly instructor' : 'Learnly instructor',
    status: course.status === 'published' ? 'Published' : course.status === 'draft' ? 'Draft' : 'Archived',
    lessonCount: lessonList.length,
    lessonList,
    lessons: lessonList.length,
    duration: course.duration || (totalMinutes ? `${hours ? `${hours}h ` : ''}${minutes}m` : 'Self-paced'),
    progress,
    rating: course.rating || '—',
    students: Number(course.enrollmentCount) || 0,
    color: categoryColors[course.category] || 'violet',
    icon: course.category === 'Statistics' ? '∑' : course.category === 'Algorithms' ? '⌁' : '✳',
  }
}

const coursePath = (id) => `/courses/${encodeURIComponent(id)}`

export const api = {
  baseUrl: apiBaseUrl,
  hasToken: () => Boolean(getToken()),
  clearToken: () => setToken(null),

  async login(credentials) {
    const result = await request('/auth/login', { method: 'POST', body: credentials, authenticated: false })
    setToken(result.token)
    return result.user
  },
  async register(details) {
    const result = await request('/auth/register', { method: 'POST', body: details, authenticated: false })
    setToken(result.token)
    return result.user
  },
  async getMe() {
    const result = await request('/auth/me')
    return result.user
  },
  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' })
    } finally {
      setToken(null)
    }
  },
  async updateProfile(body) {
    const result = await request('/auth/me', { method: 'PATCH', body })
    return result.user
  },

  async getCourses({ role = 'student', search, category, level } = {}) {
    const path = role === 'student' ? '/courses' : '/courses/manage'
    const [result, progress] = await Promise.all([
      request(path, { query: { page: 1, limit: 100, search, category, level } }),
      role === 'student' ? request('/progress/me') : Promise.resolve(null),
    ])
    const progressByCourse = new Map((progress?.courses || []).map((item) => [item.course.id, item]))
    return result.map((course) => {
      const enrollment = progressByCourse.get(String(course._id))
      return { ...normalizeCourse(course, enrollment?.progressPercent || 0), isEnrolled: Boolean(enrollment) }
    })
  },
  async getCourse(id) {
    return normalizeCourse(await request(coursePath(id)))
  },
  getAssistantCourses: () => request('/assistant/courses'),
  getAssistantStatus: () => request('/assistant/status'),
  getAssistantConversations: (courseId) => request('/assistant/conversations', { query: { courseId } }),
  createAssistantConversation: (courseId) => request('/assistant/conversations', { method: 'POST', body: { courseId } }),
  getAssistantConversation: (conversationId) => request(`/assistant/conversations/${encodeURIComponent(conversationId)}`),
  sendAssistantMessage: (conversationId, body) => request(`/assistant/conversations/${encodeURIComponent(conversationId)}/messages`, { method: 'POST', body }),
  clearAssistantConversations: (courseId) => request('/assistant/conversations', { method: 'DELETE', query: { courseId } }),
  getCodingProblems: (filters = {}) => request('/coding/problems', { query: filters }),
  getCodingProblem: (problemId) => request(`/coding/problems/${encodeURIComponent(problemId)}`),
  runCode: (problemId, body) => request(`/coding/problems/${encodeURIComponent(problemId)}/run`, { method: 'POST', body }),
  submitCode: (problemId, body) => request(`/coding/problems/${encodeURIComponent(problemId)}/submit`, { method: 'POST', body }),
  getCodingSubmissions: () => request('/coding/submissions/me', { query: { page: 1, limit: 50 } }),
  getCodingProgress: () => request('/coding/progress/me'),
  getCodingLeaderboard: () => request('/coding/leaderboard'),
  getManagedCodingProblems: (filters = {}) => request('/coding/manage/problems', { query: filters }),
  createCodingProblem: (body) => request('/coding/problems', { method: 'POST', body }),
  updateCodingProblem: (problemId, body) => request(`/coding/problems/${encodeURIComponent(problemId)}`, { method: 'PATCH', body }),
  deleteCodingProblem: (problemId) => request(`/coding/problems/${encodeURIComponent(problemId)}`, { method: 'DELETE' }),
  getCodingActivity: () => request('/coding/admin/activity', { query: { page: 1, limit: 50 } }),
  async getCategories() {
    return request('/courses/categories', { authenticated: false })
  },
  async createCategory(body) {
    return request('/courses/admin/categories', { method: 'POST', body })
  },
  updateCategory: (categoryId, body) => request(`/courses/admin/categories/${encodeURIComponent(categoryId)}`, { method: 'PATCH', body }),
  deleteCategory: (categoryId) => request(`/courses/admin/categories/${encodeURIComponent(categoryId)}`, { method: 'DELETE' }),
  async saveCourse(course) {
    const body = {
      title: course.title,
      description: course.description,
      category: course.category,
      level: course.level,
      status: String(course.status || 'draft').toLowerCase(),
      objectives: course.objectives || [],
      studyNotes: course.studyNotes || '',
      lessons: course.lessonList || [],
    }
    const result = course.id
      ? await request(coursePath(course.id), { method: 'PATCH', body })
      : await request('/courses', { method: 'POST', body })
    return normalizeCourse(result)
  },
  async enrollCourse(courseId) {
    return request(`${coursePath(courseId)}/enroll`, { method: 'POST', body: {} })
  },

  getProgress: () => request('/progress/me'),
  completeLesson: (courseId, lessonId) => request(`/progress/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/complete`, { method: 'POST', body: {} }),
  getRecommendations: () => request('/progress/recommendations'),
  recordStudySession: (durationMinutes, courseId) => request('/progress/study-sessions', { method: 'POST', body: { durationMinutes, ...(courseId ? { courseId } : {}) } }),
  getStudySessions: () => request('/progress/study-sessions'),
  getDashboard: () => request('/analytics/dashboard'),
  getAnalytics: () => request('/analytics/details'),

  async getQuizzes(courseId) {
    return request(`/quizzes/course/${encodeURIComponent(courseId)}`)
  },
  createQuiz: (body) => request('/quizzes', { method: 'POST', body }),
  submitQuiz: (quizId, answers) => request(`/quizzes/${encodeURIComponent(quizId)}/submit`, { method: 'POST', body: { answers } }),

  getExams: (filters = {}) => request('/exams', { query: filters }),
  createExam: (body) => request('/exams', { method: 'POST', body }),
  updateExam: (examId, body) => request(`/exams/${encodeURIComponent(examId)}`, { method: 'PATCH', body }),
  deleteExam: (examId) => request(`/exams/${encodeURIComponent(examId)}`, { method: 'DELETE' }),
  startExam: (examId) => request(`/exams/${encodeURIComponent(examId)}/start`, { method: 'POST', body: {} }),
  submitExam: (attemptId, answers) => request(`/exams/attempts/${encodeURIComponent(attemptId)}/submit`, { method: 'POST', body: { answers } }),
  getExamHistory: () => request('/exams/attempts/me'),
  getExamAttempts: (examId) => request(`/exams/${encodeURIComponent(examId)}/attempts`),
  gradeExamAttempt: (attemptId, body) => request(`/exams/attempts/${encodeURIComponent(attemptId)}/grade`, { method: 'PATCH', body }),
  getExamReports: () => request('/exams/admin/reports'),

  async getAssignments(courseId) {
    const result = await request('/assignments', { query: { page: 1, limit: 100, courseId } })
    return result
  },
  createAssignment: (body) => request('/assignments', { method: 'POST', body }),
  submitAssignment: (assignmentId, body) => request(`/assignments/${encodeURIComponent(assignmentId)}/submit`, { method: 'POST', body }),
  async getSubmissions(assignmentId) {
    const result = await request('/assignments/submissions', { query: { page: 1, limit: 100, assignmentId } })
    return result
  },
  gradeSubmission: (submissionId, body) => request(`/assignments/submissions/${encodeURIComponent(submissionId)}/grade`, { method: 'PATCH', body }),

  async getUsers(role) {
    const result = await request('/users', { query: { page: 1, limit: 100, role } })
    return result
  },
  updateUser: (userId, body) => request(`/users/${encodeURIComponent(userId)}`, { method: 'PATCH', body }),
  async getPendingTeachers() {
    const result = await request('/users/teachers/pending', { query: { page: 1, limit: 100 } })
    return result
  },
  reviewTeacher: (userId, decision) => request(`/users/${encodeURIComponent(userId)}/approval`, { method: 'PATCH', body: { decision } }),
  async getLeaderboard() {
    return request('/leaderboard', { authenticated: false })
  },
  getCertificates: () => request('/certificates'),
  createCertificate: (courseId) => request(`/certificates/${encodeURIComponent(courseId)}`, { method: 'POST', body: {} }),
  verifyCertificate: (certificateId) => request(`/certificates/${encodeURIComponent(certificateId)}/verify`, { authenticated: false }),

  async getTodos() {
    const saved = window.localStorage.getItem('learnly-todos')
    return saved ? JSON.parse(saved) : initialTodos
  },
  async saveTodos(todos) {
    window.localStorage.setItem('learnly-todos', JSON.stringify(todos))
    return todos
  },
}

export { initials, normalizeCourse }
