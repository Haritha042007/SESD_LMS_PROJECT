import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-only-secret-with-at-least-thirty-two-characters'
process.env.CORS_ORIGIN = 'http://localhost:5173,http://127.0.0.1:5173'
process.env.AI_API_KEY = ''
process.env.CODE_RUNNER_API_URL = ''

let app
let scoreQuiz
let schemas
let paginationFrom
let authorize
let requireApprovedTeacher
let answerLearningQuestion
let env
let executeCode
let scoreObjectiveQuestion

before(async () => {
  const [appModule, quizModule, schemaModule, paginationModule, authMiddleware, assistantModule, envModule, runnerModule, examModule] = await Promise.all([
    import('../app.js'),
    import('../controllers/quizController.js'),
    import('../validation/schemas.js'),
    import('../utils/pagination.js'),
    import('../middleware/auth.js'),
    import('../services/learningAssistant.js'),
    import('../config/env.js'),
    import('../services/codeRunner.js'),
    import('../controllers/examController.js'),
  ])
  app = appModule.app
  scoreQuiz = quizModule.scoreQuiz
  schemas = schemaModule
  paginationFrom = paginationModule.paginationFrom
  authorize = authMiddleware.authorize
  requireApprovedTeacher = authMiddleware.requireApprovedTeacher
  answerLearningQuestion = assistantModule.answerLearningQuestion
  env = envModule.env
  executeCode = runnerModule.executeCode
  scoreObjectiveQuestion = examModule.scoreObjectiveQuestion
})

test('health endpoint works without a database connection', async () => {
  const response = await request(app).get('/health').expect(200)
  assert.deepEqual(response.body, { status: 'ok', service: 'learnly-api' })
  assert.ok(response.headers['x-content-type-options'])
})

test('CORS allows the documented local frontend origins', async () => {
  const response = await request(app)
    .get('/health')
    .set('Origin', 'http://127.0.0.1:5173')
    .expect(200)
  assert.equal(response.headers['access-control-allow-origin'], 'http://127.0.0.1:5173')
})

test('unknown routes return a structured 404 response', async () => {
  const response = await request(app).get('/not-a-route').expect(404)
  assert.equal(response.body.error.message, 'Route not found: GET /not-a-route')
})

test('protected profile route rejects missing bearer tokens', async () => {
  const response = await request(app).get('/api/auth/me').expect(401)
  assert.equal(response.body.error.message, 'A bearer access token is required.')
})

test('course, quiz, assignment, and admin endpoints reject requests without authentication', async () => {
  const responses = await Promise.all([
    request(app).post('/api/courses').send({}),
    request(app).post('/api/courses/507f1f77bcf86cd799439011/enroll').send({}),
    request(app).post('/api/quizzes').send({}),
    request(app).post('/api/assignments').send({}),
    request(app).get('/api/users'),
    request(app).get('/api/assistant/courses'),
    request(app).get('/api/assistant/status'),
    request(app).get('/api/coding/problems'),
    request(app).post('/api/coding/problems/507f1f77bcf86cd799439011/run').send({ language: 'python', sourceCode: 'print(1)' }),
    request(app).get('/api/exams'),
    request(app).post('/api/exams').send({}),
    request(app).get('/api/exams/attempts/me'),
    request(app).get('/api/exams/admin/reports'),
  ])
  for (const response of responses) {
    assert.equal(response.status, 401)
    assert.equal(response.body.error.message, 'A bearer access token is required.')
  }
})

test('role and teacher approval middleware denies unauthorized portal actions', () => {
  let roleError
  authorize('admin')({ user: { role: 'student' } }, {}, (error) => { roleError = error })
  assert.equal(roleError.status, 403)

  let approvalError
  requireApprovedTeacher({ user: { role: 'teacher', approvalStatus: 'pending' } }, {}, (error) => { approvalError = error })
  assert.equal(approvalError.status, 403)

  let allowed
  authorize('student')({ user: { role: 'student' } }, {}, () => { allowed = true })
  assert.equal(allowed, true)
})

test('registration refuses admin role and weak passwords', () => {
  const adminRegistration = schemas.registerSchema.safeParse({
    body: { name: 'Bad Admin', email: 'person@example.test', password: 'LongPassword123', role: 'admin' },
  })
  assert.equal(adminRegistration.success, false)
  const weakPassword = schemas.registerSchema.safeParse({
    body: { name: 'New Student', email: 'person@example.test', password: 'short', role: 'student' },
  })
  assert.equal(weakPassword.success, false)
})

test('course updates accept partial fields and reject empty patches', () => {
  const valid = schemas.courseUpdateSchema.safeParse({ params: { courseId: '507f1f77bcf86cd799439011' }, body: { status: 'published' } })
  const lessonIdPreserved = schemas.courseUpdateSchema.safeParse({
    params: { courseId: '507f1f77bcf86cd799439011' },
    body: { lessons: [{ _id: '507f1f77bcf86cd799439012', title: 'Existing lesson' }] },
  })
  const empty = schemas.courseUpdateSchema.safeParse({ params: { courseId: '507f1f77bcf86cd799439011' }, body: {} })
  assert.equal(valid.success, true)
  assert.equal(lessonIdPreserved.success, true)
  assert.equal(empty.success, false)
})

