import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Award, Check, Clock3, FileCheck2, Plus, Send, ShieldCheck, Trash2 } from 'lucide-react'
import { api } from './services/api'

const questionTypes = [
  ['mcq', 'Multiple choice'],
  ['multiple_select', 'Multiple select'],
  ['true_false', 'True / false'],
  ['short_answer', 'Short answer'],
]

function blankQuestion() {
  return { type: 'mcq', prompt: '', marks: 1, choices: ['Option 1', 'Option 2'], correctAnswerIndices: [0] }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0')
  const secs = (seconds % 60).toString().padStart(2, '0')
  return `${mins}:${secs}`
}

function ExamCenter({ user }) {
  const { notify } = useOutletContext()
  const [exams, setExams] = useState([])
  const [courses, setCourses] = useState([])
  const [history, setHistory] = useState([])
  const [report, setReport] = useState(null)
  const [attemptData, setAttemptData] = useState(null)
  const [activeExam, setActiveExam] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [attemptsView, setAttemptsView] = useState(null)
  const [gradingAttempt, setGradingAttempt] = useState(null)
  const [grades, setGrades] = useState({})
  const [examFormOpen, setExamFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const submitLock = useRef(false)
  const answersRef = useRef(answers)
  const activeRef = useRef(attemptData)
  const role = user.role

  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { activeRef.current = attemptData }, [attemptData])

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (role === 'admin') {
        setReport(await api.getExamReports())
        return
      }
      const [examList, courseList, examHistory] = await Promise.all([
        api.getExams(),
        role === 'teacher' ? api.getCourses({ role: 'teacher' }) : Promise.resolve([]),
        role === 'student' ? api.getExamHistory() : Promise.resolve([]),
      ])
      setExams(examList)
      setCourses(courseList)
      setHistory(examHistory)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [role])

  useEffect(() => { reload() }, [reload])

  const submitAttempt = useCallback(async (automatic = false) => {
    const active = activeRef.current
    if (!active || submitLock.current) return
    submitLock.current = true
    setBusy(true)
    setError('')
    try {
      const payload = active.questions.map((question) => {
        const answer = answersRef.current[question.id] || {}
        return { questionId: question.id, selectedChoices: answer.selectedChoices || [], text: answer.text || '' }
      })
      const response = await api.submitExam(active.attemptId, payload)
      setResult(response)
      setAttemptData(null)
      setActiveExam(null)
      setAnswers({})
      if (automatic) notify('Time is up. Your examination was submitted automatically.')
      else notify('Your examination was submitted.')
      await reload()
    } catch (submitError) {
      setError(submitError.message)
      submitLock.current = false
    } finally {
      setBusy(false)
    }
  }, [notify, reload])

  useEffect(() => {
    if (!attemptData?.expiresAt) return undefined
    const updateTime = () => {
      const remaining = Math.max(0, Math.ceil((new Date(attemptData.expiresAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0 && !submitLock.current) submitAttempt(true)
    }
    updateTime()
    const interval = window.setInterval(updateTime, 1000)
    return () => window.clearInterval(interval)
  }, [attemptData, submitAttempt])

  async function beginExam(exam) {
    setBusy(true)
    setError('')
    submitLock.current = false
    try {
      const data = await api.startExam(exam.id)
      setActiveExam(data.exam)
      setAttemptData(data)
      setAnswers({})
      setResult(null)
    } catch (startError) {
      setError(startError.message)
    } finally {
      setBusy(false)
    }
  }

  async function togglePublished(exam) {
    try {
      await api.updateExam(exam.id, { published: !exam.published })
      notify(exam.published ? 'Examination moved to draft.' : 'Examination published for enrolled students.')
      await reload()
    } catch (updateError) {
      setError(updateError.message)
    }
  }

  async function removeExam(exam) {
    if (!window.confirm(`Delete “${exam.title}”? This cannot be undone.`)) return
    try {
      await api.deleteExam(exam.id)
      notify('Examination deleted.')
      await reload()
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  async function showAttempts(exam) {
    setBusy(true)
    setError('')
    try {
      const data = await api.getExamAttempts(exam.id)
      setAttemptsView(data)
      setGradingAttempt(null)
      setGrades({})
    } catch (attemptError) {
      setError(attemptError.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveGrades() {
    if (!gradingAttempt || !attemptsView) return
    const shortQuestions = attemptsView.exam.questions.filter((question) => question.type === 'short_answer')
    try {
      await api.gradeExamAttempt(gradingAttempt._id, {
        grades: shortQuestions.map((question) => ({
          questionId: question.id,
          marksAwarded: Number(grades[question.id]?.marksAwarded || 0),
          feedback: grades[question.id]?.feedback || '',
        })),
        feedback: grades.overallFeedback || '',
      })
      notify('Exam responses graded and results updated.')
      await showAttempts({ id: attemptsView.exam.id })
    } catch (gradeError) {
      setError(gradeError.message)
    }
  }

  const title = role === 'student' ? 'Examinations' : 'Exam management'
  const subtitle = role === 'student'
    ? 'Take course examinations and review your results.'
    : 'Create assessments, manage publication, and review student performance.'

  if (loading) return <div className="loading-state"><span className="spinner" /><span>Loading examinations...</span></div>

  return (
    <section className="exam-page">
      <header className="exam-heading">
        <div><p className="eyebrow">{role === 'student' ? 'YOUR LEARNING' : role === 'admin' ? 'PLATFORM OVERSIGHT' : 'TEACHER STUDIO'}</p><h1>{title}</h1><p>{subtitle}</p></div>
        {role === 'teacher' && <button className="button button-primary" onClick={() => setExamFormOpen((open) => !open)}><Plus size={16} />Create examination</button>}
      </header>

      {error && <div className="exam-alert"><AlertCircle size={17} />{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}

      {role === 'admin' && <AdminExamReport report={report} />}

      {role === 'student' && result && <div className="exam-result panel">
        <Award size={22} />
        <div><strong>{result.result.status === 'graded' ? (result.result.passed ? 'Examination passed' : 'Examination completed') : 'Submission received'}</strong>
          <p>{result.result.status === 'graded'
            ? `You earned ${result.result.awardedMarks} of ${result.result.totalMarks} marks${result.result.timedOut ? ' (submitted when time expired)' : ''}.`
            : `${result.result.objectiveMarks} marks confirmed; ${result.result.pendingMarks} marks are awaiting teacher review.`}</p>
        </div>
        <button className="exam-text-button" onClick={() => setResult(null)}>Dismiss</button>
      </div>}

      {role === 'student' && attemptData && activeExam && <StudentExam
        exam={activeExam}
        data={attemptData}
        answers={answers}
        setAnswers={setAnswers}
        secondsLeft={secondsLeft}
        busy={busy}
        onBack={() => { setAttemptData(null); setActiveExam(null) }}
        onSubmit={() => {
          const answered = Object.values(answers).some((answer) => answer?.text?.trim() || answer?.selectedChoices?.length)
          const prompt = answered
            ? 'Submit your examination now? You cannot attempt it again.'
            : 'No answers have been entered. Submit the examination anyway? You cannot attempt it again.'
          if (window.confirm(prompt)) submitAttempt()
        }}
      />}

      {role === 'teacher' && examFormOpen && <ExamBuilder courses={courses} onCancel={() => setExamFormOpen(false)} onCreated={async () => { setExamFormOpen(false); notify('Examination created as a draft.'); await reload() }} />}

      {role !== 'admin' && !attemptData && !attemptsView && <div className="panel exam-list-panel">
        <div className="panel-heading"><div><h3>{role === 'student' ? 'Available examinations' : 'Your examinations'}</h3><p>{role === 'student' ? 'Only published exams for your enrolled courses appear here.' : 'Publish exams when they are ready for students.'}</p></div></div>
        {exams.length === 0
          ? <div className="empty-state"><FileCheck2 size={26} /><strong>No examinations yet</strong><p>{role === 'student' ? 'Your teachers have not published an exam for your enrolled courses.' : 'Create an examination for one of your courses to get started.'}</p></div>
          : <div className="exam-list">{exams.map((exam) => <article className="exam-card" key={exam.id}>
            <div className="exam-card-mark"><FileCheck2 size={19} /></div><div className="exam-card-content"><h3>{exam.title}</h3><p>{exam.course?.title || 'Course examination'} · {exam.questionCount || exam.questions?.length || 0} questions · {exam.durationMinutes} min · {exam.totalMarks} marks</p>
              {role === 'student' && exam.attempt && <span className={`exam-status status-${exam.attempt.status}`}>{exam.attempt.status === 'in_progress' ? 'In progress · resume exam' : exam.attempt.status === 'submitted' ? 'Awaiting grading' : `Graded · ${exam.attempt.awardedMarks}/${exam.attempt.totalMarks}`}</span>}
            </div>
            {role === 'student' ? <button className="button button-primary" disabled={busy || exam.attempt?.status !== undefined && exam.attempt.status !== 'in_progress'} onClick={() => beginExam(exam)}>{exam.attempt?.status === 'in_progress' ? 'Resume' : exam.attempt ? 'Completed' : 'Start exam'}</button> :
              <div className="exam-card-actions"><button className="button button-soft" onClick={() => showAttempts(exam)}>Review attempts</button><button className="button button-soft" onClick={() => togglePublished(exam)}>{exam.published ? 'Unpublish' : 'Publish'}</button>{!exam.attemptCount && <button className="exam-icon-danger" onClick={() => removeExam(exam)} aria-label="Delete examination"><Trash2 size={16} /></button>}</div>}
          </article>)}</div>}
      </div>}

      {role === 'student' && <div className="panel exam-list-panel"><div className="panel-heading"><div><h3>Examination history</h3><p>Your submitted attempts and grading status.</p></div></div>
        {history.length === 0 ? <p className="exam-muted">Your completed attempts will appear here.</p> : <div className="exam-history-list">{history.map((attempt) => <div key={attempt._id} className="exam-history-row"><div><strong>{attempt.exam?.title || 'Examination'}</strong><small>{new Date(attempt.startedAt).toLocaleString()}</small></div><span className={`exam-status status-${attempt.status}`}>{attempt.status === 'graded' ? `${attempt.awardedMarks}/${attempt.totalMarks} marks` : attempt.status === 'submitted' ? 'Pending grading' : 'In progress'}</span></div>)}</div>}
      </div>}

      {attemptsView && <TeacherAttempts data={attemptsView} gradingAttempt={gradingAttempt} setGradingAttempt={setGradingAttempt} grades={grades} setGrades={setGrades} onBack={() => { setAttemptsView(null); setGradingAttempt(null) }} onSave={saveGrades} busy={busy} />}
    </section>
  )
}

function StudentExam({ exam, data, answers, setAnswers, secondsLeft, busy, onBack, onSubmit }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const question = data.questions[activeIndex]
  function updateAnswer(next) {
    setAnswers((current) => ({ ...current, [question.id]: { ...current[question.id], ...next } }))
  }
  return <section className="panel exam-taking">
    <div className="exam-taking-top"><div><button className="exam-text-button" onClick={onBack}><ArrowLeft size={15} />Exit exam</button><h2>{exam.title}</h2><p>{exam.instructions || 'Read each question carefully. Your answers are saved in this browser session until you submit.'}</p></div><div className={`exam-countdown ${secondsLeft < 60 ? 'countdown-warning' : ''}`}><Clock3 size={17} /><span>{formatTime(secondsLeft)}</span></div></div>
    <div className="exam-progress-track"><span style={{ width: `${((activeIndex + 1) / data.questions.length) * 100}%` }} /></div>
    <div className="exam-question">
      <div className="exam-question-label"><span>Question {activeIndex + 1} of {data.questions.length}</span><strong>{question.marks} {question.marks === 1 ? 'mark' : 'marks'}</strong></div>
      <h3>{question.prompt}</h3>
      {question.type === 'short_answer'
        ? <label className="exam-field"><span>Your answer</span><textarea rows="7" maxLength="5000" value={answers[question.id]?.text || ''} onChange={(event) => updateAnswer({ text: event.target.value })} placeholder="Write your answer..." /></label>
        : <div className="exam-choices">{question.choices.map((choice) => {
          const selected = answers[question.id]?.selectedChoices || []
          const checked = selected.includes(choice.id)
          return <label className={`exam-choice ${checked ? 'choice-selected' : ''}`} key={choice.id}><input type={question.type === 'multiple_select' ? 'checkbox' : 'radio'} name={question.id} checked={checked} onChange={() => updateAnswer({ selectedChoices: question.type === 'multiple_select' ? checked ? selected.filter((id) => id !== choice.id) : [...selected, choice.id] : [choice.id] })} /><span>{choice.text}</span></label>
        })}</div>}
    </div>
    <footer className="exam-taking-footer"><span>{Object.keys(answers).filter((id) => answers[id]?.text?.trim() || answers[id]?.selectedChoices?.length).length} of {data.questions.length} answered</span><div><button className="button button-soft" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => index - 1)}>Previous</button>{activeIndex < data.questions.length - 1 ? <button className="button button-primary" onClick={() => setActiveIndex((index) => index + 1)}>Next question</button> : <button className="button button-primary" disabled={busy} onClick={onSubmit}><Send size={15} />Submit exam</button>}</div></footer>
  </section>
}

function ExamBuilder({ courses, onCancel, onCreated }) {
  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState(courses[0]?.id || '')
  const [durationMinutes, setDuration] = useState(30)
  const [passingMarks, setPassingMarks] = useState(1)
  const [questions, setQuestions] = useState([blankQuestion()])
  const [randomizeQuestions, setRandomizeQuestions] = useState(true)
  const [randomizeChoices, setRandomizeChoices] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const totalMarks = useMemo(() => questions.reduce((total, question) => total + Math.max(0, Number(question.marks) || 0), 0), [questions])
  useEffect(() => {
    setPassingMarks((current) => Math.min(Number(current) || 0, totalMarks))
  }, [totalMarks])

  function changeQuestion(index, patch) {
    setQuestions((current) => current.map((question, itemIndex) => itemIndex === index ? { ...question, ...patch } : question))
  }
  function setType(index, type) {
    const question = questions[index]
    changeQuestion(index, { ...blankQuestion(), ...question, type, choices: type === 'true_false' ? ['True', 'False'] : type === 'short_answer' ? [] : question.choices.length >= 2 ? question.choices : ['Option 1', 'Option 2'], correctAnswerIndices: type === 'short_answer' ? [] : [0] })
  }
  async function create(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = {
        title, courseId, instructions: '', durationMinutes: Number(durationMinutes), totalMarks,
        passingMarks: Number(passingMarks), randomizeQuestions, randomizeChoices, published: false,
        questions: questions.map((question) => ({
          type: question.type,
          prompt: question.prompt,
          marks: Number(question.marks),
          choices: question.choices.map((text) => ({ text: text.trim() })).filter((choice) => choice.text),
          correctAnswerIndices: question.type === 'short_answer' ? [] : question.correctAnswerIndices,
          acceptedAnswers: [],
        })),
      }
      await api.createExam(body)
      await onCreated()
    } catch (createError) {
      setError(createError.message)
    } finally {
      setSaving(false)
    }
  }
  return <form className="panel exam-builder" onSubmit={create}>
    <div className="panel-heading"><div><h3>Create an examination</h3><p>Questions are scored server-side; answers stay private until grading is complete.</p></div></div>
    {error && <div className="exam-inline-error">{error}</div>}
    {courses.length === 0 ? <div className="exam-inline-error">Create a course before creating an examination.</div> : <>
      <div className="exam-builder-grid">
        <label className="exam-field"><span>Examination title</span><input required minLength="4" maxLength="160" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Data structures midterm" /></label>
        <label className="exam-field"><span>Course</span><select value={courseId} onChange={(event) => setCourseId(event.target.value)}>{courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}</select></label>
        <label className="exam-field"><span>Duration (minutes)</span><input type="number" min="1" max="360" required value={durationMinutes} onChange={(event) => setDuration(event.target.value)} /></label>
        <label className="exam-field"><span>Passing marks (total {totalMarks})</span><input type="number" min="0" max={totalMarks} required value={passingMarks} onChange={(event) => setPassingMarks(event.target.value)} /></label>
      </div>
      <div className="exam-builder-options"><label><input type="checkbox" checked={randomizeQuestions} onChange={(event) => setRandomizeQuestions(event.target.checked)} /> Randomize questions</label><label><input type="checkbox" checked={randomizeChoices} onChange={(event) => setRandomizeChoices(event.target.checked)} /> Randomize choices</label></div>
      {questions.map((question, index) => <div className="exam-builder-question" key={index}>
        <header><strong>Question {index + 1}</strong>{questions.length > 1 && <button type="button" className="exam-icon-danger" onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove question ${index + 1}`}><Trash2 size={15} /></button>}</header>
        <div className="exam-builder-grid">
          <label className="exam-field exam-field-wide"><span>Question</span><textarea required minLength="5" maxLength="2000" rows="2" value={question.prompt} onChange={(event) => changeQuestion(index, { prompt: event.target.value })} /></label>
          <label className="exam-field"><span>Question type</span><select value={question.type} onChange={(event) => setType(index, event.target.value)}>{questionTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="exam-field"><span>Marks</span><input type="number" min="1" max="1000" required value={question.marks} onChange={(event) => changeQuestion(index, { marks: event.target.value })} /></label>
        </div>
        {question.type !== 'short_answer' && <div className="exam-choice-builder"><p>Choices <small>— check the correct answer{question.type === 'multiple_select' ? 's' : ''}</small></p>
          {question.choices.map((choice, choiceIndex) => <div className="exam-choice-edit" key={choiceIndex}><input aria-label={`Choice ${choiceIndex + 1}`} value={choice} onChange={(event) => changeQuestion(index, { choices: question.choices.map((item, itemIndex) => itemIndex === choiceIndex ? event.target.value : item) })} /><label><input type={question.type === 'multiple_select' ? 'checkbox' : 'radio'} name={`correct-${index}`} checked={question.correctAnswerIndices.includes(choiceIndex)} onChange={() => changeQuestion(index, { correctAnswerIndices: question.type === 'multiple_select' ? question.correctAnswerIndices.includes(choiceIndex) ? question.correctAnswerIndices.filter((item) => item !== choiceIndex) : [...question.correctAnswerIndices, choiceIndex] : [choiceIndex] })} /> Correct</label>{question.type !== 'true_false' && question.choices.length > 2 && <button type="button" className="exam-icon-danger" aria-label="Remove choice" onClick={() => changeQuestion(index, { choices: question.choices.filter((_, itemIndex) => itemIndex !== choiceIndex), correctAnswerIndices: question.correctAnswerIndices.filter((item) => item !== choiceIndex).map((item) => item > choiceIndex ? item - 1 : item) })}><Trash2 size={14} /></button>}</div>)}
          {question.type !== 'true_false' && question.choices.length < 10 && <button className="exam-text-button" type="button" onClick={() => changeQuestion(index, { choices: [...question.choices, `Option ${question.choices.length + 1}`] })}><Plus size={14} />Add choice</button>}
        </div>}
      </div>)}
      <button className="exam-add-question" type="button" onClick={() => setQuestions((current) => [...current, blankQuestion()])}><Plus size={15} />Add question</button>
      <div className="exam-builder-footer"><span>{questions.length} questions · {totalMarks} total marks · Draft until published</span><div><button className="button button-soft" type="button" onClick={onCancel}>Cancel</button><button className="button button-primary" type="submit" disabled={saving || !courseId || totalMarks < 1}>{saving ? 'Saving...' : 'Create draft'}</button></div></div>
    </>}
  </form>
}

function TeacherAttempts({ data, gradingAttempt, setGradingAttempt, grades, setGrades, onBack, onSave, busy }) {
  const shortQuestions = data.exam.questions.filter((question) => question.type === 'short_answer')
  const currentResponses = new Map((gradingAttempt?.responses || []).map((response) => [String(response.question), response]))
  return <section className="panel exam-attempts">
    <header className="exam-attempts-header"><div><button className="exam-text-button" onClick={onBack}><ArrowLeft size={15} />Back to examinations</button><h2>{data.exam.title} <small>· {data.exam.totalMarks} marks</small></h2></div></header>
    {gradingAttempt ? <div className="exam-grading">
      <h3>Review {gradingAttempt.student?.name || 'student'}'s answers</h3>
      <p className="exam-muted">Objective score: {gradingAttempt.objectiveMarks} marks. Enter marks for each short-answer question.</p>
      {shortQuestions.length === 0 ? <p className="exam-muted">This exam contains no descriptive questions. Save to finalize the objective score.</p> : shortQuestions.map((question) => {
        const response = currentResponses.get(question.id)
        const grade = grades[question.id] || {}
        return <article className="exam-grade-question" key={question.id}><strong>{question.prompt}</strong><p className="exam-student-answer">{response?.text || 'No answer submitted.'}</p><div className="exam-grade-fields"><label className="exam-field"><span>Marks (max {question.marks})</span><input type="number" min="0" max={question.marks} step="0.5" value={grade.marksAwarded ?? response?.marksAwarded ?? ''} onChange={(event) => setGrades((current) => ({ ...current, [question.id]: { ...current[question.id], marksAwarded: event.target.value } }))} /></label><label className="exam-field"><span>Feedback</span><input maxLength="2000" value={grade.feedback ?? response?.feedback ?? ''} onChange={(event) => setGrades((current) => ({ ...current, [question.id]: { ...current[question.id], feedback: event.target.value } }))} /></label></div></article>
      })}
      <label className="exam-field"><span>Overall feedback</span><textarea rows="2" maxLength="5000" value={grades.overallFeedback || ''} onChange={(event) => setGrades((current) => ({ ...current, overallFeedback: event.target.value }))} /></label>
      <button className="button button-primary" disabled={busy} onClick={onSave}><Check size={15} />Save grading</button>
    </div> : data.attempts.length === 0 ? <div className="empty-state"><FileCheck2 size={25} /><strong>No attempts yet</strong><p>Student attempts will appear here after they take this examination.</p></div> :
      <div className="exam-attempt-table"><div className="exam-table-head"><span>Student</span><span>Submitted</span><span>Score</span><span>Status</span><span>Review</span></div>{data.attempts.map((attempt) => <div className="exam-table-row" key={attempt._id}><span><strong>{attempt.student?.name || 'Student'}</strong><small>{attempt.student?.email}</small></span><span>{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString() : 'In progress'}</span><span>{attempt.awardedMarks}/{attempt.totalMarks}</span><span className={`exam-status status-${attempt.status}`}>{attempt.status}</span><span>{attempt.status !== 'in_progress' && <button className="exam-text-button" onClick={() => { setGradingAttempt(attempt); setGrades({}) }}>{shortQuestions.length ? 'Grade / view' : 'View'}</button>}</span></div>)}</div>}
  </section>
}

function AdminExamReport({ report }) {
  if (!report) return <div className="empty-state"><ShieldCheck size={25} /><strong>No exam analytics available</strong></div>
  return <div className="exam-admin-report">
    <div className="exam-admin-stats"><div><strong>{report.examCount}</strong><small>Examinations</small></div><div><strong>{report.total || 0}</strong><small>Total attempts</small></div><div><strong>{report.submitted || 0}</strong><small>Submitted</small></div><div><strong>{report.graded || 0}</strong><small>Graded</small></div><div><strong>{Number(report.averageMarks || 0).toFixed(1)}</strong><small>Average marks</small></div></div>
    <section className="panel exam-list-panel"><div className="panel-heading"><div><h3>Recent examination activity</h3><p>Latest attempts across the platform.</p></div></div>
      {!report.recent?.length ? <div className="empty-state"><FileCheck2 size={25} /><strong>No exam activity</strong><p>Activity will appear when examinations are taken.</p></div> : <div className="exam-attempt-table"><div className="exam-table-head"><span>Student</span><span>Examination</span><span>Date</span><span>Marks</span><span>Status</span></div>{report.recent.map((attempt) => <div className="exam-table-row" key={attempt._id}><span><strong>{attempt.student?.name || 'Student'}</strong><small>{attempt.student?.email}</small></span><span>{attempt.exam?.title || 'Examination'}</span><span>{new Date(attempt.createdAt).toLocaleDateString()}</span><span>{attempt.awardedMarks}/{attempt.totalMarks}</span><span className={`exam-status status-${attempt.status}`}>{attempt.status}</span></div>)}</div>}
    </section>
  </div>
}

export default ExamCenter
