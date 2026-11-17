import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'

const languageIds = {
  python: env.CODE_RUNNER_PYTHON_ID,
  c: env.CODE_RUNNER_C_ID,
  cpp: env.CODE_RUNNER_CPP_ID,
  java: env.CODE_RUNNER_JAVA_ID,
}

function decodeResult(result) {
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    compileOutput: result.compile_output || '',
    status: result.status?.description || 'Unknown',
    time: result.time || null,
    memory: result.memory || null,
  }
}

async function runnerRequest(url, options) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(8000) })
  } catch {
    throw new HttpError(502, 'The code sandbox is unavailable. Please try again later.')
  }
}

export async function executeCode({ language, sourceCode, stdin }) {
  if (!env.CODE_RUNNER_API_URL) {
    throw new HttpError(503, 'Code execution is not configured. Set CODE_RUNNER_API_URL to a trusted Judge0-compatible sandbox.')
  }

  const endpoint = new URL(env.CODE_RUNNER_API_URL)
  endpoint.pathname = `${endpoint.pathname.replace(/\/+$/, '')}/submissions`
  endpoint.searchParams.set('base64_encoded', 'false')
  endpoint.searchParams.set('wait', 'true')

  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (env.CODE_RUNNER_API_KEY) headers['X-Auth-Token'] = env.CODE_RUNNER_API_KEY
  const response = await runnerRequest(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      language_id: languageIds[language],
      source_code: sourceCode,
      stdin,
      cpu_time_limit: 2,
      cpu_extra_time: 0.5,
      wall_time_limit: 4,
      max_file_size: 1024,
      memory_limit: 128000,
      max_processes_and_or_threads: 20,
      enable_per_process_and_thread_time_limit: true,
    }),
  })
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(502, 'The code sandbox rejected its server credentials.')
  }
  if (!response.ok) throw new HttpError(502, 'The code sandbox could not process this submission.')

  let result
  try {
    result = await response.json()
  } catch {
    throw new HttpError(502, 'The code sandbox returned an invalid response.')
  }

  if (result.token && !result.status?.id) {
    const pollUrl = new URL(`${env.CODE_RUNNER_API_URL.replace(/\/+$/, '')}/submissions/${encodeURIComponent(result.token)}`)
    pollUrl.searchParams.set('base64_encoded', 'false')
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      const pollResponse = await runnerRequest(pollUrl, { headers })
      if (!pollResponse.ok) throw new HttpError(502, 'The code sandbox could not return the submission result.')
      result = await pollResponse.json()
      if (![1, 2].includes(result.status?.id)) break
    }
  }
  if (!result.status || [1, 2].includes(result.status.id)) {
    throw new HttpError(504, 'Code execution exceeded the sandbox wait limit. Please try again.')
  }
  return decodeResult(result)
}
