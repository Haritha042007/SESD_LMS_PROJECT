import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Activity, AlertCircle, ArrowDown, ArrowDownRight, ArrowLeft, ArrowRight, Award, BookOpen, BriefcaseBusiness,
  Bot, CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, CloudUpload,
  Code2, Compass, Download, Eye, FileCheck2, FileText, Filter, Flame, GraduationCap, LayoutDashboard,
  LifeBuoy, LogOut, Menu, MoreHorizontal, Play, Plus, Search, Send, Settings, ShieldCheck, Sparkles,
  Star, Target, Timer, Trophy, UserRound, Users, Video, WandSparkles, X, Zap,
} from 'lucide-react'
import { api } from './services/api'
import AssistantPage from './AssistantPage'
import CodingPlayground from './CodingPlayground'
import ExamCenter from './ExamCenter'

const portalMeta = {
  student: { label: 'Student', name: 'Haritha', initials: 'HA' },
  teacher: { label: 'Teacher', name: 'Olivia Rhye', initials: 'OR' },
  admin: { label: 'Admin', name: 'Jordan Lee', initials: 'JL' },
}

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(api.hasToken())
  const [toast, setToast] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])
  const notify = (message) => setToast(message)
  useEffect(() => {
    if (!api.hasToken()) return undefined
    let mounted = true
    api.getMe().then((currentUser) => {
      if (mounted) setUser(currentUser)
    }).catch((error) => {
      if (mounted) {
        setUser(null)
        setToast(error.message)
      }
    }).finally(() => {
      if (mounted) setAuthLoading(false)
    })
    return () => { mounted = false }
  }, [])
  useEffect(() => {
    function onUnauthorized() {
      setUser(null)
      setToast('Your session expired. Please sign in again.')
    }
    window.addEventListener('learnly:unauthorized', onUnauthorized)
    return () => window.removeEventListener('learnly:unauthorized', onUnauthorized)
  }, [])
  function handleAuthenticated(authenticatedUser) {
    setUser(authenticatedUser)
    setAuthLoading(false)
  }
  async function handleLogout() {
    try {
      await api.logout()
    } catch (error) {
      notify(error.message)
      api.clearToken()
    }
    setUser(null)
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" onAuthenticated={handleAuthenticated} notify={notify} />} />
        <Route path="/register" element={<AuthPage mode="register" onAuthenticated={handleAuthenticated} notify={notify} />} />
        <Route path="/" element={<Navigate to={user ? `/${user.role}/dashboard` : '/login'} replace />} />
        <Route path="/:portal" element={<PortalGuard user={user} loading={authLoading} onLogout={handleLogout} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} notify={notify} />}>
          <Route path="dashboard" element={<Dashboard notify={notify} user={user} />} />
          <Route path="courses" element={<CoursesPage notify={notify} user={user} />} />
          <Route path="courses/new" element={<RoleGate roles={['teacher', 'admin']}><CourseEditor notify={notify} /></RoleGate>} />
          <Route path="courses/:courseId/edit" element={<RoleGate roles={['teacher', 'admin']}><CourseEditor notify={notify} /></RoleGate>} />
          <Route path="courses/:courseId" element={<CourseDetails notify={notify} user={user} />} />
          <Route path="assistant" element={<RoleGate roles={['student']}><AssistantPage /></RoleGate>} />
          <Route path="coding" element={<CodingPlayground user={user} />} />
          <Route path="exams" element={<ExamCenter user={user} />} />
          <Route path="lesson/:courseId" element={<RoleGate roles={['student']}><LessonPage notify={notify} /></RoleGate>} />
          <Route path="quiz" element={<RoleGate roles={['student']}><QuizPage notify={notify} /></RoleGate>} />
          <Route path="quiz/new" element={<RoleGate roles={['teacher', 'admin']}><QuizBuilder notify={notify} /></RoleGate>} />
          <Route path="assignments" element={<Assignments notify={notify} user={user} />} />
          <Route path="planner" element={<RoleGate roles={['student']}><Planner notify={notify} /></RoleGate>} />
          <Route path="achievements" element={<RoleGate roles={['student']}><Achievements notify={notify} user={user} /></RoleGate>} />
          <Route path="study-timer" element={<RoleGate roles={['student']}><StudyTimer notify={notify} /></RoleGate>} />
          <Route path="certificates" element={<RoleGate roles={['student']}><Certificates notify={notify} user={user} /></RoleGate>} />
          <Route path="analytics" element={<Analytics user={user} />} />
          <Route path="students" element={<RoleGate roles={['admin']}><PeoplePage kind="Students" notify={notify} /></RoleGate>} />
          <Route path="teachers" element={<RoleGate roles={['admin']}><PeoplePage kind="Teachers" notify={notify} /></RoleGate>} />
          <Route path="approvals" element={<RoleGate roles={['admin']}><Approvals notify={notify} /></RoleGate>} />
          <Route path="categories" element={<RoleGate roles={['admin']}><Categories notify={notify} /></RoleGate>} />
          <Route path="reports" element={<RoleGate roles={['admin']}><Reports /></RoleGate>} />
          <Route path="settings" element={<SettingsPage notify={notify} />} />
          <Route path="profile" element={<ProfilePage user={user} notify={notify} />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
      {toast && <div className="toast"><Check size={17} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={15} /></button></div>}
    </>
  )
}

function PortalGuard({ user, loading, onLogout, sidebarOpen, setSidebarOpen, notify }) {
  const { portal } = useParams()
  if (loading) return <LoadingBlock />
  if (!user) return <Navigate to="/login" replace />
  if (portal !== user.role) return <Navigate to={`/${user.role}/dashboard`} replace />
  if (user.role === 'teacher' && user.approvalStatus !== 'approved') return <PendingTeacher onLogout={onLogout} user={user} />
  return <PortalLayout role={user.role} user={user} onLogout={onLogout} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} notify={notify} />
}

function PendingTeacher({ onLogout, user }) {
  return <main className="auth-page"><section className="panel"><p className="eyebrow">TEACHER ACCOUNT</p><h1>Approval required</h1><p>{user.approvalStatus === 'rejected' ? 'Your teacher application was not approved. Contact an administrator for more information.' : 'Your teacher account is waiting for admin approval. Course and analytics tools will be available once approved.'}</p><Button onClick={onLogout}>Sign out <LogOut size={15} /></Button></section></main>
}

function RoleGate({ roles, children }) {
  const { portal } = useParams()
  return roles.includes(portal) ? children : <Navigate to={`/${portal}/dashboard`} replace />
}

const studentNav = [
  { label: 'Overview', items: [['Dashboard', 'dashboard', LayoutDashboard], ['My courses', 'courses', BookOpen], ['Assignments', 'assignments', FileCheck2]] },
  { label: 'Your learning', items: [['AI Assistant', 'assistant', Bot], ['Coding practice', 'coding', Code2], ['Examinations', 'exams', FileCheck2], ['Study planner', 'planner', CalendarDays], ['Achievements', 'achievements', Trophy], ['Certificates', 'certificates', Award]] },
]
const teacherNav = [
  { label: 'Workspace', items: [['Dashboard', 'dashboard', LayoutDashboard], ['My courses', 'courses', BookOpen], ['Coding problems', 'coding', Code2], ['Examinations', 'exams', FileCheck2], ['Assignments', 'assignments', FileCheck2]] },
  { label: 'Insights', items: [['Analytics', 'analytics', Activity]] },
]
const adminNav = [
  { label: 'Platform', items: [['Dashboard', 'dashboard', LayoutDashboard], ['Courses', 'courses', BookOpen], ['Coding activity', 'coding', Code2], ['Students', 'students', Users], ['Teachers', 'teachers', GraduationCap]] },
  { label: 'Management', items: [['Examination reports', 'exams', FileCheck2], ['Approvals', 'approvals', ShieldCheck], ['Categories', 'categories', Filter], ['Reports', 'reports', Activity], ['Settings', 'settings', Settings]] },
]

