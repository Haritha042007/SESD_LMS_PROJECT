import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid identifier.')
const name = z.string().trim().min(2).max(100)
const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase())
const password = z.string().min(10).max(128).regex(/[a-z]/, 'Password needs a lowercase letter.')
  .regex(/[A-Z]/, 'Password needs an uppercase letter.')
  .regex(/\d/, 'Password needs a number.')
const httpUrl = (max = 2048) => z.string().url().max(max)
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'URL must use HTTP or HTTPS.')

const lesson = z.object({
  _id: objectId.optional(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().default(''),
  videoUrl: httpUrl().optional().or(z.literal('')).default(''),
  durationMinutes: z.coerce.number().min(0).max(10000).optional().default(0),
  topic: z.string().trim().max(100).optional().default('General'),
  resources: z.array(z.object({
    title: z.string().trim().min(1).max(160),
    url: httpUrl(),
    type: z.enum(['video', 'document', 'link', 'file']).default('link'),
  }).strict()).max(30).optional().default([]),
}).strict()

export const registerSchema = z.object({
  body: z.object({
    name, email, password,
    role: z.enum(['student', 'teacher']).default('student'),
    bio: z.string().trim().max(1000).optional(),
    interests: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  }).strict(),
})

export const loginSchema = z.object({
  body: z.object({ email, password: z.string().min(1).max(128) }).strict(),
})

export const updateProfileSchema = z.object({
  body: z.object({
    name: name.optional(),
    bio: z.string().trim().max(1000).optional(),
    avatarUrl: httpUrl(500).optional().or(z.literal('')),
    interests: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    currentPassword: z.string().min(1).max(128).optional(),
    newPassword: password.optional(),
  }).strict().refine((value) => !value.newPassword || Boolean(value.currentPassword), {
    message: 'Current password is required to change your password.',
  }),
})

export const listSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().max(120).optional(),
    category: z.string().trim().max(80).optional(),
    level: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
    status: z.enum(['draft', 'published', 'archived', 'active', 'disabled', 'pending', 'approved', 'rejected']).optional(),
    role: z.enum(['student', 'teacher', 'admin']).optional(),
    courseId: objectId.optional(),
    assignmentId: objectId.optional(),
  }).strict(),
})

export const courseSchema = z.object({
  body: z.object({
    title: z.string().trim().min(4).max(160),
    description: z.string().trim().min(20).max(5000),
    category: z.string().trim().min(2).max(80),
    level: z.enum(['Beginner', 'Intermediate', 'Advanced']).default('Beginner'),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    lessons: z.array(lesson).max(200).optional(),
    studyNotes: z.string().trim().max(50000).optional().default(''),
    objectives: z.array(z.string().trim().min(1).max(300)).max(30).optional(),
  }).strict(),
  params: z.object({ courseId: objectId.optional() }).passthrough().optional(),
})

