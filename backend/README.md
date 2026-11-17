# Learnly LMS API

An Express and MongoDB REST API for the student, teacher, and admin portals. Passwords are bcrypt-hashed; protected routes use short-lived HS256 JWT bearer tokens. Database configuration, authentication, request validation, and route authorization are implemented rather than mocked.

## Requirements and setup

- Node.js 18 or newer and npm
- MongoDB 6 or newer, running locally or through a MongoDB service

From this folder:

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` and set a random `JWT_SECRET` of at least 32 characters and a MongoDB connection string. For a local MongoDB server, the example URI is:

```text
mongodb://127.0.0.1:27017/learnly_lms
```

The learning assistant runs in clearly labeled demo mode unless you configure an OpenAI-compatible HTTPS endpoint in the backend environment:

```dotenv
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_API_KEY=
AI_MODEL=gpt-4o-mini
```

Never put the provider key in frontend environment variables. Provider requests use a server-side timeout and the HTTPS URL is validated at startup. Check your provider's privacy and data-retention terms before enabling it.

The coding playground requires a separate Judge0-compatible sandbox endpoint. Execution stays disabled until you configure one:

```dotenv
CODE_RUNNER_API_URL=https://your-trusted-judge0-host.example/api
CODE_RUNNER_API_KEY=
CODE_RUNNER_PYTHON_ID=71
CODE_RUNNER_C_ID=50
CODE_RUNNER_CPP_ID=54
CODE_RUNNER_JAVA_ID=62
```

Use a trusted HTTPS Judge0 deployment and keep its API key on the backend only. Configure the numeric language IDs to match that deployment. The API applies a 12-execution/minute rate limit, 20,000-character source limit, 5,000-character standard-input limit, at most five private tests per problem, and sandbox CPU (2 seconds), wall-clock (4 seconds), memory (128 MB), and output-file size (1 MB) limits. The Express server never evaluates or shells out student code. If no runner URL is configured, execution returns HTTP 503 rather than simulated output.

Start the API:

```powershell
npm run dev
```

The API listens on `http://localhost:4000` by default. Check `http://localhost:4000/health`.

## Seed the demo database

Choose three different passwords (12+ characters) and set `SEED_ADMIN_PASSWORD`, `SEED_TEACHER_PASSWORD`, and `SEED_STUDENT_PASSWORD` in `.env`. Then run:

```powershell
npm run seed
```

The seed script upserts demo accounts, five courses, and three coding problems (one per difficulty): Add Two Numbers, Count Vowels, and Longest Increasing Subsequence Length. It creates:

| Role | Email |
|---|---|
| Admin | `admin@learnly.test` |
| Approved teacher | `teacher@learnly.test` |
| Student | `haritha@learnly.test` |

The passwords are set only from your environment and are never included in source code or printed by the seed script. New self-registered teachers need admin approval before using teacher write APIs. Public registration cannot create admin users.

## API conventions

- Prefix: `/api`
- Send JSON with `Content-Type: application/json`.
- Protected endpoints use `Authorization: Bearer <token>`.
- Successful responses use `{ "data": ... }`; lists include pagination metadata when applicable.
- Errors use `{ "error": { "message": "...", "details": [...] } }`.
- List pagination: `?page=1&limit=20` (maximum page size: 100).
- Request bodies are validated with Zod; unknown body fields are rejected.
- Teacher-created resources are restricted to the teacher's own courses. Student submission queries are scoped to the authenticated student.
- Course videos and assignment attachments are represented as HTTP(S) URLs. Binary upload/storage requires a storage provider and is not implemented.

## Endpoints

### Authentication and profile

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register` | Public; role `student` or `teacher` |
| POST | `/api/auth/login` | Public, rate-limited |
| POST | `/api/auth/logout` | Authenticated; revokes the current token and other sessions |
| GET | `/api/auth/me` | Authenticated |
| PATCH | `/api/auth/me` | Authenticated; profile or password update |

Password rules: 10–128 characters, with uppercase, lowercase, and a number. To change a password, provide both `currentPassword` and `newPassword`. A password change revokes existing sessions.

### Courses and categories

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/courses?search=&category=&level=&page=&limit=` | Public; published courses only |
| GET | `/api/courses/categories` | Public |
| GET | `/api/courses/:courseId` | Public course summary; enrolled students and course owners can access lesson resources |
| POST | `/api/courses` | Approved teacher or admin |
| GET | `/api/courses/manage` | Approved teacher (own courses) or admin |
| PATCH | `/api/courses/:courseId` | Approved course owner or admin |
| DELETE | `/api/courses/:courseId` | Approved course owner or admin |
| POST | `/api/courses/:courseId/enroll` | Student |
| POST | `/api/courses/admin/categories` | Admin |
| PATCH | `/api/courses/admin/categories/:categoryId` | Admin |
| DELETE | `/api/courses/admin/categories/:categoryId` | Admin; refuses categories still used by a course |