function PortalLayout({ role, user, onLogout, sidebarOpen, setSidebarOpen, notify }) {
  const { portal = 'student' } = useParams()
  const validRole = role
  const nav = validRole === 'teacher' ? teacherNav : validRole === 'admin' ? adminNav : studentNav
  const meta = { ...portalMeta[validRole], name: user.name, initials: user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() }
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  return (
    <div className="app-shell">
      {sidebarOpen && <button className="mobile-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Link to={`/${validRole}/dashboard`} className="brand"><span className="brand-mark"><GraduationCap size={22} /></span><span>learnly<span className="brand-dot">.</span></span></Link>
        <div className="workspace-switch"><div className="workspace-avatar">{validRole === 'student' ? 'S' : validRole === 'teacher' ? 'T' : 'L'}</div><div><strong>{validRole === 'student' ? 'Student space' : validRole === 'teacher' ? 'Teacher studio' : 'Learnly workspace'}</strong><small>{validRole === 'admin' ? 'Administration' : 'Personal workspace'}</small></div><ChevronDown size={15} /></div>
        {nav.map((group) => <div className="nav-group" key={group.label}><p className="nav-label">{group.label}</p>{group.items.map(([label, path, Icon]) => <NavLink key={path} to={`/${validRole}/${path}`} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={18} /><span>{label}</span>{path === 'approvals' && <span className="nav-count">3</span>}</NavLink>)}</div>)}
        {validRole === 'student' && <div className="sidebar-promo"><div className="promo-icon"><Sparkles size={17} /></div><strong>Keep your streak going!</strong><p>You’re doing amazing. Keep learning every day.</p><Link to="/student/study-timer">Start a session <ArrowRight size={14} /></Link></div>}
        <div className="sidebar-bottom">
          <div className="role-switch"><span>Signed in as</span><strong>{portalMeta[validRole].label}</strong></div>
          <NavLink to={`/${validRole}/settings`} className="nav-link"><Settings size={18} /><span>Settings</span></NavLink>
          <NavLink to={`/${validRole}/profile`} className="nav-link"><UserRound size={18} /><span>My profile</span></NavLink>
          <div className="profile-mini"><div className={`avatar avatar-${validRole}`}>{meta.initials}</div><div><strong>{meta.name}</strong><small>{user.email}</small></div><button className="icon-button" onClick={onLogout} aria-label="Sign out"><LogOut size={17} /></button></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumb"><span>{meta.label} portal</span><ChevronRight size={15} /><strong>{window.location.pathname.split('/').filter(Boolean).slice(1).join(' / ') || 'Dashboard'}</strong></div>
          <div className="topbar-actions">
            {searchOpen ? <div className="top-search"><Search size={16} /><input autoFocus placeholder="Search courses..." value={searchValue} onChange={(e) => setSearchValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (window.location.href = `/${validRole}/courses?search=${encodeURIComponent(searchValue)}`)} /><button onClick={() => { setSearchOpen(false); setSearchValue('') }} aria-label="Close search"><X size={15} /></button></div> : <button className="icon-button search-toggle" onClick={() => setSearchOpen(true)} aria-label="Search"><Search size={19} /></button>}
            <button className="icon-button notification-button" onClick={() => notify('You’re all caught up!')} aria-label="Notifications"><span className="notification-dot" /><Activity size={19} /></button>
            <Link to={`/${validRole}/profile`} className={`avatar avatar-${validRole}`}>{meta.initials}</Link>
          </div>
        </header>
        <div className="page-content"><RoutesOutlet role={validRole} notify={notify} /></div>
      </main>
    </div>
  )
}

function RoutesOutlet({ role, notify }) {
  return <Outlet context={{ role, notify }} />
}

function PageTitle({ eyebrow, title, subtitle, action }) {
  return <div className="page-title-row"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{subtitle && <p className="page-subtitle">{subtitle}</p>}</div>{action && <div className="title-action">{action}</div>}</div>
}

function Button({ children, variant = 'primary', icon: Icon, onClick, type = 'button', className = '', disabled = false }) {
  return <button type={type} disabled={disabled} onClick={onClick} className={`button button-${variant} ${className}`}>{Icon && <Icon size={16} />}{children}</button>
}

function StatCard({ label, value, change, icon: Icon, color = 'blue', sub }) {
  return <div className="stat-card"><div className={`stat-icon stat-${color}`}><Icon size={19} /></div><p className="stat-label">{label}</p><div className="stat-value-row"><strong>{value}</strong>{change && <span className="stat-change"><ArrowDownRight size={13} />{change}</span>}</div>{sub && <p className="stat-sub">{sub}</p>}</div>
}

function CourseCard({ course, compact = false, onContinue, basePath = '/student/courses' }) {
  return <article className="course-card">
    <div className={`course-art art-${course.color || 'blue'}`}><span className="course-symbol">{course.icon || '✳'}</span><span className="course-category">{course.category}</span><button className="course-more" aria-label="More course options"><MoreHorizontal size={19} /></button></div>
    <div className="course-card-body"><div className="course-meta"><span><Clock3 size={13} />{course.duration}</span><span><BookOpen size={13} />{course.lessonCount ?? course.lessons} lessons</span></div>
      <Link className="course-card-title" to={`${basePath}/${course.id}`}>{course.title}</Link><p className="course-teacher">By {course.teacher}</p>
      {compact ? <div className="course-progress-row"><div className="progress-track"><span style={{ width: `${course.progress}%` }} /></div><strong>{course.progress}%</strong></div> : <div className="course-footer"><span className="course-rating"><Star size={14} fill="currentColor" />{course.rating} <span>({Number(course.students || 0).toLocaleString()})</span></span><Button variant="soft" onClick={() => onContinue ? onContinue(course) : window.location.assign(`/student/courses/${course.id}`)}>{course.isEnrolled || course.progress > 0 ? 'Continue' : 'Explore'} <ArrowRight size={14} /></Button></div>}
    </div>
  </article>
}

function LoadingBlock({ label = 'Loading your learning space...' }) {
  return <div className="loading-state"><span className="spinner" /><span>{label}</span></div>
}

function EmptyState({ title, detail, action }) {
  return <div className="empty-state"><div className="empty-icon"><BookOpen size={22} /></div><strong>{title}</strong><p>{detail}</p>{action}</div>
}

function ErrorState({ message, onRetry }) {
  return <div className="empty-state error-state"><div className="empty-icon"><AlertCircle size={22} /></div><strong>We couldn’t load this right now</strong><p>{message || 'Please check your connection and try again.'}</p><Button variant="soft" onClick={onRetry}>Try again</Button></div>
}

function AuthPage({ mode, onAuthenticated, notify }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [role, setRole] = useState('student')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  async function submit(e) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '')
    if (!email.includes('@')) return setError('Enter a valid email address.')
    if (isRegister && (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password))) {
      return setError('Use 10–128 characters with at least one uppercase letter, lowercase letter, and number.')
    }
    setError('')
    setSubmitting(true)
    try {
      const user = isRegister
        ? await api.register({ name: String(form.get('name') || '').trim(), email, password, role })
        : await api.login({ email, password })
      onAuthenticated(user)
      notify(isRegister
        ? user.role === 'teacher' ? 'Account created. Teacher tools are available after admin approval.' : 'Your Learnly account is ready!'
        : 'Welcome back to Learnly!')
      navigate(`/${user.role}/dashboard`, { replace: true })
    } catch (authError) {
      setError(authError.message)
    } finally {
      setSubmitting(false)
    }
  }
  return <div className="auth-page"><div className="auth-visual"><Link to="/" className="brand auth-brand"><span className="brand-mark"><GraduationCap size={22} /></span><span>learnly<span className="brand-dot">.</span></span></Link>
    <div className="auth-message"><div className="auth-sparkle"><Sparkles size={18} /></div><h1>Make learning<br />your superpower.</h1><p>A little progress each day adds up to big results. Your next chapter starts here.</p><div className="auth-proof"><div className="proof-avatars"><span>AM</span><span>TK</span><span>JL</span><span>+2k</span></div><div><div className="proof-stars">★★★★★</div><small>Loved by learners everywhere</small></div></div></div>
    <div className="auth-decoration decor-one" /><div className="auth-decoration decor-two" /><div className="auth-visual-footer">© 2025 Learnly Inc. · Learning without limits</div></div>
    <div className="auth-form-wrap"><div className="auth-form"><div className="auth-mobile-brand"><Link to="/" className="brand"><span className="brand-mark"><GraduationCap size={22} /></span><span>learnly<span className="brand-dot">.</span></span></Link></div><p className="eyebrow">{isRegister ? 'GET STARTED FOR FREE' : 'WELCOME BACK'}</p><h2>{isRegister ? 'Create your account' : 'Sign in to your account'}</h2><p className="auth-subtitle">{isRegister ? 'Start learning something new today.' : 'Enter your details to pick up where you left off.'}</p>
      <form onSubmit={submit} noValidate>{isRegister && <label>Full name<input required name="name" placeholder="Your full name" autoComplete="name" minLength="2" maxLength="100" /></label>}<label>Email address<input required name="email" type="email" placeholder="you@example.com" autoComplete="email" /></label>
        {isRegister && <label>I’m joining as<select value={role} onChange={(e) => setRole(e.target.value)}><option value="student">Student</option><option value="teacher">Teacher</option></select></label>}
        <label>Password<div className="password-field"><input required name="password" type={showPassword ? 'text' : 'password'} minLength={isRegister ? '10' : '1'} maxLength="128" placeholder={isRegister ? '10+ characters, mixed case and a number' : 'Your password'} autoComplete={isRegister ? 'new-password' : 'current-password'} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}><Eye size={16} /></button></div></label>
        {!isRegister && <div className="form-inline"><label className="checkbox-label"><input type="checkbox" /> Remember me</label><button type="button" className="text-button" onClick={() => notify('Password reset instructions are ready to be connected to your email service.')}>Forgot password?</button></div>}
        {error && <div className="form-error"><AlertCircle size={15} />{error}</div>}<Button type="submit" className="full-button" disabled={submitting}>{submitting ? 'Connecting...' : isRegister ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></Button>
      </form><p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to Learnly?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p><div className="secure-note"><ShieldCheck size={15} /> Secure sign-in · Your data stays private</div></div></div></div>
}