export const courseUpdateSchema = z.object({
  body: z.object({
    title: z.string().trim().min(4).max(160).optional(),
    description: z.string().trim().min(20).max(5000).optional(),
    category: z.string().trim().min(2).max(80).optional(),
    level: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    lessons: z.array(lesson).max(200).optional(),
    studyNotes: z.string().trim().max(50000).optional(),
    objectives: z.array(z.string().trim().min(1).max(300)).max(30).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update.'),
  params: z.object({ courseId: objectId }),
})

export const assistantCourseSchema = z.object({
  body: z.object({ courseId: objectId }).strict(),
})

export const assistantListSchema = z.object({
  query: z.object({ courseId: objectId }).strict(),
})

export const assistantConversationSchema = z.object({
  params: z.object({ conversationId: objectId }).strict(),
})

export const assistantMessageSchema = z.object({
  params: z.object({ conversationId: objectId }).strict(),
  body: z.object({
    question: z.string().trim().min(2).max(2000),
    topic: z.string().trim().min(1).max(100),
  }).strict(),
})

const codingLanguage = z.enum(['python', 'c', 'cpp', 'java'])
const codingDifficulty = z.enum(['beginner', 'intermediate', 'advanced'])
const codingTestCase = z.object({
  input: z.string().max(2000),
  output: z.string().max(2000),
}).strict()

export const codingProblemSchema = z.object({
  body: z.object({
    title: z.string().trim().min(4).max(160),
    difficulty: codingDifficulty,
    description: z.string().trim().min(20).max(5000),
    inputDescription: z.string().trim().max(2000).optional().default(''),
    outputDescription: z.string().trim().max(2000).optional().default(''),
    sampleCases: z.array(codingTestCase).min(1).max(3),
    testCases: z.array(codingTestCase).min(1).max(5),
    starterCode: z.object({
      python: z.string().max(10000).optional().default(''),
      c: z.string().max(10000).optional().default(''),
      cpp: z.string().max(10000).optional().default(''),
      java: z.string().max(10000).optional().default(''),
    }).strict().optional().default({}),
    published: z.boolean().optional().default(false),
  }).strict(),
})

export const codingProblemUpdateSchema = z.object({
  params: z.object({ problemId: objectId }),
  body: z.object({
    title: z.string().trim().min(4).max(160).optional(),
    difficulty: codingDifficulty.optional(),
    description: z.string().trim().min(20).max(5000).optional(),
    inputDescription: z.string().trim().max(2000).optional(),
    outputDescription: z.string().trim().max(2000).optional(),
    sampleCases: z.array(codingTestCase).min(1).max(3).optional(),
    testCases: z.array(codingTestCase).min(1).max(5).optional(),
    starterCode: z.object({
      python: z.string().max(10000).optional(),
      c: z.string().max(10000).optional(),
      cpp: z.string().max(10000).optional(),
      java: z.string().max(10000).optional(),
    }).strict().optional(),
    published: z.boolean().optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update.'),
})

export const codingProblemParamSchema = z.object({ params: z.object({ problemId: objectId }) })

export const codingListSchema = z.object({
  query: z.object({
    difficulty: codingDifficulty.optional(),
    language: codingLanguage.optional(),
    status: z.enum(['draft', 'published']).optional(),
  }).strict(),
})

export const codingRunSchema = z.object({
  params: z.object({ problemId: objectId }),
  body: z.object({
    language: codingLanguage,
    sourceCode: z.string().min(1).max(20000),
    stdin: z.string().max(5000).optional().default(''),
  }).strict(),
})

const examChoice = z.object({ text: z.string().trim().min(1).max(500) }).strict()
const examQuestion = z.object({
  type: z.enum(['mcq', 'multiple_select', 'true_false', 'short_answer']),
  prompt: z.string().trim().min(5).max(2000),
  choices: z.array(examChoice).max(10).optional().default([]),
  correctAnswerIndices: z.array(z.coerce.number().int().min(0)).max(10).optional().default([]),
  acceptedAnswers: z.array(z.string().trim().min(1).max(300)).max(20).optional().default([]),
  marks: z.coerce.number().int().min(1).max(1000),
}).strict().superRefine((question, ctx) => {
  if (new Set(question.correctAnswerIndices).size !== question.correctAnswerIndices.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['correctAnswerIndices'], message: 'Correct choices cannot be duplicated.' })
  }
  if (question.type === 'short_answer') {
    if (question.choices.length || question.correctAnswerIndices.length || question.acceptedAnswers.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Short-answer questions are manually graded and cannot contain objective answer keys.' })
    }
    return
  }
  if (question.choices.length < 2 || question.correctAnswerIndices.length < 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Objective questions need at least two choices and one correct answer.' })
  }
  if (question.correctAnswerIndices.some((index) => index >= question.choices.length)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['correctAnswerIndices'], message: 'Correct choice index is out of range.' })
  }
  if (question.type !== 'multiple_select' && question.correctAnswerIndices.length !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['correctAnswerIndices'], message: 'This question type requires exactly one correct choice.' })
  }
  if (question.type === 'true_false' && (question.choices.length !== 2 || !['true', 'false'].every((value) => question.choices.some((choice) => choice.text.toLowerCase() === value)))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['choices'], message: 'True/false questions must have True and False choices.' })
  }
})

const examFields = {
  title: z.string().trim().min(4).max(160),
  instructions: z.string().trim().max(5000).optional().default(''),
  courseId: objectId,
  durationMinutes: z.coerce.number().int().min(1).max(360),
  totalMarks: z.coerce.number().int().min(1).max(10000),
  passingMarks: z.coerce.number().int().min(0).max(10000),
  randomizeQuestions: z.boolean().optional().default(true),
  randomizeChoices: z.boolean().optional().default(true),
  published: z.boolean().optional().default(false),
  questions: z.array(examQuestion).min(1).max(100),
}

function validateExamTotals(value, ctx) {
  if (value.questions && value.totalMarks !== undefined) {
    const sum = value.questions.reduce((total, question) => total + question.marks, 0)
    if (sum !== value.totalMarks) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['totalMarks'], message: `Total marks must equal the question marks sum (${sum}).` })
  }
  if (value.passingMarks !== undefined && value.totalMarks !== undefined && value.passingMarks > value.totalMarks) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['passingMarks'], message: 'Passing marks cannot exceed total marks.' })
  }
}

export const examSchema = z.object({ body: z.object(examFields).strict().superRefine(validateExamTotals) })