Course owners can add course notes through the `studyNotes` course field. It is plain text/Markdown (maximum 50,000 characters), stored in MongoDB, and included in assistant context only for enrolled students. The frontend accepts `.txt` and `.md` imports up to 100 KB each; it does not parse binary documents.

### Student learning assistant

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/assistant/courses` | Student; enrolled, published courses only |
| GET | `/api/assistant/conversations?courseId=:id` | Enrolled student; own course conversations |
| POST | `/api/assistant/conversations` | Enrolled student; body `{ "courseId": "..." }` |
| GET | `/api/assistant/conversations/:conversationId` | Conversation owner, while enrolled in the published course |
| POST | `/api/assistant/conversations/:conversationId/messages` | Conversation owner; body `{ "question": "...", "topic": "..." }` |
| DELETE | `/api/assistant/conversations?courseId=:id` | Enrolled student; clears own history for that course |

Conversation access is scoped to the authenticated student and their current course enrollment. Questions are limited to 2,000 characters and each conversation retains the latest 40 messages. Configured AI requests receive course descriptions, lesson details, teacher-provided notes, and recent conversation turns; arbitrary resource URLs are never fetched. Course notes and learner messages are treated as untrusted prompt data.

Without `AI_API_KEY`, the API responds in explicit demo mode with saved course-material excerpts; it does not claim to generate an AI explanation. The assistant page labels the response mode and exposes errors if the provider is unavailable.

### Coding playground

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/coding/problems` | Authenticated student; published problem statements, no hidden tests |
| GET | `/api/coding/problems/:problemId` | Authenticated; published problem, or unpublished problem by its author/admin |
| POST | `/api/coding/problems/:problemId/run` | Student; run once with supplied standard input |
| POST | `/api/coding/problems/:problemId/submit` | Student; evaluate against private test cases and persist result |
| GET | `/api/coding/submissions/me` | Student; own submission history without source code |
| GET | `/api/coding/progress/me` | Student; attempted/solved totals |
| GET | `/api/coding/leaderboard` | Authenticated; ranked by unique solved problems |
| GET | `/api/coding/manage/problems` | Approved teacher (own problems) or admin |
| POST | `/api/coding/problems` | Approved teacher or admin |
| PATCH | `/api/coding/problems/:problemId` | Approved author or admin |
| DELETE | `/api/coding/problems/:problemId` | Approved author or admin; also removes related submissions |
| GET | `/api/coding/admin/activity` | Admin; submission activity without source code |

Supported languages are Python, C, C++, and Java. Teachers can provide public sample cases and private submission tests separately. Private tests are not included in student problem payloads. Coding activity submissions retain source code for the student record but history and admin views do not return it. The leaderboard only counts each student's first accepted solution per problem.

The development seed script creates three published demonstration problems. Run `npm run seed` from `backend` after configuring the demo passwords to add them to an existing local database.

Deleting an enrolled course as its teacher archives it. An administrator can permanently delete a course; dependent enrollments, quizzes and attempts, assignments and submissions, exams and attempts, assistant conversations, and certificates are removed.

### Smart examinations

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/exams` | Approved teacher or admin; create for an owned course (admin may select any course) |
| GET | `/api/exams?courseId=:id&status=published` | Authenticated; students see published exams for enrolled courses, teachers see their courses, admins see all |
| PATCH | `/api/exams/:examId` | Approved exam owner or admin; edit metadata/questions or publish |
| DELETE | `/api/exams/:examId` | Approved exam owner or admin; only before any attempt exists |
| POST | `/api/exams/:examId/start` | Enrolled student; starts once or resumes the existing timed attempt |
| POST | `/api/exams/attempts/:attemptId/submit` | The student who owns the attempt; duplicate submission is rejected |
| GET | `/api/exams/attempts/me` | Student; own examination history |
| GET | `/api/exams/:examId/attempts` | Exam owner or admin; submissions for review |
| PATCH | `/api/exams/attempts/:attemptId/grade` | Exam owner or admin; grade all descriptive questions |
| GET | `/api/exams/admin/reports` | Admin; aggregate and recent attempt reporting |

Question types are `mcq`, `multiple_select`, `true_false`, and `short_answer`. Create requests provide `choices` as `{ "text": "..." }` values and objective keys as `correctAnswerIndices`; the API converts these to private database choice IDs. Student list and attempt-start responses never include answer keys. Objective answers are scored only on the server and require an exact choice set; short-answer marks remain pending until an authorized teacher grades them. Question marks must sum to `totalMarks`, and passing marks cannot exceed that total. The attempt stores a unique student/exam record and server-generated expiry time. The browser submits when its countdown reaches zero; the API also checks the deadline and discards answers received after expiry, then refuses repeat submissions. Question and choice order is randomized per attempt when enabled.

Exams cannot be deleted after an attempt exists, and their questions cannot be changed after students start. Editing the duration does not extend an already-running attempt. Teacher/admin reports expose submitted student responses to authorized reviewers but do not expose correct-answer keys.

### Learning, quizzes, and assignments

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/progress/me` | Student |
| POST | `/api/progress/:courseId/lessons/:lessonId/complete` | Enrolled student |
| POST | `/api/progress/study-sessions` | Student; 1–240 minutes per session, 12-hour daily cap |
| GET | `/api/progress/study-sessions` | Student; own sessions |
| GET | `/api/progress/recommendations` | Student; rule-based quiz-topic suggestions |
| POST | `/api/quizzes` | Approved teacher or admin |
| GET | `/api/quizzes/course/:courseId` | Enrolled student, course owner, or admin |
| POST | `/api/quizzes/:quizId/submit` | Enrolled student; server calculates score |
| GET | `/api/quizzes/attempts/me` | Student; own quiz attempts |
| GET | `/api/assignments` | Student (enrolled courses), teacher, or admin |
| POST | `/api/assignments` | Approved teacher or admin |
| POST | `/api/assignments/:assignmentId/submit` | Enrolled student |
| GET | `/api/assignments/submissions` | Student (own only), teacher (own courses), or admin |
| PATCH | `/api/assignments/submissions/:submissionId/grade` | Approved course owner or admin |

