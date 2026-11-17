import { CodingProblem } from '../models/CodingProblem.js'
import { CodingSubmission } from '../models/CodingSubmission.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { paginationFrom, pageInfo } from '../utils/pagination.js'
import { executeCode } from '../services/codeRunner.js'

const publicProblem = (problem) => {
  const item = problem.toObject ? problem.toObject() : problem
  delete item.testCases
  return item
}

async function loadManagedProblem(problemId, user) {
  const problem = await CodingProblem.findById(problemId)
  if (!problem) throw new HttpError(404, 'Coding problem not found.')
  if (user.role !== 'admin' && String(problem.author) !== user.id) {
    throw new HttpError(403, 'You can only manage coding problems you created.')
  }
  return problem
}

async function visibleProblem(problemId, user) {
  const problem = await CodingProblem.findById(problemId)
  if (!problem || (!problem.published && user.role !== 'admin' && String(problem.author) !== user.id)) {
    throw new HttpError(404, 'Coding problem not found.')
  }
  return problem
}

async function runCases(problem, language, sourceCode, testCases) {
  const results = []
  for (const testCase of testCases) {
    const result = await executeCode({ language, sourceCode, stdin: testCase.input })
    if (result.status !== 'Accepted') {
      const status = /compilation/i.test(result.status) ? 'compile_error'
        : /time limit/i.test(result.status) ? 'time_limit'
          : /runtime/i.test(result.status) ? 'runtime_error' : 'error'
      return { results, status, output: result.compileOutput || result.stderr || result.status }
    }
    const actualOutput = result.stdout.trim()
    const passed = actualOutput === testCase.output.trim()
    results.push({ passed, expected: testCase.output, actual: result.stdout })
    if (!passed) return { results, status: 'wrong_answer', output: result.stdout }
  }
  return { results, status: 'accepted', output: results.map(({ actual }) => actual).join('\n') }
}

export const listProblems = asyncHandler(async (req, res) => {
  const filter = { published: true }
  if (req.validated.query.difficulty) filter.difficulty = req.validated.query.difficulty
  const problems = await CodingProblem.find(filter).select('-testCases').sort({ createdAt: 1 })
  const difficultyOrder = { beginner: 0, intermediate: 1, advanced: 2 }
  problems.sort((left, right) => difficultyOrder[left.difficulty] - difficultyOrder[right.difficulty])
  const accepted = await CodingSubmission.find({ student: req.user.id, status: 'accepted' }).distinct('problem')
  const solvedIds = new Set(accepted.map(String))
  res.json({ data: problems.map((problem) => ({ ...publicProblem(problem), solved: solvedIds.has(problem.id) })) })
})

export const getProblem = asyncHandler(async (req, res) => {
  const problem = await visibleProblem(req.params.problemId, req.user)
  res.json({ data: publicProblem(problem) })
})

export const createProblem = asyncHandler(async (req, res) => {
  const problem = await CodingProblem.create({ ...req.validated.body, author: req.user.id })
  res.status(201).json({ data: publicProblem(problem) })
})

export const listManagedProblems = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { author: req.user.id }
  if (req.validated.query.status) filter.published = req.validated.query.status === 'published'
  if (req.validated.query.difficulty) filter.difficulty = req.validated.query.difficulty
  const problems = await CodingProblem.find(filter).sort({ updatedAt: -1 })
  res.json({ data: problems })
})

export const updateProblem = asyncHandler(async (req, res) => {
  const problem = await loadManagedProblem(req.params.problemId, req.user)
  Object.assign(problem, req.validated.body)
  await problem.save()
  res.json({ data: publicProblem(problem) })
})

export const deleteProblem = asyncHandler(async (req, res) => {
  const problem = await loadManagedProblem(req.params.problemId, req.user)
  await Promise.all([
    problem.deleteOne(),
    CodingSubmission.deleteMany({ problem: problem.id }),
  ])
  res.json({ data: { message: 'Coding problem and its submissions were deleted.' } })
})

export const runProblem = asyncHandler(async (req, res) => {
  const problem = await visibleProblem(req.params.problemId, req.user)
  const { language, sourceCode, stdin } = req.validated.body
  const result = await executeCode({ language, sourceCode, stdin })
  res.json({ data: { ...result, status: result.status === 'Accepted' ? 'success' : 'error' } })
})

export const submitSolution = asyncHandler(async (req, res) => {
  const problem = await visibleProblem(req.params.problemId, req.user)
  const { language, sourceCode } = req.validated.body
  const evaluated = await runCases(problem, language, sourceCode, problem.testCases)
  const submission = await CodingSubmission.create({
    student: req.user.id,
    problem: problem.id,
    language,
    sourceCode,
    status: evaluated.status,
    passedTests: evaluated.results.filter(({ passed }) => passed).length,
    totalTests: problem.testCases.length,
    output: evaluated.output.slice(0, 10000),
  })
  res.status(201).json({
    data: {
      submission,
      passedTests: submission.passedTests,
      totalTests: submission.totalTests,
      solved: evaluated.status === 'accepted',
      results: evaluated.results.map(({ passed }) => ({ passed })),
    },
  })
})

export const mySubmissions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req.query)
  const [submissions, total] = await Promise.all([
    CodingSubmission.find({ student: req.user.id }).populate('problem', 'title difficulty')
      .select('-sourceCode').sort({ createdAt: -1 }).skip(skip).limit(limit),
    CodingSubmission.countDocuments({ student: req.user.id }),
  ])
  res.json({ data: submissions, pagination: pageInfo(page, limit, total) })
})

export const codingProgress = asyncHandler(async (req, res) => {
  const [attempted, solved, submissions] = await Promise.all([
    CodingSubmission.distinct('problem', { student: req.user.id }),
    CodingSubmission.distinct('problem', { student: req.user.id, status: 'accepted' }),
    CodingSubmission.countDocuments({ student: req.user.id }),
  ])
  res.json({ data: { attempted: attempted.length, solved: solved.length, submissions } })
})

export const codingLeaderboard = asyncHandler(async (_req, res) => {
  const leaders = await CodingSubmission.aggregate([
    { $match: { status: 'accepted' } },
    { $group: { _id: { student: '$student', problem: '$problem' }, solvedAt: { $min: '$createdAt' } } },
    { $group: { _id: '$_id.student', solved: { $sum: 1 }, lastSolved: { $max: '$solvedAt' } } },
    { $sort: { solved: -1, lastSolved: 1 } },
    { $limit: 20 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: { _id: 0, name: '$user.name', solved: 1 } },
  ])
  res.json({ data: leaders })
})

export const adminCodingActivity = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req.query)
  const [items, total, problemCount] = await Promise.all([
    CodingSubmission.find().populate('student', 'name email').populate('problem', 'title difficulty')
      .select('-sourceCode').sort({ createdAt: -1 }).skip(skip).limit(limit),
    CodingSubmission.countDocuments(),
    CodingProblem.countDocuments(),
  ])
  res.json({ data: { submissions: items, problemCount, submissionCount: total, pagination: pageInfo(page, limit, total) } })
})
