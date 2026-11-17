# Learnly — Smart Learning Management System

A shared LMS application with React/Vite student, teacher, and admin portals and an Express/MongoDB API. The existing portal design is retained; account data and supported learning workflows now use the backend rather than browser mock records.

## Project overview

### Problem statement

Course materials, assessments, learner progress, and teaching workflows are often split across separate tools. That makes it difficult for students to follow a course, for teachers to evaluate work, and for administrators to monitor a learning platform consistently.

### Objectives

- Provide one responsive application with role-specific student, teacher, and admin workspaces.
- Connect portal workflows to a shared Express API and MongoDB database.
- Protect accounts and private student records with password hashing, bearer authentication, validation, and role/ownership checks.
- Support course learning, assessments, coding practice, and course-focused study help.
- Track measurable learning activity, progress, feedback, and course completion.

### Proposed system and architecture

```text
React + Vite browser application
  ├─ Student portal: courses, lessons, quizzes, assignments, planner, AI assistant, coding, exams
  ├─ Teacher portal: courses, quizzes, assignments, coding problems, exam grading, analytics
  └─ Admin portal: users, approvals, courses/categories, coding activity, exam reports
            │ VITE_API_URL + JSON + JWT bearer token
            ▼
Express REST API
  ├─ Routes → Zod request validation → authentication/role checks → controllers
  ├─ Learning, gamification, recommendation, AI-provider, and sandbox services
  └─ Mongoose models and authorization-scoped MongoDB queries
            │
            ▼
MongoDB (local or hosted)
```

The browser uses one API client. The API is the authority for permissions, scoring, exam expiry, certificates, and stored progress. External AI and code execution are optional backend-only HTTPS integrations; they are not simulated as live services when unconfigured.

### Technology stack

- Frontend: React 18, Vite, React Router, Tailwind CSS, Lucide icons, responsive CSS.
- Backend: Node.js, Express, Mongoose, MongoDB, Zod, bcryptjs, JWT, Helmet, CORS, express-rate-limit.
- Validation: React production bundle and Node.js API/unit tests; optional MongoDB-backed integration test.

## Portal modules

### Student

Register and sign in; view a dashboard and profile; browse and enroll in courses; watch available lesson videos, open resources, and track lesson progress; take server-scored quizzes and exams; submit assignments; review feedback; use course-material recommendations and the study planner/timer; track XP, badges, streaks, and leaderboards; use AI study chat and coding challenges; view analytics and certificates.

### Teacher

Register for administrator approval; manage owned courses, lessons, notes, and resources; create quizzes and assignments; review and grade submissions; manage coding challenges; author and publish exams; grade descriptive exam responses; review course analytics.

### Admin

Review teacher applications; manage accounts, courses, and categories; review platform dashboards and analytics; monitor coding submissions; view examination reports and recent attempts.

## Advanced learning modules

- **AI Learning Assistant:** Student chat is restricted to published courses the student is enrolled in. Conversation history is stored in MongoDB. Teacher-provided notes and lesson descriptions can ground answers. The backend calls an optional OpenAI-compatible HTTPS endpoint using a server-side key; without a key, answers are explicitly labeled demo-mode course-material previews.
- **Coding practice:** Python, C, C++, and Java are selectable. Students can inspect sample cases, edit code, run against custom input, submit against private test cases, and review progress/history/leaderboards. Teachers manage problems and admins monitor activity. Code is sent only to a configured Judge0-compatible HTTPS sandbox with request/resource limits; Express does not execute student code.
- **Smart examinations:** Teachers create MCQ, multiple-select, true/false, and short-answer exams. Server-generated attempt expiry and stable randomized question/choice order are stored in MongoDB. Students can resume a started attempt, the browser submits when its countdown expires, objective answers are scored by the API, and teachers grade short answers. Student payloads omit answer keys; submissions are unique per student and exam.
- **Learning completion:** The API tracks lesson completion, study sessions, rule-based weak-topic recommendations, XP, badges, streaks, leaderboards, and certificate eligibility/verification.

## Database design

MongoDB collections are managed through Mongoose:

| Model | Purpose |
|---|---|
| `User` | Account profile, role, bcrypt password hash, approval, XP/streak/badges, token version |
| `Category`, `Course`, `Enrollment` | Course catalog, teacher-owned lessons/materials, student membership and progress |
| `Quiz`, `QuizAttempt` | Teacher quiz definitions and student scores/topic results |
| `Assignment`, `Submission` | Course assignment settings, student work, grades, feedback |
| `Exam`, `ExamAttempt` | Private exam answer keys/settings and uniquely indexed timed student attempts |
| `AssistantConversation` | Student/course-scoped assistant messages and response mode |
| `CodingProblem`, `CodingSubmission` | Public challenge data, private tests, learner submissions/progress |
| `StudySession` | Student study-time records |
| `Certificate` | Unique completion credential and verification data |