Lesson completion awards XP once per lesson. Passing a quiz awards XP once per student and quiz. Streaks and milestone badges are calculated and stored by the API. Recommendations are rule-based: quiz topics below 70% accuracy are matched against incomplete lessons with the same topic.

### Admin, analytics, and certificates

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/users` | Admin; filter by `role`, `status`, and `search` |
| PATCH | `/api/users/:userId` | Admin; enable/disable or set student/teacher role |
| GET | `/api/users/teachers/pending` | Admin |
| PATCH | `/api/users/:userId/approval` | Admin; body decision `approved` or `rejected` |
| GET | `/api/analytics/dashboard` | Student, approved teacher, or admin |
| GET | `/api/analytics/details` | Student, approved teacher, or admin |
| GET | `/api/leaderboard` | Public; top 20 active students |
| POST | `/api/certificates/:courseId` | Student with every lesson completed |
| GET | `/api/certificates` | Student; own certificates |
| GET | `/api/certificates/:certificateId/verify` | Public certificate verification |

Certificate IDs and verification are implemented. PDF/image certificate generation is not; connect a document-rendering service if downloadable certificates are required. Weak-topic recommendations remain rule-based; the separate Learning Assistant can use an optional server-side OpenAI-compatible provider.

## Example requests

Register a student:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/auth/register `
  -ContentType 'application/json' `
  -Body '{"name":"Haritha","email":"haritha@example.com","password":"Use-A-Strong-Password-123","role":"student"}'
```

Log in and save the token:

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/auth/login `
  -ContentType 'application/json' `
  -Body '{"email":"haritha@learnly.test","password":"<the SEED_STUDENT_PASSWORD from .env>"}'
$token = $login.data.token
```

List courses and enroll:

```powershell
$courses = Invoke-RestMethod -Uri 'http://localhost:4000/api/courses?page=1&limit=10'
$courseId = $courses.data[0]._id
Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/courses/$courseId/enroll" `
  -Headers @{ Authorization = "Bearer $token" }
```

View student progress:

```powershell
Invoke-RestMethod -Uri http://localhost:4000/api/progress/me `
  -Headers @{ Authorization = "Bearer $token" }
```

Create a course as an approved teacher:

```powershell
$teacherLogin = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/auth/login `
  -ContentType 'application/json' `
  -Body '{"email":"teacher@learnly.test","password":"<the SEED_TEACHER_PASSWORD from .env>"}'
$teacherToken = $teacherLogin.data.token
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/courses `
  -Headers @{ Authorization = "Bearer $teacherToken" } `
  -ContentType 'application/json' `
  -Body '{"title":"Software Design Patterns","description":"A practical introduction to maintainable software design patterns and their tradeoffs.","category":"Software Engineering","level":"Beginner","status":"published","lessons":[{"title":"Pattern fundamentals","topic":"Design patterns","durationMinutes":20}]}'
```

## Tests and security notes

```powershell
npm test
npm run test:integration
```

`npm test` runs without MongoDB and covers API health/errors, authentication and role middleware, request validation, scoring, and service behavior. `npm run test:integration` requires the MongoDB URI and JWT secret from `.env`; it creates uniquely named records and exercises login/profile, course creation/enrollment/progress/certificate issuance, quiz scoring and answer privacy, assignment submission privacy/grading, assistant demo responses and history, coding challenge visibility/ownership, exam privacy/scoring/expiry/grading, admin report permissions, and course-delete cascades. It removes the test records afterward.

Use HTTPS and a private, high-entropy `JWT_SECRET` in production. Keep `.env` out of version control, set `CORS_ORIGIN` to the exact frontend origin, and provision MongoDB with authentication and network restrictions. Authentication and write rate limits are enabled. Tokens are returned in the JSON response and should be kept in a secure client storage mechanism; this demo does not issue refresh tokens or use HTTP-only cookies.