function Dashboard({ user, notify }) {
  const role = user.role
  const [items, setItems] = useState([])
  const [stats, setStats] = useState(null)
  const [recentSessions, setRecentSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  async function loadCourses() {
    setLoading(true)
    setError('')
    try {
      const [courses, dashboard, sessions] = await Promise.all([
        api.getCourses({ role }),
        api.getDashboard(),
        role === 'student' ? api.getStudySessions() : Promise.resolve([]),
      ])
      setItems(courses)
      setStats(dashboard)
      setRecentSessions(sessions.slice(0, 3))
    } catch (loadError) { setError(loadError.message); notify(loadError.message) } finally { setLoading(false) }
  }
  useEffect(() => { loadCourses() }, [])
  const enrolled = role === 'student' ? items.filter((course) => course.isEnrolled) : items
  if (loading) return <LoadingBlock />
  if (error) return <ErrorState message={error} onRetry={loadCourses} />
  if (role === 'teacher') return <TeacherDashboard items={items} stats={stats} user={user} notify={notify} />
  if (role === 'admin') return <AdminDashboard items={items} stats={stats} user={user} />
  const currentDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase()
  return <div className="dashboard-page">
    <PageTitle eyebrow={currentDate} title={<>Good morning, {user.name} <span className="wave">✦</span></>} subtitle="Ready to make today a little more productive?" action={<Button variant="soft" icon={CalendarDays} onClick={() => window.location.assign('/student/planner')}>View planner</Button>} />
    <div className="welcome-banner"><div className="welcome-copy"><span className="welcome-kicker"><Flame size={15} /> {stats.streakDays || 0} DAY STREAK</span><h2>You’re on a roll, {user.name}!</h2><p>Keep your learning momentum going with a focused session today.</p><Link to="/student/study-timer">Start a study session <ArrowRight size={15} /></Link></div><div className="streak-art"><div className="streak-orbit orbit-one" /><div className="streak-orbit orbit-two" /><div className="streak-flame"><Flame size={43} fill="currentColor" /></div><div className="streak-pill"><Zap size={14} fill="currentColor" /> {(stats.xp || 0).toLocaleString()} XP</div></div></div>
    <div className="stats-grid"><StatCard label="Courses in progress" value={String(enrolled.length).padStart(2, '0')} icon={BookOpen} color="violet" /><StatCard label="Learning hours" value={`${((stats.studyTimeMinutes || 0) / 60).toFixed(1)}h`} icon={Clock3} color="blue" /><StatCard label="Average score" value={`${stats.averageQuizScore || 0}%`} icon={Target} color="green" /><StatCard label="Quizzes completed" value={stats.quizzesTaken || 0} sub="Scores are calculated by the server" icon={Award} color="orange" /></div>
    <div className="section-heading"><div><h2>Continue learning</h2><p>Pick up right where you left off</p></div><Link className="inline-link" to="/student/courses">View all courses <ArrowRight size={15} /></Link></div>
    {enrolled.length ? <div className="course-grid dashboard-course-grid">{enrolled.slice(0, 3).map((course) => <CourseCard key={course.id} course={course} compact />)}</div> : <EmptyState title="No courses in progress yet" detail="Explore the catalog to find your next learning adventure." action={<Link className="inline-link" to="/student/courses">Browse courses <ArrowRight size={15} /></Link>} />}
    <div className="dashboard-bottom"><section className="panel learning-panel"><div className="panel-heading"><div><h3>Recorded study time</h3><p>Total time logged to your account</p></div></div><div className="summary-row"><span>All sessions</span><strong>{((stats.studyTimeMinutes || 0) / 60).toFixed(1)} hours</strong></div><small>Daily activity chart is not available from the current API.</small></section><section className="panel activity-panel"><div className="panel-heading"><div><h3>Recent study sessions</h3><p>Saved by the LMS backend</p></div></div>{recentSessions.length ? <div className="activity-list">{recentSessions.map((session) => <div className="activity-item" key={session._id}><div className="activity-icon activity-check"><Clock3 size={16} /></div><div><strong>{session.durationMinutes} minute study session</strong><small>{session.course?.title || 'Independent study'}</small><span>{new Date(session.studiedAt).toLocaleString()}</span></div></div>)}</div> : <EmptyState title="No study sessions yet" detail="Complete a focus timer session to see it here." />}</section></div>
  </div>
}

function LearningChart() {
  return <div className="chart-wrap"><div className="chart-y-labels"><span>8h</span><span>6h</span><span>4h</span><span>2h</span><span>0h</span></div><div className="chart-main"><div className="chart-grid"><i /><i /><i /><i /><i /></div><svg viewBox="0 0 600 178" preserveAspectRatio="none" role="img" aria-label="Study time chart showing 3.5 hours on Monday, 5 hours Tuesday, 3 hours Wednesday, 6 hours Thursday, 4 hours Friday and 7 hours Saturday"><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#7564e8" stopOpacity=".2" /><stop offset="100%" stopColor="#7564e8" stopOpacity="0" /></linearGradient></defs><path d="M0 107 C45 100 55 72 100 75 S155 124 200 116 S255 56 300 62 S355 96 400 84 S455 44 500 49 S555 30 600 24 V178 H0Z" fill="url(#chart-fill)" /><path d="M0 107 C45 100 55 72 100 75 S155 124 200 116 S255 56 300 62 S355 96 400 84 S455 44 500 49 S555 30 600 24" fill="none" stroke="#7564e8" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></svg><div className="chart-x-labels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div></div>
}

function TeacherDashboard({ items, stats, user, notify }) {
  const mine = items.slice(0, 3)
  return <div><PageTitle eyebrow="TEACHER STUDIO" title={`Welcome, ${user.name}`} subtitle={user.approvalStatus === 'pending' ? 'Your teacher account is awaiting administrator approval.' : 'Here’s what’s happening in your classroom today.'} action={<Link to="/teacher/courses/new"><Button icon={Plus}>Create a course</Button></Link>} /><div className="stats-grid"><StatCard label="Total students" value={stats.students || 0} icon={Users} color="blue" /><StatCard label="Active courses" value={stats.publishedCourses || 0} sub={`${stats.courses || 0} courses owned`} icon={BookOpen} color="violet" /><StatCard label="Assignments" value={stats.assignments || 0} icon={Target} color="green" /><StatCard label="Published courses" value={stats.publishedCourses || 0} sub="Visible in course catalog" icon={FileCheck2} color="orange" /></div><div className="section-heading"><div><h2>Your courses</h2><p>Manage and track your published content</p></div><Link className="inline-link" to="/teacher/courses">View all <ArrowRight size={15} /></Link></div>{mine.length ? <div className="course-grid">{mine.map((course) => <CourseCard key={course.id} course={course} basePath="/teacher/courses" onContinue={() => window.location.assign('/teacher/courses')} />)}</div> : <EmptyState title="No courses created yet" detail="Create your first course to start building your classroom." action={<Link to="/teacher/courses/new"><Button icon={Plus}>Create a course</Button></Link>} />}</div>
}

function AdminDashboard({ items, stats, user }) {
  const platform = stats || {}
  return <div><PageTitle eyebrow="PLATFORM OVERVIEW" title={`Welcome, ${user.name}`} subtitle="Here’s what’s happening across Learnly today." action={<Button variant="soft" icon={Download} onClick={() => window.print()}>Export report</Button>} /><div className="stats-grid"><StatCard label="Total learners" value={platform.students || 0} icon={Users} color="blue" /><StatCard label="Active teachers" value={platform.teachers || 0} icon={GraduationCap} color="violet" /><StatCard label="Published courses" value={platform.publishedCourses || 0} icon={BookOpen} color="green" /><StatCard label="Teacher approvals" value={platform.pendingTeachers || 0} icon={Target} color="orange" /></div><div className="admin-feature-grid"><section className="panel"><div className="panel-heading"><div><h3>Platform overview</h3><p>{platform.enrollments || 0} enrollments · {platform.submissions || 0} submissions</p></div></div><div className="stats-grid compact-stats"><StatCard label="All courses" value={platform.courses || items.length} icon={BookOpen} color="violet" /></div></section><section className="admin-approval-card"><div className="approval-icon"><ShieldCheck size={20} /></div><span className="approval-number">{String(platform.pendingTeachers || 0).padStart(2, '0')}</span><h3>Teacher approvals</h3><p>New teacher profiles waiting for review.</p><Link to="/admin/approvals">Review applications <ArrowRight size={15} /></Link></section></div></div>
}

function CoursesPage({ user, notify }) {
  const role = user.role
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState(new URLSearchParams(window.location.search).get('search') || '')
  const [category, setCategory] = useState('All categories')
  async function loadCourses() {
    setLoading(true)
    setError('')
    try { setItems(await api.getCourses({ role })) } catch (loadError) { setError(loadError.message); notify(loadError.message) } finally { setLoading(false) }
  }
  useEffect(() => { loadCourses() }, [])
  const categories = ['All categories', ...new Set(items.map((course) => course.category))]
  const filtered = useMemo(() => items.filter((course) => (role !== 'student' || course.status !== 'Draft') && (category === 'All categories' || course.category === category) && `${course.title} ${course.teacher} ${course.category}`.toLowerCase().includes(search.toLowerCase())), [items, category, search, role])
  const isStaff = role !== 'student'
  return <div><PageTitle eyebrow={isStaff ? 'COURSE MANAGEMENT' : 'EXPLORE & GROW'} title={isStaff ? 'Course library' : 'Explore courses'} subtitle={isStaff ? 'Create and manage your learning content.' : 'Discover your next favorite thing to learn.'} action={isStaff && <Link to={`/${role}/courses/new`}><Button icon={Plus}>Create course</Button></Link>} />
    <div className="catalog-toolbar"><div className="catalog-search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses, topics, instructors..." /></div><label className="filter-select"><Filter size={16} /><select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label><span className="results-count">{filtered.length} courses</span></div>
    {loading ? <LoadingBlock label="Finding great courses..." /> : error ? <ErrorState message={error} onRetry={loadCourses} /> : filtered.length ? <div className="course-grid catalog-grid">{filtered.map((course) => <CourseCard key={course.id} course={course} basePath={`/${role}/courses`} onContinue={async () => { if (role === 'student' && !course.isEnrolled) { try { await api.enrollCourse(course.id); notify('You’re enrolled! Your course is ready.'); window.location.assign(`/student/courses/${course.id}`) } catch (enrollError) { notify(enrollError.message) } } else window.location.assign(`/${role}/courses/${course.id}`) }} />)}</div> : <EmptyState title="No courses match your search" detail="Try another keyword or choose a different category." action={<Button variant="soft" onClick={() => { setSearch(''); setCategory('All categories') }}>Clear filters</Button>} />}
  </div>
}

function CourseDetails({ notify, user }) {
  const { courseId, portal = 'student' } = useParams()
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let mounted = true
    Promise.all([
      api.getCourse(courseId),
      user.role === 'student' ? api.getProgress() : Promise.resolve(null),
    ]).then(([item, progress]) => {
      if (!mounted) return
      const enrollment = progress?.courses?.find((entry) => entry.course.id === courseId)
      setCourse({ ...item, isEnrolled: Boolean(enrollment), progress: enrollment?.progressPercent || 0, completedLessons: enrollment?.completedLessons || [] })
    }).catch((error) => notify(error.message)).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [courseId, user.role])
  if (loading) return <LoadingBlock />
  if (!course) return <EmptyState title="Course not found" detail="This course may have been removed or is no longer available." action={<Link className="inline-link" to={`/${portal}/courses`}>Back to courses <ArrowRight size={15} /></Link>} />
  return <div><Link to={`/${portal}/courses`} className="back-link"><ArrowLeft size={16} /> Back to courses</Link>  <div className="detail-hero"><div className={`detail-art art-${course.color}`}><span>{course.icon}</span><div className="detail-art-orbit" /></div><div className="detail-copy"><span className="badge">{course.category}</span><h1>{course.title}</h1><p>{course.description}</p><div className="detail-byline"><div className="avatar avatar-violet">{course.teacher.split(' ').map((part) => part[0]).join('')}</div><span>Created by <strong>{course.teacher}</strong></span><span className="course-rating"><Star size={14} fill="currentColor" />{course.rating}</span></div><div className="detail-facts"><span><Play size={15} />{course.lessonCount} lessons</span><span><Clock3 size={15} />{course.duration}</span><span><Users size={15} />{Number(course.students).toLocaleString()} learners</span></div>{portal === 'student' ? <Button icon={Play} onClick={async () => { if (!course.isEnrolled) { try { await api.enrollCourse(course.id); notify('You’re enrolled! Your course is ready.') } catch (error) { notify(error.message); return } } window.location.assign(`/student/lesson/${course.id}`) }}>{course.isEnrolled ? 'Continue learning' : 'Start learning'}</Button> : <Link to={`/${portal}/courses/${course.id}/edit`}><Button icon={Settings}>Edit course</Button></Link>}</div></div><div className="detail-columns"><section className="panel"><h3>What you’ll learn</h3><div className="learn-list">{(course.objectives?.length ? course.objectives : ['Build practical skills through course lessons', 'Apply concepts to real-world challenges']).map((objective) => <span key={objective}><CheckCheck size={17} /> {objective}</span>)}</div><h3 className="content-heading">Course content</h3>{course.lessonList.map((lesson, index) => <details className="lesson-accordion" key={lesson._id || lesson.title} open={index === 0}><summary><span><ChevronRight size={15} /> {lesson.title}</span><small>{lesson.durationMinutes || 0} min</small></summary><div className="accordion-lesson"><Play size={14} /> {lesson.description || lesson.topic || 'Course lesson'} <span>{lesson.topic || 'Lesson'}</span></div></details>)}</section><aside className="panel course-summary"><h3>Your progress</h3><div className="big-progress"><span>{course.progress || 0}%</span><div className="progress-track"><span style={{ width: `${course.progress}%` }} /></div><small>{course.progress ? 'You’re making great progress!' : 'Start learning to track your progress'}</small></div><div className="summary-row"><span>Lessons completed</span><strong>{course.completedLessons?.length || 0} / {course.lessonCount}</strong></div><div className="summary-row"><span>Estimated time</span><strong>{course.duration}</strong></div></aside></div></div>
}

