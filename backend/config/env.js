import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/learnly_lms'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters.'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  AI_RECOMMENDATION_URL: z.string().url().optional().or(z.literal('')),
  AI_RECOMMENDATION_API_KEY: z.string().optional(),
  AI_API_URL: z.string().url().default('https://api.openai.com/v1/chat/completions')
    .refine((value) => new URL(value).protocol === 'https:', 'AI_API_URL must use HTTPS.'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().trim().min(1).max(100).default('gpt-4o-mini'),
  CODE_RUNNER_API_URL: z.string().url().optional().or(z.literal(''))
    .refine((value) => !value || new URL(value).protocol === 'https:', 'CODE_RUNNER_API_URL must use HTTPS.'),
  CODE_RUNNER_API_KEY: z.string().optional(),
  CODE_RUNNER_PYTHON_ID: z.coerce.number().int().positive().default(71),
  CODE_RUNNER_C_ID: z.coerce.number().int().positive().default(50),
  CODE_RUNNER_CPP_ID: z.coerce.number().int().positive().default(54),
  CODE_RUNNER_JAVA_ID: z.coerce.number().int().positive().default(62),
})

const result = envSchema.safeParse(process.env)
if (!result.success) {
  console.error('Invalid environment configuration:', result.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = result.data