Important database constraints include unique user email, enrollment per student/course, one exam attempt per student/exam, and unique certificate/student-course issuance. Deleting a course cascades to its dependent course assessments, attempts, submissions, certificates, assistant conversations, and enrollments; a teacher deleting an enrolled course archives it instead.

## API and configuration

The API is mounted at `/api`; endpoint groups and sample PowerShell requests are documented in [backend/README.md](./backend/README.md). Frontend API requests use `VITE_API_URL`; the backend requires a MongoDB URI and a random JWT secret of at least 32 characters. Keep `.env` files out of source control and keep provider/sandbox credentials in the backend environment only.

## Requirements

- Node.js 18+ and npm
- MongoDB 6+ running locally or a MongoDB connection URI

## Configure

### Frontend

From the project root:

```powershell
npm install
Copy-Item .env.example .env
```

Set the API URL in `.env` if the backend is not at the default:

```dotenv
VITE_API_URL=http://localhost:4000/api
```

Vite reads environment values at startup; restart it after editing `.env`.

### Backend

In a second terminal:

```powershell
Set-Location .\backend
npm install
Copy-Item .env.example .env
```

Configure `MONGODB_URI`, a unique random `JWT_SECRET` of at least 32 characters, and `CORS_ORIGIN`. The example allows both common local Vite origins:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/learnly_lms
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

For MongoDB Atlas, use its connection URI and restrict network access and database credentials appropriately. Do not commit `.env` files.

## Seed demo accounts and courses

Set three distinct passwords of at least 12 characters in `backend/.env`:

```dotenv
SEED_ADMIN_PASSWORD=
SEED_TEACHER_PASSWORD=
SEED_STUDENT_PASSWORD=
```

Then run from `backend`:

```powershell
npm run seed
```

Demo accounts are `admin@learnly.test`, `teacher@learnly.test`, and `haritha@learnly.test`. Passwords are supplied only through the environment and are never printed. The seed creates the five customized subjects: Software Engineering and System Design, Statistics, Algorithms, Critical Thinking, and Artificial Intelligence and Deep Learning.

## Run locally

Start MongoDB, then start the API in one terminal:

```powershell
Set-Location .\backend
npm run dev
```

Start the Vite frontend from the project root in another terminal:

```powershell
npm run dev
```

Open the local Vite URL, normally `http://localhost:5173`. The API health check is `http://localhost:4000/health`.

## Integrated features

- Registration and sign-in use the API; public registration permits student or teacher accounts, never admin accounts.
- JWT bearer tokens are held in `sessionStorage`, revalidated through `/api/auth/me`, and cleared on logout or rejected/expired sessions. Portal routes are tied to the authenticated role; backend authorization remains authoritative.
- Course catalog/search, teacher/admin course management, course editing and publishing, enrollment, lesson materials, and progress use API records.
- Lesson completion, quiz creation and server-side scoring, assignment submission, grading/feedback, study sessions, XP/streaks/badges, recommendations, leaderboard, analytics, certificates, and certificate verification use their available API endpoints.
- Student AI Learning Assistant is restricted to enrolled courses, stores conversations in MongoDB, and can ground configured provider answers in teacher-imported plain-text/Markdown course notes. Without a backend AI key it clearly identifies its course-material preview as demo mode.
- Student Coding Playground supports Python, C, C++, and Java challenges, sandboxed run/submit, private test cases, MongoDB submission history, solved progress, and a coding leaderboard. Teachers manage problems in their portal; admins can review aggregate activity.
- Smart examinations support teacher-created MCQ, multiple-select, true/false, and short-answer exams; random question/choice order, server-timed attempts, automatic timeout submission, server-side objective scoring, teacher grading, student history, and admin reports.
- Teachers can import `.txt` and `.md` notes (100 KB per file) in the course editor; note text is saved with the course and capped at 50,000 characters.
- Admin user lists/status management, pending teacher approvals, and course categories use protected admin endpoints.
- API errors and validation messages are displayed in the existing interface; loading, empty, and retry/error states are retained.

## Tests and production build

From the project root:

```powershell
npm run build
```

From `backend`:

```powershell
npm test
npm run test:integration
npm audit
```