test('assistant inputs require valid course/conversation IDs and bounded questions', () => {
  const courseId = '507f1f77bcf86cd799439011'
  const conversationId = '507f1f77bcf86cd799439012'
  assert.equal(schemas.assistantCourseSchema.safeParse({ body: { courseId } }).success, true)
  assert.equal(schemas.assistantCourseSchema.safeParse({ body: { courseId: 'not-an-id' } }).success, false)
  assert.equal(schemas.assistantMessageSchema.safeParse({
    params: { conversationId },
    body: { question: 'Explain this idea with an example', topic: 'Fundamentals' },
  }).success, true)
  assert.equal(schemas.assistantMessageSchema.safeParse({
    params: { conversationId },
    body: { question: 'x'.repeat(2001), topic: 'Fundamentals' },
  }).success, false)
  assert.equal(schemas.courseUpdateSchema.safeParse({
    params: { courseId },
    body: { studyNotes: 'Useful course notes' },
  }).success, true)
})

test('student assistant routes require authentication', async () => {
  const response = await request(app)
    .post('/api/assistant/conversations')
    .send({ courseId: '507f1f77bcf86cd799439011' })
    .expect(401)
  assert.equal(response.body.error.message, 'A bearer access token is required.')
})

test('assistant demo mode is explicit and configured provider receives course notes server-side', async () => {
  const course = {
    title: 'Statistics',
    category: 'Statistics',
    description: 'Learn probability and data analysis.',
    objectives: ['Interpret probability'],
    lessons: [{ title: 'Probability', topic: 'Probability', description: 'Events and likelihood.' }],
    studyNotes: 'A probability is a number from zero to one that describes likelihood.',
  }
  const demo = await answerLearningQuestion({ course, question: 'Explain probability', topic: 'Probability', history: [] })
  assert.equal(demo.mode, 'demo')
  assert.match(demo.answer, /Demo mode/)
  assert.match(demo.answer, /probability is a number/)

  const originalFetch = globalThis.fetch
  const oldConfig = { key: env.AI_API_KEY, url: env.AI_API_URL, model: env.AI_MODEL }
  let capturedRequest
  try {
    env.AI_API_KEY = 'server-only-test-key'
    env.AI_API_URL = 'https://provider.example.test/chat/completions'
    env.AI_MODEL = 'test-model'
    globalThis.fetch = async (url, options) => {
      capturedRequest = { url, options }
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'Probability measures how likely an event is. For example, a fair coin has a 1/2 chance of heads.' } }] }) }
    }
    const result = await answerLearningQuestion({ course, question: 'Explain probability', topic: 'Probability', history: [] })
    assert.equal(result.mode, 'ai')
    assert.match(result.answer, /fair coin/)
    assert.equal(capturedRequest.url, env.AI_API_URL)
    assert.equal(capturedRequest.options.headers.Authorization, 'Bearer server-only-test-key')
    assert.match(JSON.parse(capturedRequest.options.body).messages[0].content, /A probability is a number/)
  } finally {
    globalThis.fetch = originalFetch
    env.AI_API_KEY = oldConfig.key
    env.AI_API_URL = oldConfig.url
    env.AI_MODEL = oldConfig.model
  }
})

test('coding problem and execution inputs are validated and runner fails closed when unconfigured', async () => {
  const problemBody = {
    title: 'Add two values',
    difficulty: 'beginner',
    description: 'Read two values and print their sum.',
    sampleCases: [{ input: '2 3\n', output: '5\n' }],
    testCases: [{ input: '2 3\n', output: '5\n' }],
    published: true,
  }
  assert.equal(schemas.codingProblemSchema.safeParse({ body: problemBody }).success, true)
  assert.equal(schemas.codingProblemSchema.safeParse({ body: { ...problemBody, difficulty: 'expert' } }).success, false)
  assert.equal(schemas.codingRunSchema.safeParse({
    params: { problemId: '507f1f77bcf86cd799439011' },
    body: { language: 'python', sourceCode: 'print(1)', stdin: '' },
  }).success, true)
  assert.equal(schemas.codingRunSchema.safeParse({
    params: { problemId: '507f1f77bcf86cd799439011' },
    body: { language: 'ruby', sourceCode: 'puts 1' },
  }).success, false)
  await assert.rejects(executeCode({ language: 'python', sourceCode: 'print(1)', stdin: '' }), {
    status: 503,
    message: 'Code execution is not configured. Set CODE_RUNNER_API_URL to a trusted Judge0-compatible sandbox.',
  })
})