export const examUpdateSchema = z.object({
  params: z.object({ examId: objectId }),
  body: z.object({
    title: examFields.title.optional(),
    instructions: z.string().trim().max(5000).optional(),
    durationMinutes: examFields.durationMinutes.optional(),
    totalMarks: examFields.totalMarks.optional(),
    passingMarks: examFields.passingMarks.optional(),
    randomizeQuestions: z.boolean().optional(),
    randomizeChoices: z.boolean().optional(),
    published: z.boolean().optional(),
    questions: examFields.questions.optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update.')
    .superRefine(validateExamTotals),
})

export const examListSchema = z.object({
  query: z.object({
    courseId: objectId.optional(),
    status: z.enum(['draft', 'published']).optional(),
  }).strict(),
})

export const examParamSchema = z.object({ params: z.object({ examId: objectId }) })

export const examSubmitSchema = z.object({
  params: z.object({ attemptId: objectId }),
  body: z.object({
    answers: z.array(z.object({
      questionId: objectId,
      selectedChoices: z.array(objectId).max(10).optional().default([]),
      text: z.string().trim().max(5000).optional().default(''),
    }).strict()).max(100),
  }).strict(),
})

export const examGradeSchema = z.object({
  params: z.object({ attemptId: objectId }),
  body: z.object({
    grades: z.array(z.object({
      questionId: objectId,
      marksAwarded: z.coerce.number().min(0),
      feedback: z.string().trim().max(2000).optional().default(''),
    }).strict()).max(100),
    feedback: z.string().trim().max(5000).optional().default(''),
  }).strict(),
})

export const idParamSchema = (key) => z.object({ params: z.object({ [key]: objectId }).passthrough() })

export const progressSchema = z.object({
  params: z.object({ courseId: objectId, lessonId: objectId }),
})

export const studySessionSchema = z.object({
  body: z.object({
    courseId: objectId.optional(),
    durationMinutes: z.coerce.number().int().min(1).max(1440),
  }).strict(),
})

export const quizSchema = z.object({
  body: z.object({
    title: z.string().trim().min(4).max(160),
    courseId: objectId,
    passingScore: z.coerce.number().int().min(1).max(100).default(70),
    published: z.boolean().default(false),
    questions: z.array(z.object({
      prompt: z.string().trim().min(5).max(1000),
      topic: z.string().trim().max(100).default('General'),
      choices: z.array(z.string().trim().min(1).max(300)).min(2).max(6),
      correctAnswer: z.coerce.number().int().min(0),
      explanation: z.string().trim().max(1000).optional().default(''),
    }).strict().superRefine((question, ctx) => {
      if (question.correctAnswer >= question.choices.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['correctAnswer'], message: 'Correct answer must reference an available choice.' })
      }
    })).min(1).max(100),
  }).strict(),
})

export const quizSubmitSchema = z.object({
  params: z.object({ quizId: objectId }),
  body: z.object({ answers: z.array(z.coerce.number().int().min(0)).min(1).max(100) }).strict(),
})

export const assignmentSchema = z.object({
  body: z.object({
    title: z.string().trim().min(4).max(160),
    instructions: z.string().trim().min(8).max(5000),
    courseId: objectId,
    dueAt: z.coerce.date().optional(),
    maxScore: z.coerce.number().int().min(1).max(1000).default(100),
    published: z.boolean().default(true),
  }).strict(),
})

export const submissionSchema = z.object({
  params: z.object({ assignmentId: objectId }),
  body: z.object({
    text: z.string().trim().max(10000).optional().default(''),
    fileUrl: httpUrl().optional().or(z.literal('')).default(''),
  }).strict().refine((value) => value.text.length > 0 || value.fileUrl.length > 0, {
    message: 'Provide submission text or a file URL.',
  }),
})

export const gradeSchema = z.object({
  params: z.object({ submissionId: objectId }),
  body: z.object({
    score: z.coerce.number().min(0),
    feedback: z.string().trim().min(1).max(5000),
  }).strict(),
})

export const certificateSchema = z.object({
  params: z.object({ courseId: objectId }),
})

export const verifyCertificateSchema = z.object({
  params: z.object({ certificateId: z.string().trim().min(4).max(100) }),
})

export const approvalSchema = z.object({
  params: z.object({ userId: objectId }),
  body: z.object({ decision: z.enum(['approved', 'rejected']) }).strict(),
})

export const adminUserUpdateSchema = z.object({
  params: z.object({ userId: objectId }),
  body: z.object({
    status: z.enum(['active', 'disabled']).optional(),
    role: z.enum(['student', 'teacher']).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'Provide a status or role to update.'),
})

export const categorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(500).optional().default(''),
  }).strict(),
})

export const updateCategorySchema = z.object({
  params: z.object({ categoryId: objectId }),
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(500).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'Provide a category name or description.'),
})
