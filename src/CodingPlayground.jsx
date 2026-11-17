import { useEffect, useMemo, useState } from 'react'
import { Activity, Award, Check, ChevronDown, CircleAlert, Code2, ExternalLink, LoaderCircle, Play, Plus, Send, Shield, Trash2, Trophy } from 'lucide-react'
import { api } from './services/api'

const languages = [
  { id: 'python', label: 'Python' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'java', label: 'Java' },
]
const difficultyLabels = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }
const initialForm = {
  title: '',
  difficulty: 'beginner',
  description: '',
  inputDescription: '',
  outputDescription: '',
  sampleCases: [{ input: '', output: '' }],
  testCases: [{ input: '', output: '' }],
  starterCode: { python: '', c: '', cpp: '', java: '' },
  published: false,
}

function CodingPlayground({ user }) {
  if (user.role === 'teacher') return <ManageCodingProblems />
  if (user.role === 'admin') return <AdminCodingActivity />
  return <StudentCodingPractice />
}

function StudentCodingPractice() {
  const [problems, setProblems] = useState([])
  const [problemId, setProblemId] = useState('')
  const [problem, setProblem] = useState(null)
  const [language, setLanguage] = useState('python')
  const [sourceCode, setSourceCode] = useState('')
  const [stdin, setStdin] = useState('')
  const [tab, setTab] = useState('problem')
  const [output, setOutput] = useState(null)
  const [history, setHistory] = useState([])
  const [progress, setProgress] = useState({ solved: 0, attempted: 0, submissions: 0 })
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const selectedSample = problem?.sampleCases?.[0]
  const solvedIds = useMemo(() => new Set(problems.filter((item) => item.solved).map((item) => item._id)), [problems])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [items, submissions, stats, leaders] = await Promise.all([
        api.getCodingProblems(),
        api.getCodingSubmissions(),
        api.getCodingProgress(),
        api.getCodingLeaderboard(),
      ])
      setProblems(items)
      setHistory(submissions)
      setProgress(stats)
      setLeaderboard(leaders)
      const first = items.find((item) => item._id === problemId) || items[0]
      if (first) {
        setProblemId(first._id)
        const detail = await api.getCodingProblem(first._id)
        setProblem(detail)
        setSourceCode((current) => current || detail.starterCode?.[language] || '')
        setStdin(detail.sampleCases?.[0]?.input || '')
      } else {
        setProblem(null)
      }
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  async function chooseProblem(id) {
    setProblemId(id)
    setOutput(null)
    setError('')
    try {
      const item = await api.getCodingProblem(id)
      setProblem(item)
      setSourceCode(item.starterCode?.[language] || '')
      setStdin(item.sampleCases?.[0]?.input || '')
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  function chooseLanguage(next) {
    setLanguage(next)
    setSourceCode(problem?.starterCode?.[next] || '')
    setOutput(null)
  }

  async function execute(submit) {
    if (!problem || !sourceCode.trim()) {
      setError('Add your solution code before running it.')
      return
    }
    setRunning(true)
    setError('')
    setOutput(null)
    try {
      if (submit) {
        const result = await api.submitCode(problem._id, { language, sourceCode })
        setOutput({
          kind: result.solved ? 'accepted' : 'error',
          text: result.solved
            ? `Accepted — all ${result.totalTests} test cases passed.`
            : `${result.submission.status.replaceAll('_', ' ')}: ${result.passedTests} of ${result.totalTests} test cases passed.`,
        })
        await loadAll()
      } else {
        const result = await api.runCode(problem._id, { language, sourceCode, stdin })
        setOutput({ kind: result.status, text: result.stdout || result.stderr || result.compileOutput || 'Program finished with no output.', time: result.time, memory: result.memory })
      }
    } catch (runError) {
      setError(runError.message)
    } finally {
      setRunning(false)
    }
  }

  if (loading) return <div className="coding-loading"><LoaderCircle className="coding-spin" size={23} /> Loading coding practice…</div>

  return (
    <section className="coding-page">
      <header className="coding-heading">
        <div><p className="eyebrow">PRACTICE. DEBUG. IMPROVE.</p><h1>Coding Playground</h1><p>Build programming skills with hands-on challenges.</p></div>
        <div className="coding-stats">
          <div><Code2 size={17} /><strong>{progress.solved}</strong><small>solved</small></div>
          <div><Activity size={17} /><strong>{progress.attempted}</strong><small>attempted</small></div>
          <div><Trophy size={17} /><strong>{progress.submissions}</strong><small>submissions</small></div>
        </div>
      </header>
      {error && <div className="coding-alert" role="alert"><CircleAlert size={16} />{error}</div>}
      {!problems.length ? <div className="panel coding-empty"><Code2 size={27} /><h2>No coding problems yet</h2><p>Your teacher will publish practice problems soon.</p></div> : (
        <div className="coding-layout">
          <aside className="coding-problem-list panel">
            <div className="coding-panel-title"><strong>Problems</strong><span>{problems.length}</span></div>
            {problems.map((item, index) => (
              <button key={item._id} type="button" className={`coding-problem-item ${problemId === item._id ? 'active' : ''}`} onClick={() => chooseProblem(item._id)}>
                <span className="coding-problem-index">{item.solved || solvedIds.has(item._id) ? <Check size={14} /> : String(index + 1).padStart(2, '0')}</span>
                <span className="coding-problem-name"><strong>{item.title}</strong><small className={`difficulty-${item.difficulty}`}>{difficultyLabels[item.difficulty]}</small></span>
              </button>
            ))}
            <div className="coding-sidebar-links"><button type="button" onClick={() => setTab('history')}>Practice history <ExternalLink size={13} /></button><button type="button" onClick={() => setTab('leaderboard')}>Leaderboard <Trophy size={13} /></button></div>
          </aside>

          <main className="coding-main">
            {tab === 'history' ? <CodingHistory history={history} /> : tab === 'leaderboard' ? <CodingLeaderboard leaders={leaderboard} /> : (
              <div className="coding-split">
                <section className="coding-description panel">
                  {problem && <>
                    <span className={`coding-difficulty difficulty-${problem.difficulty}`}>{difficultyLabels[problem.difficulty]}</span>
                    <h2>{problem.title}</h2>
                    <div className="coding-prose">{problem.description}</div>
                    {problem.inputDescription && <><h3>Input</h3><div className="coding-prose">{problem.inputDescription}</div></>}
                    {problem.outputDescription && <><h3>Output</h3><div className="coding-prose">{problem.outputDescription}</div></>}
                    <h3>Sample input</h3><pre>{selectedSample?.input || '(empty)'}</pre>
                    <h3>Sample output</h3><pre>{selectedSample?.output || '(empty)'}</pre>
                  </>}
                </section>
                <section className="coding-editor-panel panel">
                  <div className="coding-editor-toolbar"><label><span>Language</span><select value={language} onChange={(event) => chooseLanguage(event.target.value)}>{languages.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><ChevronDown size={14} /></label><span className="coding-sandbox-label"><Shield size={13} /> Sandboxed execution</span></div>
                  <textarea className="coding-editor" spellCheck="false" autoCapitalize="off" autoComplete="off" autoCorrect="off" value={sourceCode} onChange={(event) => setSourceCode(event.target.value)} placeholder="Write your solution here…" aria-label="Code editor" />
                  <div className="coding-input"><label htmlFor="coding-stdin">Custom input</label><textarea id="coding-stdin" value={stdin} onChange={(event) => setStdin(event.target.value)} placeholder={selectedSample?.input || 'Enter standard input'} rows={3} /></div>
                  <div className="coding-editor-actions"><button type="button" className="coding-run" onClick={() => execute(false)} disabled={running || !problem}><Play size={15} />{running ? 'Running…' : 'Run Code'}</button><button type="button" className="coding-submit" onClick={() => execute(true)} disabled={running || !problem}><Send size={14} /> Submit Code</button></div>
                  <div className={`coding-output ${output?.kind === 'accepted' || output?.kind === 'success' ? 'output-success' : output ? 'output-error' : ''}`}><div className="coding-output-title"><strong>{running ? 'Executing in sandbox' : output ? output.kind === 'accepted' || output.kind === 'success' ? 'Output' : 'Execution result' : 'Output'}</strong>{running && <LoaderCircle className="coding-spin" size={15} />}</div>{running ? <p>Running with time and memory limits…</p> : output ? <pre>{output.text}</pre> : <p>Run your code to see output. Execution is handled by the configured sandbox.</p>}{output?.time && <small>{output.time}s · {output.memory || '—'} KB</small>}</div>
                </section>
              </div>
            )}
          </main>
        </div>
      )}
    </section>
  )
}

function CodingHistory({ history }) {
  const isAdminActivity = history.some((item) => item.student)
  return <section className="panel coding-table-panel"><div className="coding-panel-title"><strong>{isAdminActivity ? 'Recent student submissions' : 'Practice history'}</strong><Activity size={16} /></div>{history.length ? <div className="coding-table-scroll"><table><thead><tr>{isAdminActivity && <th>Student</th>}<th>Problem</th><th>Language</th><th>Result</th><th>Tests</th><th>Date</th></tr></thead><tbody>{history.map((item) => <tr key={item._id}>{isAdminActivity && <td>{item.student?.name || item.student?.email || 'Student'}</td>}<td>{item.problem?.title || 'Removed problem'}</td><td>{item.language}</td><td><span className={`coding-result result-${item.status}`}>{item.status.replaceAll('_', ' ')}</span></td><td>{item.passedTests}/{item.totalTests}</td><td>{new Date(item.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <p className="coding-muted">Your submissions will appear here.</p>}</section>
}

function CodingLeaderboard({ leaders }) {
  return <section className="panel coding-table-panel"><div className="coding-panel-title"><strong>Coding leaderboard</strong><Trophy size={17} /></div><p className="coding-muted">Ranked by unique problems solved.</p>{leaders.length ? <div className="coding-leader-list">{leaders.map((item, index) => <div key={`${item.name}-${index}`}><span className="coding-rank">{index + 1}</span><strong>{item.name}</strong><span>{item.solved} solved</span>{index < 3 && <Award size={16} />}</div>)}</div> : <p className="coding-muted">Solve a problem to appear on the leaderboard.</p>}</section>
}

function ManageCodingProblems() {
  const [problems, setProblems] = useState([])
  const [editing, setEditing] = useState('')
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try { setProblems(await api.getManagedCodingProblems()) } catch (loadError) { setError(loadError.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function editProblem(problem) {
    setEditing(problem._id)
    setForm({ ...initialForm, ...problem, sampleCases: problem.sampleCases || initialForm.sampleCases, testCases: problem.testCases || initialForm.testCases, starterCode: problem.starterCode || initialForm.starterCode })
  }

  async function saveProblem(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const data = { ...form, sampleCases: form.sampleCases.map((item) => ({ input: item.input, output: item.output })), testCases: form.testCases.map((item) => ({ input: item.input, output: item.output })) }
      if (editing) await api.updateCodingProblem(editing, data)
      else await api.createCodingProblem(data)
      setForm(initialForm)
      setEditing('')
      await load()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function removeProblem(id) {
    if (!window.confirm('Delete this problem and its submission history?')) return
    try { await api.deleteCodingProblem(id); await load() } catch (deleteError) { setError(deleteError.message) }
  }

  const updateCase = (key, index, field, value) => setForm((current) => ({ ...current, [key]: current[key].map((item, position) => position === index ? { ...item, [field]: value } : item) }))
  const addCase = (key) => setForm((current) => current[key].length >= (key === 'sampleCases' ? 3 : 10) ? current : ({ ...current, [key]: [...current[key], { input: '', output: '' }] }))

  return <section className="coding-page">
    <header className="coding-heading"><div><p className="eyebrow">TEACHER STUDIO</p><h1>Coding problems</h1><p>Create challenges, provide sample tests, and publish them to students.</p></div></header>
    {error && <div className="coding-alert" role="alert"><CircleAlert size={16} />{error}</div>}
    <div className="coding-manage-grid">
      <form className="panel coding-manage-form" onSubmit={saveProblem}>
        <div className="coding-panel-title"><strong>{editing ? 'Edit problem' : 'Create a problem'}</strong>{editing && <button type="button" className="coding-text-button" onClick={() => { setEditing(''); setForm(initialForm) }}>Cancel edit</button>}</div>
        <label>Problem title<input required minLength="4" maxLength="160" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>Difficulty<select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}>{Object.entries(difficultyLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label>Description<textarea required minLength="20" maxLength="5000" rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <label>Input details<textarea maxLength="2000" rows={2} value={form.inputDescription} onChange={(event) => setForm({ ...form, inputDescription: event.target.value })} /></label>
        <label>Output details<textarea maxLength="2000" rows={2} value={form.outputDescription} onChange={(event) => setForm({ ...form, outputDescription: event.target.value })} /></label>
        <CodingCaseEditor title="Public sample cases" cases={form.sampleCases} onChange={(index, field, value) => updateCase('sampleCases', index, field, value)} onAdd={() => addCase('sampleCases')} />
        <CodingCaseEditor title="Private submit test cases" cases={form.testCases} onChange={(index, field, value) => updateCase('testCases', index, field, value)} onAdd={() => addCase('testCases')} />
        <details className="coding-starter-edit"><summary>Starter code by language</summary>{languages.map((item) => <label key={item.id}>{item.label}<textarea rows={3} value={form.starterCode[item.id] || ''} onChange={(event) => setForm({ ...form, starterCode: { ...form.starterCode, [item.id]: event.target.value } })} /></label>)}</details>
        <label className="coding-publish-check"><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} /> Publish for students</label>
        <button className="coding-submit coding-save" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create problem'}</button>
      </form>
      <section className="panel coding-managed-list"><div className="coding-panel-title"><strong>Managed problems</strong><span>{problems.length}</span></div>{loading ? <p className="coding-muted">Loading problems…</p> : problems.map((problem) => <article key={problem._id} className="coding-managed-item"><div><strong>{problem.title}</strong><small>{difficultyLabels[problem.difficulty]} · {problem.published ? 'Published' : 'Draft'}</small></div><button type="button" onClick={() => editProblem(problem)}>Edit</button><button type="button" className="coding-delete" onClick={() => removeProblem(problem._id)} aria-label={`Delete ${problem.title}`}><Trash2 size={15} /></button></article>)}</section>
    </div>
  </section>
}

function CodingCaseEditor({ title, cases, onChange, onAdd }) {
  return <fieldset className="coding-case-editor"><legend>{title}</legend>{cases.map((item, index) => <div className="coding-case-row" key={index}><label>Input<textarea rows={2} value={item.input} onChange={(event) => onChange(index, 'input', event.target.value)} /></label><label>Expected output<textarea rows={2} required value={item.output} onChange={(event) => onChange(index, 'output', event.target.value)} /></label></div>)}<button type="button" className="coding-text-button" onClick={onAdd}><Plus size={13} /> Add case</button></fieldset>
}

function AdminCodingActivity() {
  const [activity, setActivity] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.getCodingActivity().then(setActivity).catch((loadError) => setError(loadError.message)) }, [])
  return <section className="coding-page">
    <header className="coding-heading"><div><p className="eyebrow">ADMINISTRATION</p><h1>Coding activity</h1><p>Monitor coding practice submissions across the platform.</p></div></header>
    {error && <div className="coding-alert" role="alert"><CircleAlert size={16} />{error}</div>}
    {!activity ? <div className="coding-loading"><LoaderCircle className="coding-spin" size={22} /> Loading coding activity…</div> : <>
      <div className="coding-admin-stats"><div><Code2 size={19} /><strong>{activity.problemCount}</strong><small>problems</small></div><div><Activity size={19} /><strong>{activity.submissionCount}</strong><small>submissions</small></div></div>
      <CodingHistory history={activity.submissions} />
    </>}
  </section>
}

export default CodingPlayground
