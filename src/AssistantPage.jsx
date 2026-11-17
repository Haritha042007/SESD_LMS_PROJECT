import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, BookOpen, ChevronDown, LoaderCircle, MessageSquare, Plus, Send, Sparkles, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from './services/api'

const suggestedQuestions = [
  'Can you explain this topic in simple terms?',
  'Give me a practical example.',
  'What are the key ideas I should remember?',
]

function formatTime(date) {
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function AssistantPage() {
  const [courses, setCourses] = useState([])
  const [courseId, setCourseId] = useState('')
  const [topic, setTopic] = useState('General')
  const [conversations, setConversations] = useState([])
  const [conversationId, setConversationId] = useState('')
  const [messages, setMessages] = useState([])
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState('')
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)

  const selectedCourse = courses.find((course) => course.id === courseId)
  const topics = useMemo(() => selectedCourse?.topics?.length ? selectedCourse.topics : ['General'], [selectedCourse])

  useEffect(() => {
    let active = true
    Promise.all([api.getAssistantCourses(), api.getAssistantStatus()]).then(([items, status]) => {
      if (!active) return
      setCourses(items)
      setCourseId(items[0]?.id || '')
      setTopic(items[0]?.topics?.[0] || 'General')
      setMode(status.mode)
    }).catch((loadError) => setError(loadError.message)).finally(() => {
      if (active) setLoadingCourses(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!courseId) {
      setConversations([])
      setConversationId('')
      setMessages([])
      return undefined
    }
    let active = true
    setLoadingHistory(true)
    setError('')
    setConversationId('')
    setMessages([])
    api.getAssistantConversations(courseId).then(async (items) => {
      if (!active) return
      setConversations(items)
      const recent = items[0]
      if (!recent) return
      const conversation = await api.getAssistantConversation(recent._id)
      if (!active) return
      setConversationId(conversation._id)
      setMessages(conversation.messages || [])
      const lastReplyMode = conversation.messages?.filter((message) => message.role === 'assistant').at(-1)?.mode
      if (lastReplyMode) setMode(lastReplyMode)
    }).catch((loadError) => {
      if (active) setError(loadError.message)
    }).finally(() => {
      if (active) setLoadingHistory(false)
    })
    return () => { active = false }
  }, [courseId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, sending])

  async function openConversation(id) {
    setLoadingHistory(true)
    setError('')
    try {
      const item = await api.getAssistantConversation(id)
      setConversationId(item._id)
      setMessages(item.messages || [])
      const lastReplyMode = item.messages?.filter((message) => message.role === 'assistant').at(-1)?.mode
      if (lastReplyMode) setMode(lastReplyMode)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoadingHistory(false)
    }
  }

  async function startConversation() {
    if (!courseId) return
    setError('')
    try {
      const item = await api.createAssistantConversation(courseId)
      setConversations((items) => [item, ...items])
      setConversationId(item._id)
      setMessages([])
    } catch (createError) {
      setError(createError.message)
    }
  }

  async function clearHistory() {
    if (!courseId || conversations.length === 0) return
    if (!window.confirm('Delete all assistant conversations for this course? This cannot be undone.')) return
    setError('')
    try {
      await api.clearAssistantConversations(courseId)
      setConversations([])
      setConversationId('')
      setMessages([])
    } catch (clearError) {
      setError(clearError.message)
    }
  }

  async function sendMessage(event) {
    event?.preventDefault()
    const question = prompt.trim()
    if (!question || sending || !courseId) return
    setError('')
    setSending(true)
    try {
      let activeConversationId = conversationId
      if (!activeConversationId) {
        const created = await api.createAssistantConversation(courseId)
        activeConversationId = created._id
        setConversationId(created._id)
      }
      const result = await api.sendAssistantMessage(activeConversationId, { question, topic })
      setMessages(result.conversation.messages || [])
      setMode(result.mode)
      setConversations((items) => {
        const updated = result.conversation
        return [updated, ...items.filter((item) => item._id !== updated._id)]
      })
      setPrompt('')
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setSending(false)
    }
  }

  function useSuggestion(question) {
    setPrompt(question)
  }

  if (loadingCourses) return <div className="assistant-loading"><LoaderCircle className="assistant-spin" size={24} /> Loading your enrolled courses…</div>

  if (!courses.length) {
    return <section className="assistant-empty panel">
      <span className="assistant-empty-icon"><Bot size={25} /></span>
      <p className="eyebrow">LEARN WITH CONFIDENCE</p>
      <h1>Your AI Learning Assistant</h1>
      <p>Enroll in a course first, and your course topics will be available here.</p>
      <Link className="button" to="/student/courses"><BookOpen size={16} /> Explore courses</Link>
      {error && <p className="assistant-error">{error}</p>}
    </section>
  }

  return (
    <section className="assistant-page">
      <header className="assistant-heading">
        <div>
          <p className="eyebrow">PERSONAL STUDY COMPANION</p>
          <h1>AI Learning Assistant</h1>
          <p>Ask questions about your enrolled courses and get clear, course-focused help.</p>
        </div>
        <span className={`assistant-mode ${mode === 'ai' ? 'mode-live' : 'mode-demo'}`}>
          <span /> {mode === 'ai' ? 'AI provider ready' : 'Demo mode · no AI key configured'}
        </span>
      </header>

      <div className="assistant-workspace">
        <aside className="assistant-history">
          <div className="assistant-history-top">
            <strong>Conversations</strong>
            <button type="button" className="assistant-icon-button" onClick={startConversation} aria-label="Start a new conversation" title="New conversation"><Plus size={17} /></button>
          </div>
          <button type="button" className="assistant-new-chat" onClick={startConversation}><Plus size={15} /> New conversation</button>
          <div className="assistant-history-list">
            {conversations.map((conversation) => (
              <button
                type="button"
                key={conversation._id}
                className={`assistant-history-item ${conversation._id === conversationId ? 'selected' : ''}`}
                onClick={() => openConversation(conversation._id)}
              >
                <MessageSquare size={15} />
                <span><strong>{conversation.title || 'New conversation'}</strong><small>{formatTime(conversation.updatedAt)}</small></span>
              </button>
            ))}
            {!conversations.length && <p className="assistant-history-empty">Your course conversations will appear here.</p>}
          </div>
          <button type="button" className="assistant-clear" onClick={clearHistory} disabled={!conversations.length}><Trash2 size={14} /> Clear course history</button>
        </aside>

        <div className="assistant-chat">
          <div className="assistant-controls">
            <label>
              <span>Course</span>
              <select value={courseId} onChange={(event) => { const next = courses.find((course) => course.id === event.target.value); setCourseId(event.target.value); setTopic(next?.topics?.[0] || 'General') }}>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
              <ChevronDown size={15} />
            </label>
            <label>
              <span>Topic</span>
              <select value={topic} onChange={(event) => setTopic(event.target.value)}>
                {topics.map((item) => <option key={item} value={item}>{item}</option>)}
                {!topics.includes('General') && <option value="General">General course question</option>}
              </select>
              <ChevronDown size={15} />
            </label>
          </div>

          <div className="assistant-messages" ref={scrollRef} aria-live="polite">
            {loadingHistory ? <div className="assistant-loading"><LoaderCircle className="assistant-spin" size={22} /> Loading conversation…</div> : null}
            {!loadingHistory && messages.length === 0 && (
              <div className="assistant-welcome">
                <span className="assistant-welcome-icon"><Sparkles size={24} /></span>
                <h2>What would you like to understand?</h2>
                <p>Choose a topic or start with one of these questions.</p>
                <div className="assistant-suggestions">
                  {suggestedQuestions.map((question) => <button key={question} type="button" onClick={() => useSuggestion(question)}>{question}<span>↗</span></button>)}
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <article className={`assistant-message message-${message.role}`} key={message._id || `${message.role}-${index}`}>
                <span className="assistant-message-avatar">{message.role === 'assistant' ? <Bot size={17} /> : 'You'}</span>
                <div><small>{message.role === 'assistant' ? 'Learnly assistant' : 'You'}{message.topic ? ` · ${message.topic}` : ''}</small><p>{message.content}</p></div>
              </article>
            ))}
            {sending && <div className="assistant-thinking"><span className="assistant-message-avatar"><Bot size={17} /></span><span className="assistant-dots"><i /><i /><i /></span><small>Preparing an explanation…</small></div>}
          </div>

          {error && <div className="assistant-error" role="alert">{error}</div>}
          {mode === 'demo' && <p className="assistant-demo-note">Demo mode: responses show saved course material, not generated AI answers. Configure a backend AI provider for explanations.</p>}

          <form className="assistant-composer" onSubmit={sendMessage}>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(event) } }}
              placeholder={`Ask about ${topic.toLowerCase()}…`}
              maxLength={2000}
              rows={2}
              aria-label="Your question"
              disabled={sending}
            />
            <div className="assistant-composer-footer"><small>Enter to send · Shift + Enter for a new line</small><button type="submit" disabled={!prompt.trim() || sending} aria-label="Send question"><Send size={17} /></button></div>
          </form>
        </div>
      </div>
    </section>
  )
}
