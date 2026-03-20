import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function History() {
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [expanded, setExpanded] = useState(null) // ID of expanded session

  useEffect(() => {
    fetchHistory()
  }, [])

  const formatContext = (ctx) => {
    try {
      const parsed = JSON.parse(ctx)
      if (Array.isArray(parsed)) return parsed.join(', ')
    } catch(e) {}
    return ctx
  }

  const handleDelete = async (e, sessionId) => {
    e.stopPropagation() // Prevent row expansion
    if (!window.confirm('Are you sure you want to delete this interview session? This cannot be undone.')) {
      return
    }

    try {
      await api.delete(`/history/${sessionId}`)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    }
  }

  const fetchHistory = async () => {
    try {
      const res = await api.get('/history')
      setSessions(res.data.sessions)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="page flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="page max-w-4xl mx-auto pb-20">
       <nav className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] flex items-center justify-center text-sm">🎯</div>
          <span className="font-bold">InterviewHub</span>
        </div>
        <Link to="/" className="btn-secondary text-sm px-4 py-2">← Back to Dashboard</Link>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Your Performance History</h1>
        <div className="glass px-4 py-2 text-sm">
          Sessions: <span className="font-bold text-[var(--accent-light)]">{sessions.length}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 mb-6">{error}</div>
      )}

      {sessions.length === 0 ? (
        <div className="glass p-20 text-center">
          <div className="text-4xl mb-4">🌙</div>
          <h2 className="text-xl font-semibold mb-2">No sessions yet</h2>
          <p className="text-[var(--text-muted)] mb-8">Take your first mock interview to see how you score!</p>
          <Link to="/setup" className="btn-primary">Start a Practice Session</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => (
            <div key={s.id} className="glass overflow-hidden animate-fadeInUp">
              <div
                className="p-6 cursor-pointer flex items-center justify-between hover:bg-white/5 transition-colors"
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              >
                <div className="flex items-center gap-6 overflow-hidden flex-1">
                  <div className="text-2xl flex-shrink-0">{s.mode === 'resume' ? '📄' : s.mode === 'role' ? '💼' : '📚'}</div>
                  <div className="min-w-0 pr-4">
                    <h3 className="font-semibold text-lg capitalize truncate" title={formatContext(s.context)}>
                      {s.mode}: {formatContext(s.context)}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">{new Date(s.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-center hidden md:block">
                    <p className="text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-wider mb-1">Questions</p>
                    <p className="font-bold">{s.questionCount}</p>
                  </div>
                  <div className="text-center w-16">
                    <p className="text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-wider mb-1">Avg Score</p>
                    <p className={`font-bold text-lg ${s.averageScore >= 80 ? 'text-[var(--success)]' : s.averageScore >= 50 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'}`}>
                      {s.averageScore ?? 'N/A'}{s.averageScore ? '%' : ''}
                    </p>
                  </div>
                  <button 
                    onClick={(e) => handleDelete(e, s.id)} 
                    className="p-2 ml-4 hover:bg-black/20 rounded-lg transition-colors text-red-500 opacity-70 hover:opacity-100"
                    title="Delete session"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  </button>
                  <div className={`transition-transform duration-300 ${expanded === s.id ? 'rotate-180' : ''}`}>
                    ▼
                  </div>
                </div>
              </div>

              {expanded === s.id && (
                <div className="bg-white/5 border-t border-[var(--border)] p-6 space-y-4 animate-fadeIn">
                  {s.questions.map((q, idx) => (
                    <div key={q.id} className="p-4 rounded-xl bg-black/20 border border-white/5">
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <p className="text-sm font-medium leading-relaxed">
                          <span className="text-[var(--text-muted)] italic mr-2">Q{idx+1}:</span> {q.question_text}
                        </p>
                        <span className="font-bold text-[var(--accent-light)] whitespace-nowrap">{q.evaluation?.score ?? 0}%</span>
                      </div>
                      {q.evaluation && (
                        <p className="text-xs text-[var(--text-muted)] italic line-clamp-1 hover:line-clamp-none transition-all cursor-default">
                          "{q.evaluation.feedback}"
                        </p>
                      )}
                    </div>
                  ))}
                  <div className="pt-2">
                     <Link to="/results" state={{ results: s.questions, summary: { strengths: s.overall_strengths, weaknesses: s.overall_weaknesses } }} className="text-sm text-[var(--accent-light)] font-bold hover:underline">
                        View Detailed Report →
                     </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
