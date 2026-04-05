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

  const fetchHistory = async () => {
    try {
      const res = await api.get('/history')
      console.log(`[CLIENT HISTORY] Fetched ${res.data.sessions.length} sessions`);
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
    <div className="page max-w-4xl mx-auto pt-8 pb-20">

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Your Performance History</h1>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => { setLoading(true); fetchHistory(); }}
            className="btn-secondary text-xs py-2 px-4 flex items-center gap-2"
          >
            🔄 Refresh Status
          </button>
          <div className="glass px-4 py-2 text-sm">
            Sessions: <span className="font-bold text-[var(--accent-light)]">{sessions.length}</span>
          </div>
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
                className="p-6 cursor-pointer flex items-center justify-between hover:bg-[var(--accent-glow)] transition-colors"
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
                    {(s.is_verified || s.averageScore !== null) ? (
                      <p className={`font-bold text-lg ${s.averageScore >= 80 ? 'text-[var(--success)]' : s.averageScore >= 50 ? 'text-[var(--warning)]' : 'text-[var(--danger)]'}`}>
                        {s.averageScore ?? 'N/A'}{s.averageScore ? '%' : ''}
                      </p>
                    ) : (
                      <span className="inline-block bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider mt-0.5">
                        Pending
                      </span>
                    )}
                  </div>
                  <div className={`transition-transform duration-300 ${expanded === s.id ? 'rotate-180' : ''}`}>
                    ▼
                  </div>
                </div>
              </div>

              {expanded === s.id && (
                <div className="bg-[var(--bg-dark)] border-t border-[var(--border)] p-6 space-y-4 animate-fadeIn">
                  {(s.is_verified || s.averageScore !== null) ? (
                    <>
                      {s.questions.map((q, idx) => (
                        <div key={q.id} className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
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
                          <Link 
                            to="/results" 
                            state={{ 
                              results: s.questions, 
                              summary: { 
                                id: s.id,
                                is_verified: s.is_verified,
                                overall_score: s.averageScore,
                                strengths: s.overall_strengths, 
                                weaknesses: s.overall_weaknesses 
                              } 
                            }} 
                            className="text-sm text-[var(--accent-light)] font-bold hover:underline"
                          >
                             View Detailed Report →
                          </Link>
                       </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-[var(--text-muted)]">
                      <div className="text-4xl mb-4">⏳</div>
                      <p className="font-medium text-[var(--text-primary)]">Your results are currently being reviewed by an administrator.</p>
                      <p className="text-sm mt-2">Check back later for your detailed feedback and scores once approved.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