`npm test` runs the database-independent API, validation, authorization-middleware, scoring, and service tests. `npm run test:integration` requires a reachable MongoDB instance configured by `backend/.env`; it creates uniquely named temporary records and removes those records after the run. The integration workflow covers login/profile, teacher course creation, student enrollment and lesson progress/certificate issuance, quiz scoring and answer/explanation privacy, assignment submission visibility and grading, assistant demo mode/history/course authorization, coding challenge visibility and teacher ownership, exam publication/scoring/duplicate prevention/late submission/grading, student denial of admin reports, and dependent-record cleanup after course deletion.

## Final verification and demonstration checklist

- [ ] Student registration/login, dashboard, profile, enrollment, lesson completion, and progress.
- [ ] Quiz creation, student attempt, score/feedback, and absence of correct answers/explanations in the pre-submission API response.
- [ ] Assignment submission, teacher grading, and student-only submission visibility.
- [ ] AI assistant in configured AI mode or clearly labeled demo mode; verify saved conversation history.
- [ ] Coding editor in Python/C/C++/Java; verify real execution only when a trusted sandbox is configured, then inspect history and leaderboard.
- [ ] Examination creation, publication, countdown/automatic submission, objective marks, descriptive grading, student history, and admin report.
- [ ] Admin user management, teacher approval, course/category management, and analytics.
- [ ] Desktop, tablet, and mobile screenshots of student dashboard, teacher exam builder/review, admin examination report, assistant mode, coding practice, and empty/loading/error states.
- [ ] Never include passwords, tokens, API keys, or private test cases in screenshots.

For a university demo, seed with distinct temporary credentials, keep MongoDB running, and configure a trusted AI provider and code sandbox only if those live integrations will be demonstrated.

## Limitations

- The current backend accepts a URL for assignment materials; it does not implement binary uploads or malware scanning. Do not submit confidential content through untrusted external links.
- AI note import extracts plain text/Markdown in the browser; it does not store or parse arbitrary PDFs, Word documents, or other binary files. The AI API key stays in the backend environment. Provider requests are made only when configured.
- Certificates are issued and verified by the API; PDF rendering is not implemented. The frontend can print the certificate layout through the browser.
- The study planner task checklist and cosmetic settings remain browser-local because the API has no endpoints for those preferences/tasks.
- The API does not expose a general activity feed, daily study chart, or teacher student-roster endpoint; those views are omitted or limited to data the API does expose.
- The coding editor is a browser text editor rather than an IDE with syntax highlighting or debugging. Code execution remains unavailable until a trusted external sandbox is configured.
- The quiz countdown is a frontend timer; timed, server-enforced examination attempts use the separate Smart Examination module.
- Code execution requires a separately configured Judge0-compatible HTTPS sandbox. It is intentionally unavailable until configured; student code is never executed by the Express process. Execution is capped at 12 requests per minute, 20,000 source characters, five private tests, and sandbox-enforced CPU, wall-time, memory, and file-size limits.
- Recommendations are rule-based, not AI-powered. No external AI provider is called.
- Access tokens are short-lived bearer tokens held in `sessionStorage` for this demo. This reduces persistence but is still accessible to page JavaScript; production deployments should consider secure, HttpOnly cookie sessions, CSRF protections, HTTPS, and a stricter content-security policy.

## Structure

```text
src/
  App.jsx                         Portal routes, pages, and shared UI
  AssistantPage.jsx               Student learning assistant and conversation history
  CodingPlayground.jsx            Student coding, teacher problem management, admin activity
  ExamCenter.jsx                  Student exams, teacher authoring/grading, admin reports
  data.js                         Browser-local planner starter data
  services/api.js                 Centralized API client
  styles.css                      Shared responsive styling
backend/
  config/                         Environment and MongoDB connection
  controllers/                    API workflows and authorization
  middleware/                     Authentication, role checks, validation, errors, limits
  models/                         Mongoose schemas and indexes
  routes/                         REST endpoints
  services/                       AI, sandbox, recommendations, gamification
  scripts/seed.js                 Demo data with environment-only passwords
  tests/api.test.js                Database-independent test suite
  tests/database.integration.js   MongoDB-backed workflow regression
```

See [backend/README.md](./backend/README.md) for endpoint details, example requests, and API configuration.

## Conclusion

Learnly provides an integrated course-project LMS with three role-specific portals, a shared MongoDB-backed API, student learning and progress tools, and optional AI and sandbox integrations. The checks above distinguish automated local verification from features that still depend on external credentials/services; configure and manually demonstrate those integrations before presenting them as live.