test('examination schemas validate types, answer-key indexes, marks totals, and partial updates', () => {
  const examId = '507f1f77bcf86cd799439011'
  const validBody = {
    title: 'Statistics midterm',
    courseId: examId,
    durationMinutes: 45,
    totalMarks: 5,
    passingMarks: 3,
    questions: [
      { type: 'mcq', prompt: 'What is the mean?', marks: 2, choices: [{ text: 'Average' }, { text: 'Median' }], correctAnswerIndices: [0] },
      { type: 'multiple_select', prompt: 'Select prime numbers.', marks: 2, choices: [{ text: '2' }, { text: '4' }, { text: '5' }], correctAnswerIndices: [0, 2] },
      { type: 'short_answer', prompt: 'Explain the median.', marks: 1 },
    ],
  }
  assert.equal(schemas.examSchema.safeParse({ body: validBody }).success, true)
  assert.equal(schemas.examSchema.safeParse({ body: { ...validBody, totalMarks: 4 } }).success, false)
  assert.equal(schemas.examSchema.safeParse({ body: { ...validBody, passingMarks: 6 } }).success, false)
  assert.equal(schemas.examSchema.safeParse({
    body: { ...validBody, questions: [{ ...validBody.questions[0], correctAnswerIndices: [3] }, ...validBody.questions.slice(1)] },
  }).success, false)
  assert.equal(schemas.examSchema.safeParse({
    body: { ...validBody, questions: [{ type: 'true_false', prompt: 'Is 2 even?', marks: 5, choices: [{ text: 'True' }, { text: 'False' }], correctAnswerIndices: [0] }], totalMarks: 5 },
  }).success, true)
  assert.equal(schemas.examUpdateSchema.safeParse({ params: { examId }, body: { published: true } }).success, true)
  assert.equal(schemas.examUpdateSchema.safeParse({ params: { examId }, body: {} }).success, false)
})

test('objective exam scoring requires exactly the server-defined choice set', () => {
  const question = { correctAnswers: ['choice-a', 'choice-c'], marks: 4 }
  assert.equal(scoreObjectiveQuestion(question, ['choice-c', 'choice-a']), 4)
  assert.equal(scoreObjectiveQuestion(question, ['choice-a']), 0)
  assert.equal(scoreObjectiveQuestion(question, ['choice-a', 'choice-b']), 0)
  assert.equal(scoreObjectiveQuestion(question, ['choice-a', 'choice-a', 'choice-c']), 4)
})

test('configured coding runner receives resource limits and returns sandbox output', async () => {
  const originalFetch = globalThis.fetch
  const oldConfig = {
    url: env.CODE_RUNNER_API_URL,
    key: env.CODE_RUNNER_API_KEY,
    python: env.CODE_RUNNER_PYTHON_ID,
  }
  let submitted
  try {
    env.CODE_RUNNER_API_URL = 'https://judge.example.test/api'
    env.CODE_RUNNER_API_KEY = 'server-side-test-key'
    env.CODE_RUNNER_PYTHON_ID = 71
    globalThis.fetch = async (url, options) => {
      submitted = { url: String(url), options }
      return {
        ok: true,
        json: async () => ({ status: { id: 3, description: 'Accepted' }, stdout: '5\n', time: '0.01', memory: 1000 }),
      }
    }
    const result = await executeCode({ language: 'python', sourceCode: 'print(2 + 3)', stdin: '' })
    const body = JSON.parse(submitted.options.body)
    assert.equal(submitted.url, 'https://judge.example.test/api/submissions?base64_encoded=false&wait=true')
    assert.equal(submitted.options.headers['X-Auth-Token'], 'server-side-test-key')
    assert.equal(body.language_id, 71)
    assert.equal(body.cpu_time_limit, 2)
    assert.equal(body.wall_time_limit, 4)
    assert.equal(body.memory_limit, 128000)
    assert.equal(body.max_file_size, 1024)
    assert.equal(result.stdout, '5\n')
    assert.equal(result.status, 'Accepted')
  } finally {
    globalThis.fetch = originalFetch
    env.CODE_RUNNER_API_URL = oldConfig.url
    env.CODE_RUNNER_API_KEY = oldConfig.key
    env.CODE_RUNNER_PYTHON_ID = oldConfig.python
  }
})

test('quiz scoring is server-calculated and rejects missing or out-of-range answers', () => {
  const questions = [
    { topic: 'Statistics', choices: ['mean', 'mode'], correctAnswer: 0 },
    { topic: 'Algorithms', choices: ['queue', 'stack', 'graph'], correctAnswer: 1 },
  ]
  const result = scoreQuiz(questions, [0, 1])
  assert.equal(result.score, 100)
  assert.equal(result.correctCount, 2)
  assert.deepEqual(result.topicResults, [
    { topic: 'Statistics', correct: true },
    { topic: 'Algorithms', correct: true },
  ])
  assert.throws(() => scoreQuiz(questions, [0]), { message: 'Submit exactly one answer for each quiz question.' })
  assert.throws(() => scoreQuiz(questions, [0, 4]), { message: 'Answer 2 is not a valid choice.' })
})

test('pagination is bounded to prevent oversized list responses', () => {
  assert.deepEqual(paginationFrom({ page: '0', limit: '9999' }), { page: 1, limit: 100, skip: 0 })
  assert.deepEqual(paginationFrom({ page: '3', limit: '10' }), { page: 3, limit: 10, skip: 20 })
})