function CourseEditor({ notify }) {
  const navigate = useNavigate()
  const { courseId, portal = 'teacher' } = useParams()
  const [existing, setExisting] = useState(null)
  const [categories, setCategories] = useState(['Software Engineering', 'Statistics', 'Algorithms', 'Critical Thinking', 'Artificial Intelligence'])
  const [loading, setLoading] = useState(Boolean(courseId))
  const [saving, setSaving] = useState(false)
  const [studyNotes, setStudyNotes] = useState('')
  useEffect(() => {
    api.getCategories().then((items) => setCategories(items.map((item) => item.name))).catch((error) => notify(error.message))
  }, [])
  useEffect(() => {
    if (!courseId) return
    let mounted = true
    api.getCourse(courseId).then((item) => { if (mounted) { setExisting(item); setStudyNotes(item.studyNotes || '') } }).catch((error) => notify(error.message)).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [courseId])
  async function submit(e) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget))
    if (String(data.title).trim().length < 4) return notify('Course title must be at least 4 characters.')
    const lessonLines = String(data.lessonTitles || '').split('\n').map((line) => line.trim()).filter(Boolean)
    const lessonList = lessonLines.length
      ? lessonLines.map((line, index) => {
        const [title, videoUrl = ''] = line.split('|').map((part) => part.trim())
        const oldLesson = existing?.lessonList.find((item) => item.title === title) || existing?.lessonList[index]
        return {
          ...(oldLesson?._id ? { _id: oldLesson._id } : {}),
          title,
          description: oldLesson?.description || '',
          topic: oldLesson?.topic || data.category,
          durationMinutes: oldLesson?.durationMinutes || 20,
          videoUrl: videoUrl || oldLesson?.videoUrl || '',
          resources: oldLesson?.resources?.map(({ _id, ...resource }) => resource) || [],
        }
      })
      : existing?.lessonList || []
    if (!lessonList.length) return notify('Add at least one lesson before saving this course.')
    setSaving(true)
    try {
      await api.saveCourse({
        ...data,
        id: courseId,
        objectives: String(data.objectives || '').split('\n').map((item) => item.trim()).filter(Boolean),
        studyNotes,
        lessonList,
      })
      notify(data.status === 'Published' ? 'Course published successfully.' : 'Course saved as a draft.')
      navigate(`/${portal}/courses`)
    } catch (error) {
      notify(error.message)
    } finally { setSaving(false) }
  }
  async function importStudyNotes(event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    try {
      const imported = []
      for (const file of files) {
        if (!/\.(txt|md)$/i.test(file.name) || file.size > 100_000) {
          throw new Error('Choose plain-text .txt or .md notes up to 100 KB each.')
        }
        imported.push(`# ${file.name}\n${await file.text()}`)
      }
      const combined = [studyNotes, ...imported].filter(Boolean).join('\n\n')
      if (combined.length > 50000) throw new Error('Course notes must be 50,000 characters or fewer.')
      setStudyNotes(combined)
      notify(`${files.length} note file${files.length === 1 ? '' : 's'} imported. Save the course to make them available to students.`)
    } catch (error) {
      notify(error.message)
    } finally {
      event.target.value = ''
    }
  }
  if (loading) return <LoadingBlock />
  if (courseId && !existing) return <EmptyState title="Course not found" detail="This course could not be loaded for editing." action={<Link className="inline-link" to={`/${portal}/courses`}>Back to courses <ArrowRight size={15} /></Link>} />
  return <div><Link to={`/${portal}/courses`} className="back-link"><ArrowLeft size={16} /> Back to courses</Link><PageTitle eyebrow="TEACHER STUDIO" title={courseId ? 'Edit course' : 'Create a course'} subtitle={courseId ? 'Update course details, lessons, and publishing status.' : 'Build a learning experience your students will love.'} /><form className="panel editor-form" onSubmit={submit}><div className="form-section-heading"><span>01</span><div><h3>Course details</h3><p>Course information and lesson content are saved to the LMS API.</p></div></div><label>Course title<input name="title" required minLength="4" defaultValue={existing?.title || ''} placeholder="e.g. Introduction to software engineering" /></label><div className="form-two-cols"><label>Category<select name="category" defaultValue={existing?.category || categories[0]}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Level<select name="level" defaultValue={existing?.level || 'Beginner'}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label></div><label>Course description<textarea name="description" required minLength="20" rows="4" defaultValue={existing?.description || ''} placeholder="What will students learn in this course?" /></label><label>Learning objectives<textarea name="objectives" rows="3" defaultValue={existing?.objectives?.join('\n') || ''} placeholder="Enter one objective per line" /></label><label>Lessons<textarea name="lessonTitles" rows="5" required={!courseId} defaultValue={existing?.lessonList?.map((lesson) => `${lesson.title}${lesson.videoUrl ? ` | ${lesson.videoUrl}` : ''}`).join('\n') || ''} placeholder="Lesson title | https://video.example.com/lesson.mp4" /><small>One lesson per line. Add an optional HTTP(S) video URL after |.</small></label><label>Import course notes<input type="file" accept=".txt,.md,text/plain,text/markdown" multiple onChange={importStudyNotes} /><small>Plain-text and Markdown only, up to 100 KB per file. Notes are stored in the course and can be used by the learning assistant.</small></label><label>Course notes for the learning assistant<textarea name="studyNotes" rows="7" maxLength="50000" value={studyNotes} onChange={(event) => setStudyNotes(event.target.value)} placeholder="Paste or import course notes here. The assistant uses these notes as reference material." /><small>{studyNotes.length.toLocaleString()} / 50,000 characters</small></label><label>Publishing status<select name="status" defaultValue={existing?.status || (courseId ? 'Published' : 'Draft')}><option>Draft</option><option>Published</option></select></label><div className="form-actions"><Button variant="soft" onClick={() => navigate(`/${portal}/courses`)}>Cancel</Button><Button type="submit" icon={saving ? undefined : Check} disabled={saving}>{saving ? 'Saving...' : courseId ? 'Save changes' : 'Save course'}</Button></div></form></div>
}

function LessonPage({ notify }) {
  const { courseId } = useParams()
  const initialLessonId = new URLSearchParams(window.location.search).get('lessonId')
  const [course, setCourse] = useState(null)
  const [active, setActive] = useState(0)
  const [completed, setCompleted] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let mounted = true
    Promise.all([api.getCourse(courseId), api.getProgress()]).then(([item, progress]) => {
      if (!mounted) return
      const enrollment = progress.courses.find((entry) => entry.course.id === courseId)
      if (!enrollment) throw new Error('Enroll in this course before opening its lessons.')
      setCourse(item)
      setCompleted(enrollment.completedLessons)
      const requestedLesson = item.lessonList.findIndex((lesson) => lesson._id === initialLessonId)
      if (requestedLesson >= 0) setActive(requestedLesson)
    }).catch((loadError) => setError(loadError.message)).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [courseId, initialLessonId])
  async function markComplete() {
    const lesson = course?.lessonList[active]
    if (!lesson?._id) return notify('This lesson is missing its server identifier.')
    try {
      const result = await api.completeLesson(courseId, lesson._id)
      setCompleted(result.enrollment.completedLessons)
      notify(result.certificate ? `Lesson complete! Certificate ${result.certificate.certificateId} is ready.` : result.message)
    } catch (completeError) {
      notify(completeError.message)
    }
  }
  if (loading) return <LoadingBlock />
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />
  if (!course || !course.lessonList.length) return <EmptyState title="No lessons available" detail="This course does not have any lessons yet." />
  const lesson = course.lessonList[active]
  const progress = Math.round(completed.length / course.lessonList.length * 100)
  return <div><Link to={`/student/courses/${course.id}`} className="back-link"><ArrowLeft size={16} /> Back to course</Link><div className="lesson-layout"><main><div className="video-player">{lesson.videoUrl ? <video controls className="lesson-video" src={lesson.videoUrl}>Your browser does not support this video.</video> : <div className="video-center"><span><Play size={26} /></span><span>Video not provided for this lesson</span></div>}</div><div className="lesson-heading"><div><p className="eyebrow">{course.title}</p><h1>{lesson.title}</h1><p>{lesson.description || lesson.topic}</p></div><Button variant="soft" disabled={completed.includes(lesson._id)} onClick={markComplete}>{completed.includes(lesson._id) ? 'Completed' : 'Mark complete'} <Check size={15} /></Button></div><div className="lesson-tabs"><span className="tab-active">Lesson materials</span></div><div className="lesson-description"><h3>About this lesson</h3><p>{lesson.description || `Study the lesson topic: ${lesson.topic}.`}</p>{lesson.resources?.map((resource) => <a className="resource-row" href={resource.url} target="_blank" rel="noreferrer" key={resource._id || resource.url}><FileText size={18} /><div><strong>{resource.title}</strong><small>{resource.type}</small></div><Download size={17} /></a>)}</div></main><aside className="panel lesson-outline"><div className="panel-heading"><div><h3>Course content</h3><p>{completed.length} of {course.lessonList.length} lessons</p></div></div><div className="progress-track outline-progress"><span style={{ width: `${progress}%` }} /></div>{course.lessonList.map((item, lessonIndex) => <div className="outline-section" key={item._id}><button className={`outline-lesson ${active === lessonIndex ? 'outline-active' : ''}`} onClick={() => setActive(lessonIndex)}><span className="outline-play">{completed.includes(item._id) ? <Check size={13} /> : <Play size={12} />}</span><span>{item.title}<small>{item.durationMinutes} min</small></span></button></div>)}<Link to={`/student/quiz?courseId=${encodeURIComponent(course.id)}`} className="quiz-callout"><Target size={17} /><span><strong>Ready for a quick quiz?</strong><small>Test what you’ve learned</small></span><ArrowRight size={15} /></Link></aside></div></div>
}

function QuizPage({ notify }) {
  const [question, setQuestion] = useState(0)
  const [answers, setAnswers] = useState([])
  const [result, setResult] = useState(null)
  const [seconds, setSeconds] = useState(600)
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const courseId = new URLSearchParams(window.location.search).get('courseId')
  const quiz = quizzes[0]
  const questions = quiz?.questions || []
  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        let selectedCourseId = courseId
        if (!selectedCourseId) {
          const progress = await api.getProgress()
          selectedCourseId = progress.courses[0]?.course.id
        }
        if (!selectedCourseId) {
          setQuizzes([])
          return
        }
        setQuizzes(await api.getQuizzes(selectedCourseId))
      } catch (loadError) {
        if (mounted) setError(loadError.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [courseId])
  useEffect(() => {
    if (result || seconds <= 0 || !questions.length) return undefined
    const timer = window.setInterval(() => setSeconds((value) => value - 1), 1000)
    return () => window.clearInterval(timer)
  }, [result, seconds, questions.length])
  async function submitQuiz() {
    if (!quiz || answers.length !== questions.length || answers.some((answer) => answer === undefined)) return
    setSending(true)
    try {
      const response = await api.submitQuiz(quiz._id, answers)
      setResult(response)
    } catch (submitError) {
      notify(submitError.message)
    } finally {
      setSending(false)
    }
  }
  if (loading) return <LoadingBlock label="Loading your quiz..." />
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />
  if (!quiz) return <EmptyState title="No quizzes available" detail="Your enrolled courses do not have a published quiz yet." action={<Link to="/student/courses">Browse courses</Link>} />
  return <div className="quiz-page"><Link to={`/student/courses/${quiz.course}`} className="back-link"><ArrowLeft size={16} /> Back to course</Link><div className="quiz-top"><div><p className="eyebrow">{quiz.title}</p><h1>Knowledge check</h1><p>Answers are submitted to the server for scoring.</p></div><div className={`quiz-timer ${seconds < 60 ? 'timer-warning' : ''}`}><Timer size={17} /><span>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span></div></div><div className="quiz-progress-row"><span>Question {question + 1} of {questions.length}</span><div className="progress-track"><span style={{ width: `${((question + 1) / questions.length) * 100}%` }} /></div><span>{question + 1}/{questions.length}</span></div>{!result ? <section className="panel quiz-card"><span className="quiz-question-number">QUESTION {String(question + 1).padStart(2, '0')}</span><h2>{questions[question].prompt}</h2><div className="quiz-choices">{questions[question].choices.map((choice, i) => <label className={`quiz-choice ${answers[question] === i ? 'choice-selected' : ''}`} key={`${choice}-${i}`}><input type="radio" name={`question-${question}`} checked={answers[question] === i} onChange={() => setAnswers((current) => { const next = Array.from({ length: questions.length }, (_, index) => current[index]); next[question] = i; return next })} /><span className="choice-letter">{String.fromCharCode(65 + i)}</span>{choice}{answers[question] === i && <Check size={16} />}</label>)}</div><div className="quiz-actions"><span>{answers.filter((answer) => answer !== undefined).length} of {questions.length} answered</span><div>{question > 0 && <Button variant="soft" onClick={() => setQuestion(question - 1)}><ArrowLeft size={15} /> Previous</Button>}{question < questions.length - 1 ? <Button disabled={answers[question] === undefined} onClick={() => setQuestion(question + 1)}>Next question <ArrowRight size={15} /></Button> : <Button disabled={answers.filter((answer) => answer !== undefined).length !== questions.length || sending} onClick={submitQuiz}>{sending ? 'Scoring...' : 'Finish quiz'} <Check size={15} /></Button>}</div></div></section> : <section className="panel quiz-result"><div className="result-icon"><Trophy size={28} /></div><p className="eyebrow">QUIZ COMPLETE</p><h2>{result.passed ? 'You passed!' : 'Keep practicing'}</h2><p>{result.feedback}</p><div className="result-score">{result.attempt.score}<small>%</small></div><p>{result.attempt.correctCount} correct of {result.attempt.totalQuestions} · Pass mark {result.passingScore}%</p>{result.rewards && <p>XP total updated: {result.rewards.xp}</p>}<Button onClick={() => { setResult(null); setQuestion(0); setAnswers([]); setSeconds(600) }}>Try again <ArrowRight size={15} /></Button></section>}</div>
}

