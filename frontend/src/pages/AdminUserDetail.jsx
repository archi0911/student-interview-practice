import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api'

export default function AdminUserDetail() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Expanded session details state
  const [expandedSessionId, setExpandedSessionId] = useState(null)
  const [sessionDetails, setSessionDetails] = useState({})
  const [detailsLoading, setDetailsLoading] = useState({})

  const handleViewReport = (session, questions) => {
    // Reconstruct the exact object format that Results.jsx expects
    const summary = {
      id: session.id,
      overall_score: session.overall_score || Math.round(questions.reduce((acc, q) => acc + (q.evaluations?.[0]?.score || 0), 0) / questions.length) || 0,
      strengths: session.overall_strengths || [],
      weaknesses: session.overall_weaknesses || []
    }

    const results = questions.map(q => ({
      category: q.category || 'General',
      difficulty: q.difficulty || 'Medium',
      question: q.question_text,
      user_answer: q.evaluations?.[0]?.user_answer || '(No answer provided)',
      evaluation: {
        id: q.evaluations?.[0]?.id || null,
        score: q.evaluations?.[0]?.score || 0,
        missing_points: q.evaluations?.[0]?.missing_points || []
      }
    }))

    navigate('/admin/results', { state: { summary, results, mode: session.mode, context: session.context } })
  }

  useEffect(() => {
    fetchUserData()
  }, [userId])

  const fetchUserData = async () => {
    try {
      const res = await api.get(`/admin/users/${userId}/sessions`)
      setUser(res.data.user)
      setSessions(res.data.sessions)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleSession = async (sessionId) => {
    // If already expanded, close it
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null)
      return
    }

    setExpandedSessionId(sessionId)

    // If we haven't fetched details for this session yet, fetch them
    if (!sessionDetails[sessionId]) {
      setDetailsLoading(prev => ({ ...prev, [sessionId]: true }))
      try {
        const res = await api.get(`/admin/sessions/${sessionId}`)
        setSessionDetails(prev => ({ ...prev, [sessionId]: res.data.questions }))
      } catch (err) {
        console.error('Failed to load session details:', err)
      } finally {
        setDetailsLoading(prev => ({ ...prev, [sessionId]: false }))
      }
    }
  }

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation()
    if (!window.confirm('Are you certain you want to delete this session? This action cannot be undone.')) return

    try {
      await api.delete(`/admin/sessions/${sessionId}`)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (expandedSessionId === sessionId) setExpandedSessionId(null)
    } catch (err) {
      console.error(err)
      alert('Failed to delete session: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="page flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="page pt-8">
        <div className="glass p-8 text-center text-red-400">
          <p className="text-xl font-semibold mb-2">Error loading user profile</p>
          <p>{error || 'User not found'}</p>
          <Link to="/admin" className="btn-secondary mt-4">← Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page max-w-4xl mx-auto pt-8 pb-16">
      <div className="animate-fadeInUp">
        
        {/* Navigation */}
        <Link to="/admin" className="text-[var(--text-muted)] hover:text-white mb-6 inline-block transition-colors text-sm">
          ← Back to Admin Dashboard
        </Link>

        {/* Profile Header */}
        <div className="glass p-8 mb-8 flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--bg-card)] to-[var(--border)] border border-[var(--border)] flex items-center justify-center text-3xl font-bold text-[var(--accent-light)] shrink-0">
            {user.full_name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-1">{user.full_name}</h1>
            <p className="text-[var(--text-muted)]">{user.email}</p>
            <div className="flex gap-4 mt-3">
              <div className="badge border border-[var(--border)]">
                {sessions.length} Interviews
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4">Interview History</h2>

        {/* Sessions List */}
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <div className="glass p-8 text-center text-[var(--text-muted)]">
              This user hasn't completed any interviews yet.
            </div>
          ) : (
            sessions.map((session, i) => {
              const isExpanded = expandedSessionId === session.id
              const isDetailsLoading = detailsLoading[session.id]
              const questions = sessionDetails[session.id]

              return (
                <div key={session.id} className="glass overflow-hidden animate-fadeInUp" style={{ animationDelay: `${i * 0.1}s` }}>
                  
                  {/* Session Header (Clickable) */}
                  <div 
                    onClick={() => toggleSession(session.id)}
                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-black/10 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="badge bg-[var(--bg-card)] border border-[var(--border)] uppercase tracking-wider text-[10px]">
                          {session.mode}
                        </span>
                        <span className="font-semibold">{new Date(session.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="text-sm text-[var(--text-muted)] w-full truncate max-w-lg">
                        {session.context}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Overall score if generated */}
                      {session.overall_strengths && session.overall_strengths.length > 0 && (
                        <div className="hidden sm:block px-3 py-1 bg-[var(--accent)]/10 text-[var(--accent-light)] text-sm rounded-lg font-medium border border-[var(--accent)]/30">
                          Score Generated
                        </div>
                      )}
                      <button
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        className="p-2 ml-4 hover:bg-[var(--border)] rounded-lg transition-colors text-red-500 opacity-70 hover:opacity-100"
                        title="Delete Session"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18"></path>
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                      </button>
                      <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </div>
                    </div>
                  </div>

                  {/* Expanded Session Details */}
                  {isExpanded && (
                    <div className="border-t border-[var(--border)] bg-black/20 p-6">
                      {isDetailsLoading ? (
                        <div className="flex justify-center p-4">
                          <div className="w-6 h-6 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                        </div>
                      ) : questions ? (
                        <div className="space-y-6">
                          <div className="flex justify-between items-center bg-black/20 p-4 rounded-xl border border-[var(--border)] mb-6">
                            <p className="text-sm text-[var(--text-muted)]">
                              Reviewing {questions.length} questions and evaluations.
                            </p>
                            <button
                              onClick={() => handleViewReport(session, questions)}
                              className="btn-primary text-sm py-2 px-4 whitespace-nowrap"
                            >
                              📊 View Full Graphic Report
                            </button>
                          </div>
                          
                          {questions.map((q, idx) => {
                            const evalData = q.evaluations?.[0]
                            return (
                              <div key={q.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-dark)]">
                                <div className="text-sm font-medium text-[var(--accent-light)] mb-2">Question {idx + 1}</div>
                                <div className="font-medium mb-4 text-base">{q.question_text}</div>
                                
                                {evalData ? (
                                  <>
                                    <div className="mb-4">
                                      <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">User's Answer</div>
                                      <div className="p-3 rounded-lg bg-[var(--bg-card)] text-sm border border-[var(--border)] text-[var(--text-primary)]">
                                        {evalData.user_answer}
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-start gap-4">
                                      <div className="text-center shrink-0">
                                        <div className="text-xs text-[var(--text-muted)] mb-1">Score</div>
                                        <div className={`text-xl font-bold ${evalData.score >= 70 ? 'text-green-400' : evalData.score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                          {evalData.score}%
                                        </div>
                                      </div>
                                      <div className="flex-1">
                                        <div className="text-xs text-[var(--text-muted)] mb-1">Feedback</div>
                                        <div className="text-sm text-[var(--text-muted)]">{evalData.feedback}</div>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-sm text-yellow-500/80 italic">Not answered / Evaluated</div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-center text-[var(--text-muted)]">Failed to load details.</div>
                      )}
                    </div>
                  )}

                </div>
              )
            })
          )}
        </div>

      </div>
    </div>
  )
}