function QuizBuilder({ notify }) {
  const navigate = useNavigate()
  const { portal = 'teacher' } = useParams()
  const [questions, setQuestions] = useState([{ prompt: '', choices: ['', '', '', ''], answer: 0 }])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    api.getCourses({ role: 'teacher' }).then(setCourses).catch((error) => notify(error.message)).finally(() => setLoading(false))
  }, [])
  function updateQuestion(questionIndex, update) {
    setQuestions((items) => items.map((item, index) => index === questionIndex ? { ...item, ...update } : item))
  }
  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const formData = Object.fromEntries(new FormData(e.currentTarget))
      await api.createQuiz({
        title: formData.title,
        courseId: formData.courseId,
        passingScore: Number(formData.passingScore),
        published: formData.published === 'on',
        questions: questions.map((item) => ({ prompt: item.prompt, choices: item.choices, correctAnswer: item.answer, topic: item.topic || 'General' })),
      })
      notify('Quiz created and saved to the course.')
      navigate(`/${portal}/assignments`)
    } catch (error) {
      notify(error.message)
    } finally {
      setSaving(false)
    }
  }
  if (loading) return <LoadingBlock label="Loading your courses..." />
  if (!courses.length) return <EmptyState title="Create a course first" detail="Quizzes must belong to one of your courses." action={<Link to="/teacher/courses/new"><Button>Create a course</Button></Link>} />
  return <div><Link to={`/${portal}/assignments`} className="back-link"><ArrowLeft size={16} /> Back to submissions</Link><PageTitle eyebrow="TEACHER STUDIO" title="Create a quiz" subtitle="Write thoughtful questions that help learning stick." /><form className="quiz-builder" onSubmit={submit}><section className="panel editor-form"><div className="form-section-heading"><span>01</span><div><h3>Quiz settings</h3><p>Choose a course and set expectations for learners.</p></div></div><label>Quiz title<input name="title" required minLength="4" placeholder="e.g. Design fundamentals check-in" /></label><label>Course<select name="courseId" required>{courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}</select></label><label>Passing score (%)<input name="passingScore" type="number" min="1" max="100" defaultValue="70" required /></label><label className="checkbox-label"><input name="published" type="checkbox" defaultChecked /> Publish immediately</label></section><section className="panel quiz-builder-questions"><div className="panel-heading"><div><h3>Questions</h3><p>Add a prompt, answer choices, and mark the correct response.</p></div><span className="badge badge-soft">{questions.length} question{questions.length === 1 ? '' : 's'}</span></div>{questions.map((item, index) => <div className="builder-question" key={index}><div className="builder-question-head"><strong>Question {index + 1}</strong>{questions.length > 1 && <button type="button" className="text-button" onClick={() => setQuestions(questions.filter((_, i) => i !== index))}>Remove</button>}</div><label className="editor-form-label">Prompt<textarea value={item.prompt} onChange={(e) => updateQuestion(index, { prompt: e.target.value })} required minLength="5" rows="2" placeholder="Write a clear, focused question..." /></label><label className="editor-form-label">Topic<input value={item.topic || ''} onChange={(e) => updateQuestion(index, { topic: e.target.value })} placeholder="e.g. System design" /></label><div className="builder-choice-grid">{item.choices.map((choice, choiceIndex) => <label className="editor-form-label" key={choiceIndex}>Answer {String.fromCharCode(65 + choiceIndex)}<input value={choice} required onChange={(e) => { const choices = [...item.choices]; choices[choiceIndex] = e.target.value; updateQuestion(index, { choices }) }} placeholder={`Choice ${String.fromCharCode(65 + choiceIndex)}`} /></label>)}</div><label className="editor-form-label answer-select">Correct answer<select value={item.answer} onChange={(e) => updateQuestion(index, { answer: Number(e.target.value) })}>{item.choices.map((_, i) => <option value={i} key={i}>Answer {String.fromCharCode(65 + i)}</option>)}</select></label></div>)}<Button variant="soft" icon={Plus} onClick={() => setQuestions([...questions, { prompt: '', choices: ['', '', '', ''], answer: 0 }])}>Add a question</Button><div className="form-actions"><Button variant="soft" onClick={() => navigate(`/${portal}/assignments`)}>Cancel</Button><Button type="submit" disabled={saving} icon={Check}>{saving ? 'Saving quiz...' : 'Save quiz'}</Button></div></section></form></div>
}

function Assignments({ user, notify }) {
  const { portal = user.role } = useParams()
  const isStudent = user.role === 'student'
  const isStaff = !isStudent
  const [entries, setEntries] = useState([])
  const [courses, setCourses] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [review, setReview] = useState(null)
  const [selectedAssignment, setSelectedAssignment] = useState('')
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState('All')
  async function load() {
    setLoading(true)
    setError('')
    try {
      const [assignmentRows, managedCourses, studentSubmissions] = await Promise.all([
        api.getAssignments(),
        isStaff ? api.getCourses({ role: user.role }) : Promise.resolve([]),
        isStaff ? api.getSubmissions() : Promise.resolve([]),
      ])
      setEntries(assignmentRows)
      setCourses(managedCourses)
      setSubmissions(studentSubmissions)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [user.role])
  const rows = isStudent
    ? entries.map(({ assignment, submission }) => ({ assignment, submission }))
    : submissions.map((submission) => ({ assignment: submission.assignment, submission }))
  const filtered = rows.filter(({ submission }) => {
    if (filter === 'Needs review') return submission.status === 'submitted'
    if (filter === 'Reviewed') return submission.status === 'graded'
    if (filter === 'Submitted') return Boolean(submission)
    if (filter === 'Not started') return !submission
    return true
  })
  async function submitWork(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await api.submitAssignment(selectedAssignment, { text: form.get('text'), fileUrl: form.get('fileUrl') })
      notify('Assignment submitted successfully.')
      event.currentTarget.reset()
      await load()
    } catch (submitError) {
      notify(submitError.message)
    }
  }
  async function saveGrade(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await api.gradeSubmission(review._id, { score: Number(form.get('score')), feedback: form.get('feedback') })
      notify('Grade and feedback saved.')
      setReview(null)
      await load()
    } catch (gradeError) {
      notify(gradeError.message)
    }
  }
  async function create(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await api.createAssignment({
        title: form.get('title'),
        courseId: form.get('courseId'),
        instructions: form.get('instructions'),
        dueAt: form.get('dueAt') || undefined,
        maxScore: Number(form.get('maxScore')),
        published: true,
      })
      notify('Assignment created.')
      setCreating(false)
      await load()
    } catch (createError) {
      notify(createError.message)
    }
  }
  if (loading) return <LoadingBlock label="Loading assignments..." />
  if (error) return <ErrorState message={error} onRetry={load} />
  return <div><PageTitle eyebrow={isStaff ? 'TEACHER STUDIO' : 'YOUR LEARNING'} title={isStaff ? 'Submission reviews' : 'Assignments'} subtitle={isStaff ? 'Review student work and share feedback.' : 'Submit your work and review your grades.'} action={isStaff && <><Link to={`/${portal}/quiz/new`}><Button variant="soft" icon={Target}>Create quiz</Button></Link><Button icon={Plus} onClick={() => setCreating(true)}>Create assignment</Button></>} />
    <div className="filter-tabs">{['All', ...(isStaff ? ['Needs review', 'Reviewed'] : ['Submitted', 'Not started'])].map((item) => <button className={filter === item ? 'filter-tab-active' : ''} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div>
    <div className="panel assignment-list">{filtered.length ? filtered.map(({ assignment, submission }) => {
      const assignmentTitle = assignment?.title || 'Assignment'
      const courseTitle = typeof assignment?.course === 'object' ? assignment.course.title : ''
      const status = isStudent ? submission?.status === 'graded' ? `Graded · ${submission.score}/${assignment.maxScore}` : submission ? 'Submitted' : 'Not started' : submission.status === 'graded' ? 'Reviewed' : 'Needs review'
      const due = assignment?.dueAt ? `Due ${new Date(assignment.dueAt).toLocaleDateString()}` : courseTitle
      return <div className="assignment-row" key={submission?._id || assignment?._id}><div className="assignment-type"><FileText size={18} /></div><div className="assignment-info"><strong>{assignmentTitle}</strong><small>{isStaff ? `${submission.student?.name || 'Student'} · ${courseTitle}` : courseTitle}</small></div><span className="assignment-due">{isStaff ? new Date(submission.submittedAt).toLocaleDateString() : due}</span><span className={`status-pill ${status === 'Needs review' ? 'status-amber' : status.startsWith('Graded') || status === 'Reviewed' ? 'status-green' : 'status-blue'}`}>{status}</span>{isStaff ? <Button variant="soft" onClick={() => setReview(submission)}>{status === 'Reviewed' ? 'View' : 'Review'}</Button> : <Button variant="soft" onClick={() => setSelectedAssignment(assignment._id)}>{submission ? 'Resubmit' : 'Submit'}</Button>}{isStudent && submission?.feedback && <small className="assignment-feedback">Feedback: {submission.feedback}</small>}</div>
    }) : <EmptyState title="No assignments yet" detail={isStaff ? 'Student submissions will appear here.' : 'There are no assignments for your enrolled courses.'} />}</div>
    {isStudent && <section className="panel submission-panel" id="submission-form"><div><p className="eyebrow">TURN IN YOUR WORK</p><h3>Submit an assignment</h3><p>Submit text or a link to a file stored in your approved service.</p></div><form onSubmit={submitWork}><label>Assignment<select required value={selectedAssignment} onChange={(event) => setSelectedAssignment(event.target.value)}><option value="">Select an assignment</option>{entries.map(({ assignment }) => <option value={assignment._id} key={assignment._id}>{assignment.title}</option>)}</select></label><label>Your work<textarea name="text" rows="5" maxLength="10000" placeholder="Write your response or include a summary..." /></label><label>File URL (optional)<input name="fileUrl" type="url" placeholder="https://..." /></label><Button type="submit" icon={Send} disabled={!selectedAssignment}>Submit assignment</Button></form></section>}
    {isStaff && review && <Modal title="Review submission" onClose={() => setReview(null)}><div className="review-modal-summary"><FileText size={18} /><div><strong>{review.assignment?.title}</strong><small>{review.student?.name} · Submitted {new Date(review.submittedAt).toLocaleString()}</small></div></div>{review.text && <p>{review.text}</p>}{review.fileUrl && <a href={review.fileUrl} target="_blank" rel="noreferrer">Open submitted file link</a>}<form onSubmit={saveGrade}><label className="editor-form-label">Score (0–{review.assignment?.maxScore})<input name="score" type="number" min="0" max={review.assignment?.maxScore} required defaultValue={review.score ?? ''} /></label><label className="editor-form-label">Feedback<textarea name="feedback" rows="4" required minLength="1" defaultValue={review.feedback || ''} placeholder="Share specific, constructive feedback..." /></label><div className="form-actions"><Button variant="soft" onClick={() => setReview(null)}>Cancel</Button><Button type="submit" icon={Check}>Save feedback</Button></div></form></Modal>}
    {isStaff && creating && <Modal title="Create assignment" onClose={() => setCreating(false)}><form onSubmit={create}><label className="editor-form-label">Assignment title<input name="title" required minLength="4" placeholder="e.g. Create a system design case study" /></label><label className="editor-form-label">Course<select name="courseId" required>{courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}</select></label><div className="form-two-cols"><label className="editor-form-label">Due date<input name="dueAt" type="date" /></label><label className="editor-form-label">Points<input name="maxScore" type="number" min="1" max="1000" defaultValue="100" required /></label></div><label className="editor-form-label">Instructions<textarea name="instructions" rows="3" required minLength="8" placeholder="Describe what students need to submit..." /></label><div className="form-actions"><Button variant="soft" onClick={() => setCreating(false)}>Cancel</Button><Button type="submit" icon={Plus}>Create assignment</Button></div></form></Modal>}
  </div>
}

function Planner({ notify }) {
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [recommendations, setRecommendations] = useState(null)
  const [title, setTitle] = useState('')
  useEffect(() => {
    let mounted = true
    Promise.all([api.getTodos(), api.getRecommendations()]).then(([value, result]) => {
      if (mounted) {
        setTodos(value)
        setRecommendations(result)
      }
    }).catch((error) => notify(error.message)).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])
  async function update(next) { setTodos(next); try { await api.saveTodos(next) } catch (error) { notify(error.message) } }
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
  return <div>
    <PageTitle eyebrow="YOUR LEARNING" title="Study planner" subtitle="A little structure makes a big difference. You’ve got this!" action={<Button variant="soft" icon={WandSparkles} onClick={() => { const next = recommendations?.recommendedLessons?.[0]; if (!next) return notify(recommendations?.message || 'Complete quizzes to get study recommendations.'); setTitle(`Review ${next.title}`); notify(`Recommendation: review ${next.topic}.`) }}>Smart plan</Button>} />
    <div className="planner-summary"><div><CalendarDays size={20} /><span><strong>{today}</strong><small>Your plan for today</small></span></div><div className="planner-completion"><strong>{todos.filter((todo) => todo.done).length} / {todos.length}</strong><small>tasks complete</small></div></div>
    <div className="planner-columns">
      <section className="panel planner-tasks">
        <div className="panel-heading"><div><h3>Today’s focus</h3><p>Make time for what matters</p></div><span className="badge badge-soft">{todos.length} tasks</span></div>
        {loading ? <LoadingBlock /> : todos.length ? todos.map((todo, i) => <label className={`todo-row ${todo.done ? 'todo-done' : ''}`} key={`${todo.title}-${i}`}><input type="checkbox" checked={todo.done} onChange={() => update(todos.map((task, index) => index === i ? { ...task, done: !task.done } : task))} /><span className="todo-check"><Check size={13} /></span><span className="todo-description"><strong>{todo.title}</strong><small>{todo.course || 'Personal study'}</small></span><span className="todo-time">{todo.time || 'Flexible'}</span><button className="icon-button" type="button" aria-label="Remove task" onClick={(e) => { e.preventDefault(); update(todos.filter((_, index) => index !== i)) }}><X size={15} /></button></label>) : <EmptyState title="Your plan is clear" detail="Add a task and make today count." />}
        <form className="add-todo" onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; update([...todos, { title: title.trim(), course: 'Personal study', time: 'Flexible', done: false }]); setTitle('') }}><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task to your day..." /><Button type="submit" variant="soft" icon={Plus}>Add task</Button></form>
      </section>
      <aside className="panel study-insight"><div className="insight-icon"><Sparkles size={18} /></div><p className="eyebrow">SMART INSIGHT · RULE-BASED</p><h3>{recommendations?.weakTopics?.[0]?.topic || 'Build your topic history'}</h3><p>{recommendations?.message || 'Complete quizzes to receive recommendations based on your results.'}</p>{recommendations?.recommendedLessons?.slice(0, 3).map((lesson) => <Link to={`/student/lesson/${lesson.courseId}?lessonId=${lesson.lessonId}`} key={lesson.lessonId}>Review {lesson.title} <ArrowRight size={15} /></Link>)}<div className="insight-divider" /><span className="weak-label">TOPICS TO REVIEW</span>{recommendations?.weakTopics?.length ? recommendations.weakTopics.map((topic) => <div className="topic-chip" key={topic.topic}><span>{topic.topic}</span><strong>{topic.score}%</strong></div>) : <p>No weak topics identified yet.</p>}</aside>
    </div>
  </div>
}

function Achievements({ notify, user }) {
  const [account, setAccount] = useState(user)
  const [leaders, setLeaders] = useState([])
  useEffect(() => {
    Promise.all([api.getMe(), api.getLeaderboard()]).then(([current, leaderboard]) => {
      setAccount(current)
      setLeaders(leaderboard)
    }).catch((error) => notify(error.message))
  }, [])
  const earned = new Set(account.badges || [])
  const badges = [
    { id: 'first-100-xp', icon: Flame, title: 'First 100 XP', detail: 'Earn your first 100 experience points', color: 'orange' },
    { id: '500-xp', icon: Zap, title: '500 XP', detail: 'Reach 500 experience points', color: 'violet' },
    { id: '1000-xp', icon: Target, title: '1,000 XP', detail: 'Reach 1,000 experience points', color: 'blue' },
    { id: 'seven-day-streak', icon: BookOpen, title: '7 day streak', detail: 'Learn on seven consecutive days', color: 'green' },
    { id: 'thirty-day-streak', icon: Trophy, title: '30 day streak', detail: 'Learn on thirty consecutive days', color: 'pink' },
  ]
  return <div><PageTitle eyebrow="YOUR LEARNING" title="Your achievements" subtitle="Every small win deserves a little celebration." /><div className="achievement-hero"><div><p className="eyebrow">YOUR LEARNING LEVEL</p><h2>Learning in progress <Sparkles size={19} /></h2><p>Your streak and points update as you complete lessons, quizzes, and study sessions.</p></div><div className="xp-total"><Zap size={20} fill="currentColor" /><strong>{(account.xp || 0).toLocaleString()}</strong><small>total XP</small></div><div className="level-progress"><div><span>{account.streakDays || 0} day streak</span><span>{earned.size} badges</span></div><div className="progress-track"><span style={{ width: `${Math.min(100, (account.xp || 0) % 500 / 5)}%` }} /></div></div></div><div className="leaderboard-layout"><section><div className="section-heading"><div><h2>Badges & milestones</h2><p>{earned.size} of {badges.length} earned</p></div></div><div className="badge-grid">{badges.map(({ icon: Icon, ...badge }) => <div className={`badge-card ${earned.has(badge.id) ? '' : 'badge-locked'}`} key={badge.id}><div className={`badge-icon badge-${badge.color}`}><Icon size={23} /></div><strong>{badge.title}</strong><p>{badge.detail}</p>{earned.has(badge.id) ? <span className="earned-label"><Check size={13} /> Earned</span> : <span className="locked-label">Keep learning <ArrowRight size={12} /></span>}</div>)}</div></section><aside className="panel leaderboard"><div className="panel-heading"><div><h3>Leaderboard</h3><p>Ranked by experience points</p></div><Trophy size={19} className="trophy-gold" /></div>{leaders.map(({ rank, user: player }) => <div className={`leaderboard-row ${player._id === account._id ? 'leader-current' : ''}`} key={player._id}><span className="leader-rank">{rank}</span><div className="avatar avatar-violet">{player.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</div><strong>{player.name}</strong><span>{player.xp} XP</span></div>)}</aside></div></div>
}

function StudyTimer({ notify }) {
  const [duration, setDuration] = useState(25)
  const [remaining, setRemaining] = useState(25 * 60)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(0)
  useEffect(() => {
    api.getStudySessions().then((items) => {
      const today = new Date().toDateString()
      setSessions(items.filter((item) => new Date(item.studiedAt).toDateString() === today).length)
    }).catch((error) => notify(error.message))
  }, [])
  useEffect(() => {
    if (!running || remaining <= 0) return undefined
    const interval = window.setInterval(() => {
      setRemaining((value) => value - 1)
      setElapsed((value) => value + 1)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [running, remaining])
  useEffect(() => {
    if (remaining === 0 && running) {
      setRunning(false)
      api.recordStudySession(Math.max(1, Math.ceil(elapsed / 60))).then(() => {
        setSessions((value) => value + 1)
        notify('Focus session saved! XP and your learning streak have been updated.')
      }).catch((error) => notify(error.message))
    }
  }, [remaining, running])
  function choose(value) { setDuration(value); setRemaining(value * 60); setElapsed(0); setRunning(false) }
  const progress = 1 - remaining / (duration * 60)
  const radius = 117
  const circumference = 2 * Math.PI * radius
  return <div><PageTitle eyebrow="YOUR LEARNING" title="Focus time" subtitle="Small, focused sessions add up to something big." /><div className="timer-layout"><section className="panel focus-panel"><div className="focus-mode"><span className="focus-dot" /> FOCUS SESSION</div><div className="timer-modes">{[25, 45, 60].map((value) => <button className={duration === value ? 'mode-active' : ''} onClick={() => choose(value)} key={value}>{value} min</button>)}</div><div className="timer-dial"><svg viewBox="0 0 270 270"><circle cx="135" cy="135" r={radius} className="timer-track" /><circle cx="135" cy="135" r={radius} className="timer-ring" style={{ strokeDasharray: circumference, strokeDashoffset: circumference * (1 - progress) }} /></svg><div className="timer-readout"><strong>{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</strong><small>{running ? 'You’re doing great' : 'Ready when you are'}</small></div></div><div className="timer-controls"><Button icon={running ? undefined : Play} onClick={() => setRunning(!running)}>{running ? 'Pause session' : 'Start focusing'}</Button><button className="timer-reset" onClick={() => { setRunning(false); setRemaining(duration * 60); setElapsed(0) }}>Reset</button></div><p className="timer-tip"><Sparkles size={15} /> Put your phone away and focus on one thing at a time.</p></section><aside className="timer-side"><div className="panel today-focus"><p className="eyebrow">TODAY’S FOCUS</p><h3>Study session</h3><span><BookOpen size={15} /> Logged to your learning record</span></div><div className="panel sessions-card"><p className="eyebrow">TODAY’S SESSIONS</p><div className="session-count"><strong>{sessions}</strong><span>focus sessions<br />completed</span></div><div className="session-dots">{Array.from({ length: 4 }, (_, i) => <span className={i < sessions ? 'session-done' : ''} key={i}><Check size={13} /></span>)}</div><p className="session-note">Completed sessions sync with your account.</p></div><div className="break-card"><div><CoffeeIcon /><span><strong>Break reminder</strong><small>Stretch after every 2 sessions</small></span></div></div></aside></div></div>
}

function CoffeeIcon() {
  return <Clock3 size={18} />
}

function Certificates({ notify, user }) {
  const [certificates, setCertificates] = useState([])
  const [eligible, setEligible] = useState([])
  const [certificateId, setCertificateId] = useState('')
  const [verification, setVerification] = useState(null)
  const [loading, setLoading] = useState(true)
  async function load() {
    setLoading(true)
    try {
      const [items, progress] = await Promise.all([api.getCertificates(), api.getProgress()])
      setCertificates(items)
      setEligible(progress.courses.filter((course) => course.progressPercent === 100 && !items.some((certificate) => certificate.course?._id === course.course.id)))
    } catch (error) {
      notify(error.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])
  async function issue(courseId) {
    try {
      await api.createCertificate(courseId)
      notify('Certificate issued successfully.')
      await load()
    } catch (error) {
      notify(error.message)
    }
  }
  async function verify(event) {
    event.preventDefault()
    try {
      setVerification(await api.verifyCertificate(certificateId.trim()))
    } catch (error) {
      setVerification({ valid: false, message: error.message })
    }
  }
  return <div><PageTitle eyebrow="YOUR LEARNING" title="Certificates" subtitle="Your hard work, beautifully recognized." /><div className="certificate-banner"><div className="certificate-banner-icon"><Award size={26} /></div><div><strong>{certificates.length} certificates earned</strong><p>Certificates are issued when all course lessons are complete.</p></div><div className="certificate-banner-stat"><strong>{certificates.length}</strong><small>completed</small></div></div>{eligible.length > 0 && <section className="panel"><h3>Ready to certify</h3>{eligible.map((course) => <div className="assignment-row" key={course.course.id}><strong>{course.course.title}</strong><Button onClick={() => issue(course.course.id)}>Issue certificate</Button></div>)}</section>}<div className="section-heading"><div><h2>My certificates</h2><p>Share your achievements with the world</p></div></div>{loading ? <LoadingBlock /> : certificates.length ? <div className="certificate-grid">{certificates.map((certificate, index) => { const name = certificate.course?.title || 'Completed course'; const color = ['violet', 'blue', 'green', 'orange'][index % 4]; return <div className={`certificate-card cert-${color}`} key={certificate._id}><div className="certificate-preview"><div className="certificate-logo"><GraduationCap size={16} /> LEARNLY</div><div className="certificate-seal"><Award size={28} /></div><span>CERTIFICATE OF COMPLETION</span><h3>{name}</h3><small>Presented to</small><strong>{user.name}</strong><div className="certificate-signature"><span>Learnly Academy</span><i /></div><span className="certificate-code">ID: {certificate.certificateId}</span></div><div className="certificate-meta"><div><strong>{name}</strong><small>Issued {new Date(certificate.issuedAt).toLocaleDateString()}</small></div><button className="icon-button" aria-label="Print certificate" onClick={() => { window.print(); notify('Use your browser’s print dialog to save the certificate as a PDF.') }}><Download size={17} /></button></div></div> })}</div> : <EmptyState title="No certificates yet" detail="Complete all lessons in a course to become eligible for a certificate." />}<section className="panel certificate-verify"><h3>Verify a certificate</h3><form onSubmit={verify}><label>Certificate ID<input value={certificateId} onChange={(event) => setCertificateId(event.target.value)} required placeholder="LN-2026-..." /></label><Button type="submit">Verify</Button></form>{verification && <p>{verification.valid ? `Verified: ${verification.studentName} completed ${verification.courseTitle} on ${new Date(verification.issuedAt).toLocaleDateString()}.` : verification.message}</p>}</section></div>
}

function Analytics({ user }) {
  const role = user.role
  const isTeacher = role === 'teacher'
  const isAdmin = role === 'admin'
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  async function load() {
    setLoading(true)
    try { setData(await api.getAnalytics()); setError('') } catch (loadError) { setError(loadError.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  if (loading) return <LoadingBlock label="Loading analytics..." />
  if (error) return <ErrorState message={error} onRetry={load} />
  const studyHours = ((data.study?.totalMinutes || 0) / 60).toFixed(1)
  const average = data.quizzes?.averageScore || 0
  const courseProgress = data.courseProgress || []
  return <div><PageTitle eyebrow={isAdmin ? 'PLATFORM MANAGEMENT' : isTeacher ? 'TEACHER STUDIO' : 'YOUR LEARNING'} title={isAdmin ? 'Platform analytics' : isTeacher ? 'Student performance' : 'Your analytics'} subtitle="Live metrics returned by your LMS account." /><div className="stats-grid"><StatCard label={isTeacher ? 'Courses' : 'Study hours'} value={isTeacher ? data.courses.length : `${studyHours}h`} icon={Users} color="blue" /><StatCard label="Course enrollments" value={data.courses.length} icon={BookOpen} color="violet" /><StatCard label="Average quiz score" value={`${average}%`} icon={Award} color="green" /><StatCard label={isTeacher ? 'Pending reviews' : 'Study sessions'} value={isTeacher ? data.pendingReviews : data.study?.sessions || 0} icon={Flame} color="orange" /></div><div className="analytics-grid"><section className="panel"><div className="panel-heading"><div><h3>Course progress</h3><p>Progress calculated from completed lessons</p></div></div>{courseProgress.length ? courseProgress.map((course) => <div className="skill-row" key={course.courseTitle}><div><span>{course.courseTitle}</span><strong>{course.progressPercent}%</strong></div><div className="progress-track"><span style={{ width: `${course.progressPercent}%` }} /></div></div>) : <EmptyState title="No learning data yet" detail="Enroll and complete lessons to see progress analytics." />}</section><section className="panel skill-panel"><div className="panel-heading"><div><h3>Quiz performance</h3><p>Server-recorded quiz attempts</p></div></div><div className="summary-row"><span>Attempts</span><strong>{data.quizzes?.attempts || 0}</strong></div><div className="summary-row"><span>Average score</span><strong>{average}%</strong></div><div className="summary-row"><span>Best score</span><strong>{data.quizzes?.bestScore || 0}%</strong></div><div className="summary-row"><span>Study time</span><strong>{studyHours}h</strong></div></section></div></div>
}

function StudentTable({ rows, onToggle }) {
  return <div className="table-scroll"><table><thead><tr><th>ACCOUNT</th><th>ROLE</th><th>STATUS</th>{onToggle && <th>ACTION</th>}</tr></thead><tbody>{rows.map((student) => <tr key={student.email}><td><div className="table-person"><div className={`avatar avatar-${student.color}`}>{student.initials}</div><span><strong>{student.name}</strong><small>{student.email}</small></span></div></td><td>{student.course}</td><td><span className={`status-pill ${student.status === 'Active' ? 'status-green' : 'status-amber'}`}>{student.status}</span></td>{onToggle && <td><Button variant="soft" onClick={() => onToggle(student)}>{student.status === 'Active' ? 'Disable' : 'Enable'}</Button></td>}</tr>)}</tbody></table></div>
}

function PeoplePage({ kind, notify }) {
  const [people, setPeople] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  async function load() {
    setLoading(true)
    try {
      const users = await api.getUsers(kind === 'Students' ? 'student' : 'teacher')
      const colors = ['violet', 'blue', 'orange', 'green', 'pink']
      setPeople(users.map((person, index) => ({
        ...person,
        course: person.role,
        progress: 0,
        initials: person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
        color: colors[index % colors.length],
        status: person.status === 'active' ? 'Active' : 'Disabled',
      })))
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }
  async function toggleStatus(person) {
    try {
      await api.updateUser(person._id, { status: person.status === 'Active' ? 'disabled' : 'active' })
      notify(`${person.name}’s account status updated.`)
      await load()
    } catch (error) {
      notify(error.message)
    }
  }
  useEffect(() => { load() }, [kind])
  const rows = people.filter((person) => `${person.name} ${person.email} ${person.course}`.toLowerCase().includes(search.toLowerCase()))
  return <div><PageTitle eyebrow="PLATFORM MANAGEMENT" title={kind} subtitle={`Manage ${kind.toLowerCase()} accounts.`} /><div className="stats-grid compact-stats"><StatCard label={`Total ${kind.toLowerCase()}`} value={people.length} icon={Users} color="blue" /><StatCard label="Currently active" value={people.filter((person) => person.status === 'Active').length} icon={Activity} color="violet" /><StatCard label="Disabled accounts" value={people.filter((person) => person.status === 'Disabled').length} icon={Target} color="green" /></div><section className="panel management-panel"><div className="management-toolbar"><div><h3>All {kind.toLowerCase()}</h3><p>{rows.length} account(s)</p></div><div className="catalog-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${kind.toLowerCase()}...`} /></div></div>{loading ? <LoadingBlock /> : error ? <ErrorState message={error} onRetry={load} /> : rows.length ? <StudentTable rows={rows} onToggle={toggleStatus} /> : <EmptyState title={`No ${kind.toLowerCase()} found`} detail="Try adjusting your search." />}</section></div>
}

function Approvals({ notify }) {
  const [pending, setPending] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  async function load() {
    setLoading(true)
    try {
      const users = await api.getPendingTeachers()
      setPending(users.map((person, index) => ({
        ...person,
        initials: person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
        color: ['pink', 'blue', 'green', 'violet'][index % 4],
      })))
    } catch (error) {
      notify(error.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])
  async function decide(person, approved) {
    setSaving(true)
    try {
      await api.reviewTeacher(person._id, approved ? 'approved' : 'rejected')
      setSelected(null)
      notify(`${person.name}’s application ${approved ? 'approved' : 'declined'}.`)
      await load()
    } catch (error) {
      notify(error.message)
    } finally {
      setSaving(false)
    }
  }
  return <div><PageTitle eyebrow="PLATFORM MANAGEMENT" title="Teacher approvals" subtitle="Review applications and welcome great educators to Learnly." /><div className="approval-overview"><div><ShieldCheck size={20} /><span><strong>{pending.length} applications need review</strong><small>Only approved teachers can publish content.</small></span></div><span className="status-pill status-amber">{pending.length ? 'Needs attention' : 'Up to date'}</span></div>{loading ? <LoadingBlock /> : pending.length ? <div className="approval-list">{pending.map((person) => <section className="panel approval-row" key={person._id}><div className={`avatar avatar-${person.color}`}>{person.initials}</div><div className="approval-person"><strong>{person.name}</strong><small>{person.email}</small></div><div className="approval-subject"><strong>Teacher applicant</strong><small>Submitted {new Date(person.createdAt).toLocaleDateString()}</small></div><span className="status-pill status-amber">Pending review</span><Button variant="soft" onClick={() => setSelected(person)}>Review application</Button></section>)}</div> : <EmptyState title="All caught up!" detail="There are no teacher applications waiting for review." />}{selected && <Modal title="Teacher application" onClose={() => setSelected(null)}><div className="application-detail"><div className={`avatar avatar-${selected.color}`}>{selected.initials}</div><div><h3>{selected.name}</h3><p>{selected.email}</p></div></div><div className="application-facts"><span>Account role<strong>Teacher</strong></span><span>Approval status<strong>{selected.approvalStatus}</strong></span><span>Account status<strong>{selected.status}</strong></span></div><p className="modal-copy">Approve only after reviewing the applicant’s account information. Account credentials and private information are not exposed here.</p><div className="form-actions"><Button variant="danger" disabled={saving} onClick={() => decide(selected, false)}>Decline</Button><Button disabled={saving} onClick={() => decide(selected, true)} icon={Check}>{saving ? 'Saving...' : 'Approve teacher'}</Button></div></Modal>}</div>
}

function Modal({ title, children, onClose }) {
  useEffect(() => { function escape(e) { if (e.key === 'Escape') onClose() } window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape) }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>{children}</section></div>
}

function Categories({ notify }) {
  const [categories, setCategories] = useState([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  async function load() {
    setLoading(true)
    try { setCategories(await api.getCategories()) } catch (error) { notify(error.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  async function addCategory(event) {
    event.preventDefault()
    try {
      const created = await api.createCategory({ name: name.trim(), description: `${name.trim()} learning resources.` })
      setCategories((items) => [...items, created].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
      notify(`${created.name} category added.`)
    } catch (error) {
      notify(error.message)
    }
  }
  async function removeCategory(category) {
    try {
      await api.deleteCategory(category._id)
      setCategories((items) => items.filter((item) => item._id !== category._id))
      notify(`${category.name} category removed.`)
    } catch (error) {
      notify(error.message)
    }
  }
  return <div><PageTitle eyebrow="PLATFORM MANAGEMENT" title="Course categories" subtitle="Manage categories used by course discovery." action={<Button icon={Plus} onClick={() => document.getElementById('category-name')?.focus()}>Add category</Button>} /><form className="panel category-add" onSubmit={addCategory}><div className="category-add-icon"><Plus size={18} /></div><div><strong>Create a category</strong><small>Categories are shared with course publishing.</small></div><input id="category-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Photography" minLength="2" maxLength="80" required /><Button type="submit">Add category</Button></form><div className="section-heading"><div><h2>All categories</h2><p>{categories.length} categories available</p></div></div>{loading ? <LoadingBlock /> : <div className="category-grid">{categories.map((category, i) => <div className="panel category-card" key={category._id}><div className={`category-color cat-${i % 5}`}>{[<BriefcaseBusiness size={19} />, <Code2 size={19} />, <Compass size={19} />, <Activity size={19} />, <Sparkles size={19} />][i % 5]}</div><div><strong>{category.name}</strong><small>{category.description || 'Course category'}</small></div><button className="icon-button" aria-label={`Delete ${category.name}`} onClick={() => removeCategory(category)}><X size={16} /></button></div>)}</div>}</div>
}

function Reports() {
  const [dashboard, setDashboard] = useState(null)
  const [details, setDetails] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  async function load() {
    setLoading(true)
    try {
      const [summary, analytics] = await Promise.all([api.getDashboard(), api.getAnalytics()])
      setDashboard(summary)
      setDetails(analytics)
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])
  if (loading) return <LoadingBlock label="Loading platform reports..." />
  if (error) return <ErrorState message={error} onRetry={load} />
  const platform = dashboard || {}
  return <div><PageTitle eyebrow="PLATFORM MANAGEMENT" title="Reports & insights" subtitle="Live platform totals from the LMS database." action={<Button variant="soft" icon={Download} onClick={() => window.print()}>Print report</Button>} /><div className="stats-grid"><StatCard label="Active students" value={platform.students || 0} icon={Users} color="blue" /><StatCard label="Approved teachers" value={platform.teachers || 0} icon={GraduationCap} color="violet" /><StatCard label="Course enrollments" value={platform.enrollments || 0} icon={BookOpen} color="green" /><StatCard label="Submissions" value={platform.submissions || 0} icon={FileCheck2} color="orange" /></div><div className="analytics-grid"><section className="panel"><div className="panel-heading"><div><h3>Course completion</h3><p>Computed from enrolled student lesson progress</p></div></div>{details.courseProgress.length ? details.courseProgress.map((course, index) => <div className="skill-row" key={`${course.courseTitle}-${index}`}><div><span>{course.courseTitle}</span><strong>{course.progressPercent}%</strong></div><div className="progress-track"><span style={{ width: `${course.progressPercent}%` }} /></div></div>) : <EmptyState title="No completion records yet" detail="Progress will appear here after learners enroll." />}</section><section className="panel report-breakdown"><div className="panel-heading"><div><h3>Platform totals</h3><p>Current database counts</p></div></div><div className="summary-row"><span>All courses</span><strong>{platform.courses || 0}</strong></div><div className="summary-row"><span>Published courses</span><strong>{platform.publishedCourses || 0}</strong></div><div className="summary-row"><span>Pending teacher approvals</span><strong>{platform.pendingTeachers || 0}</strong></div><div className="summary-row"><span>Study time (reported)</span><strong>{((details.study?.totalMinutes || 0) / 60).toFixed(1)}h</strong></div></section></div></div>
}

function SettingsPage({ notify }) {
  const { portal = 'student' } = useParams()
  const [preferences, setPreferences] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('learnly-preferences') || '{}')
    } catch (error) {
      console.error('Unable to read saved preferences', error)
      return {}
    }
  })
  const [saved, setSaved] = useState(false)
  function updatePreference(key, value) {
    setPreferences((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }
  function save() {
    try {
      localStorage.setItem('learnly-preferences', JSON.stringify(preferences))
      setSaved(true)
      notify('Preferences saved in this browser. Account settings are not synced by the API.')
    } catch (error) {
      console.error('Unable to save preferences', error)
      notify('Your browser could not save these preferences.')
    }
  }
  return <div><PageTitle eyebrow="YOUR WORKSPACE" title="Settings" subtitle="Preferences are saved in this browser." /><div className="settings-layout"><nav className="panel settings-nav"><a className="settings-nav-active" href="#preferences">Preferences</a><a href="#notifications">Notifications</a><a href="#privacy">Privacy & security</a></nav><div className="settings-sections"><section className="panel settings-section" id="preferences"><p className="eyebrow">PREFERENCES</p><h3>Learning preferences</h3><label className="settings-line"><span><strong>Language</strong><small>Choose your preferred language</small></span><select value={preferences.language || 'English'} onChange={(event) => updatePreference('language', event.target.value)}><option>English</option><option>Spanish</option><option>French</option><option>Hindi</option></select></label><label className="settings-line"><span><strong>Weekly learning goal</strong><small>Set your target study time</small></span><select value={preferences.goal || '5 hours'} onChange={(event) => updatePreference('goal', event.target.value)}><option>3 hours</option><option>5 hours</option><option>8 hours</option><option>10 hours</option></select></label></section><section className="panel settings-section" id="notifications"><p className="eyebrow">NOTIFICATIONS</p><h3>Notification preferences</h3><p>Stored locally; email delivery is not configured.</p><label className="settings-line"><span><strong>Course updates</strong><small>Announcements from your instructors</small></span><input type="checkbox" checked={preferences.emailUpdates ?? true} onChange={(event) => updatePreference('emailUpdates', event.target.checked)} /></label><label className="settings-line"><span><strong>Weekly learning digest</strong><small>A summary of your progress each week</small></span><input type="checkbox" checked={preferences.weeklyDigest ?? false} onChange={(event) => updatePreference('weeklyDigest', event.target.checked)} /></label></section><section className="panel settings-section" id="privacy"><p className="eyebrow">PRIVACY & SECURITY</p><h3>Your account</h3><p>Profile and password changes are handled by the API.</p><div className="settings-line"><span><strong>Password</strong><small>Change your password in profile settings</small></span><Link className="text-button" to={`/${portal}/profile`}>Open profile</Link></div><div className="settings-line"><span><strong>Two-factor authentication</strong><small>Not available in this API</small></span><span>Not configured</span></div></section><Button onClick={save}>{saved ? 'Changes saved' : 'Save preferences'} <Check size={15} /></Button></div></div></div>
}

function ProfilePage({ user, notify }) {
  const role = user.role
  const meta = { ...portalMeta[role], name: user.name, initials: user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() }
  const [edit, setEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  async function saveProfile(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name')).trim()
    const newPassword = String(form.get('newPassword') || '')
    const body = {
      name,
      bio: String(form.get('bio') || ''),
      interests: String(form.get('interests') || '').split(',').map((item) => item.trim()).filter(Boolean),
    }
    if (newPassword) {
      body.currentPassword = String(form.get('currentPassword') || '')
      body.newPassword = newPassword
    }
    setSaving(true)
    try {
      await api.updateProfile(body)
      notify('Profile updated.')
      if (newPassword) {
        api.clearToken()
        window.location.assign('/login')
      } else {
        setEdit(false)
        window.location.reload()
      }
    } catch (error) {
      notify(error.message)
    } finally {
      setSaving(false)
    }
  }
  return <div><PageTitle eyebrow="YOUR WORKSPACE" title="My profile" subtitle="Your account details are managed by the LMS." action={<Button variant="soft" icon={edit ? X : UserRound} onClick={() => setEdit(!edit)}>{edit ? 'Cancel editing' : 'Edit profile'}</Button>} /><div className="profile-layout"><section className="panel profile-card"><div className="profile-cover"><div className={`profile-avatar-large avatar-${role}`}>{meta.initials}</div></div><div className="profile-identity"><h2>{meta.name}</h2><p>{user.approvalStatus === 'pending' ? 'Teacher account awaiting approval' : `${portalMeta[role].label} account`}</p><span className="profile-location"><Compass size={14} /> {user.email}</span></div><div className="profile-stat-row"><div><strong>{user.xp || 0}</strong><small>XP</small></div><div><strong>{user.streakDays || 0}</strong><small>Day streak</small></div><div><strong>{user.badges?.length || 0}</strong><small>Badges</small></div></div></section><section className="panel profile-details"><p className="eyebrow">ABOUT YOU</p><h3>Personal information</h3><form onSubmit={saveProfile}><label className="profile-field"><span>Full name</span>{edit ? <input name="name" required minLength="2" maxLength="100" defaultValue={user.name} /> : <strong>{user.name}</strong>}</label><label className="profile-field"><span>Email address</span><strong>{user.email}</strong></label><label className="profile-field"><span>Role</span><strong>{portalMeta[role].label}</strong></label><label className="profile-field"><span>Bio</span>{edit ? <textarea name="bio" rows="3" maxLength="1000" defaultValue={user.bio || ''} /> : <strong>{user.bio || 'No bio added.'}</strong>}</label><label className="profile-field"><span>Interests (comma separated)</span>{edit ? <input name="interests" defaultValue={(user.interests || []).join(', ')} /> : <strong>{user.interests?.join(', ') || 'No interests added.'}</strong>}</label>{edit && <><label className="profile-field"><span>Current password (only to change password)</span><input name="currentPassword" type="password" autoComplete="current-password" /></label><label className="profile-field"><span>New password (optional)</span><input name="newPassword" type="password" minLength="10" autoComplete="new-password" /></label><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save profile'} <Check size={15} /></Button></>}</form></section></div></div>
}

export default App
