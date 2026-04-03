import { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { useAuth } from '../context/AuthContext'
import api from '../api'

export default function Results() {
  const { isAdmin } = useAuth()
  const { state } = useLocation()
  const navigate = useNavigate()
  
  // Use state for results so we can update them inline after a successful edit
  const [results, setResults] = useState(state?.results || [])
  const [summary, setSummary] = useState(state?.summary || { strengths: [], weaknesses: [] })

  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [savingId, setSavingId] = useState(null)

  // Session-level editing state
  const [editingSessionField, setEditingSessionField] = useState(null)
  const [sessionEditValue, setSessionEditValue] = useState('')
  const [savingSession, setSavingSession] = useState(false)

  const handleEditClick = (evalId, currentPoints) => {
    let text = ''
    if (Array.isArray(currentPoints)) {
      text = currentPoints.join('\n')
    } else if (currentPoints) {
      text = currentPoints
    }
    setEditValue(text)
    setEditingId(evalId)
  }

  const handleSaveClick = async (evalId, index) => {
    if (!evalId) return

    setSavingId(evalId)
    try {
      // Split by newline and filter out empties
      const newPoints = editValue.split('\n').map(p => p.trim()).filter(Boolean)
      
      await api.put(`/admin/evaluations/${evalId}`, { missing_points: newPoints })
      
      // Update local state so UI reflects changes immediately
      const updatedResults = [...results]
      updatedResults[index].evaluation.missing_points = newPoints
      setResults(updatedResults)
      
      setEditingId(null)
    } catch (err) {
      console.error("Failed to save missing points:", err)
      alert("Failed to save missing points. " + err.message)
    } finally {
      setSavingId(null)
    }
  }

  const handleEditSession = (field, currentItems) => {
    let text = ''
    if (Array.isArray(currentItems)) {
      text = currentItems.join('\n')
    } else if (currentItems) {
      text = currentItems
    }
    setSessionEditValue(text)
    setEditingSessionField(field)
  }

  const handleSaveSession = async (field) => {
    if (!summary.id) return

    setSavingSession(true)
    try {
      const newItems = sessionEditValue.split('\n').map(p => p.trim()).filter(Boolean)
      
      const payload = field === 'strengths' ? { overall_strengths: newItems } : { overall_weaknesses: newItems }
      await api.put(`/admin/sessions/${summary.id}`, payload)
      
      setSummary(prev => ({ ...prev, [field]: newItems }))
      setEditingSessionField(null)
    } catch (err) {
      console.error(`Failed to save ${field}:`, err)
      alert(`Failed to save ${field}. ` + err.message)
    } finally {
      setSavingSession(false)
    }
  }

  if (results.length === 0) {
    return (
      <div className="page flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold mb-4">No results found</h1>
        <Link to="/" className="btn-primary">Return Home</Link>
      </div>
    )
  }

  // Overall score is evaluated holistically by Gemini
  const avgScore = summary.overall_score ?? 0

  const chartData = [
    { name: 'Score', value: avgScore, color: '#6c63ff' },
  ]

  return (
    <div className="page max-w-4xl mx-auto pt-8 pb-20">
      {/* Navigation */}
      {isAdmin && (
        <button onClick={() => navigate(-1)} className="text-[var(--text-muted)] hover:text-white mb-6 inline-block transition-colors text-sm text-left">
          ← Back to Student Profile
        </button>
      )}

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Interview Analysis</h1>
        <button onClick={() => window.print()} className="btn-secondary text-sm">🖨️ Print Report</button>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-6 mb-10 animate-fadeInUp">
        <div className="glass p-6 text-center flex flex-col items-center justify-center">
          <p className="text-[var(--text-muted)] text-sm mb-2 font-medium">Overall Score</p>
          <div className="relative w-32 h-32 mb-2">
            <svg className="w-full h-full score-ring">
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--accent)" />
                  <stop offset="100%" stopColor="var(--accent-light)" />
                </linearGradient>
              </defs>
              <circle className="score-ring-track" cx="64" cy="64" r="58" strokeWidth="8" />
              <circle
                className="score-ring-fill" cx="64" cy="64" r="58" strokeWidth="8"
                strokeDasharray="364.4"
                strokeDashoffset={364.4 - (364.4 * avgScore) / 100}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-[var(--text-primary)]">{avgScore}%</span>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)]">Based on {results.length} questions</p>
        </div>

        <div className="glass p-6 flex flex-col justify-center gap-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[var(--text-muted)] text-xs font-medium uppercase mb-1">Confidence</p>
              <p className="text-2xl font-bold text-[var(--accent-light)]">High</p>
            </div>
            <div className="w-20 h-1 rounded-full bg-[var(--border)] overflow-hidden">
              <div className="h-full bg-[var(--accent-light)]" style={{ width: `85%` }} />
            </div>
          </div>
        </div>

        <div className="glass p-6">
          <p className="text-sm font-semibold mb-4 text-[var(--text-muted)]">Performance Metrics</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" hide />
              <YAxis hide domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Question Breakdown ────────────────────────────────────── */}
      <h2 className="text-xl font-bold mb-6">Step-by-Step Breakdown</h2>
      <div className="space-y-6">
        {results.map((r, i) => (
          <div key={i} className="glass p-6 animate-fadeInUp" style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-[var(--bg-dark)] border border-[var(--border)] flex items-center justify-center font-bold text-sm text-[var(--text-primary)]">{i + 1}</span>
                <h3 className="font-semibold text-lg">{r.category} Question</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${r.difficulty === 'Easy' ? 'badge-easy' : r.difficulty === 'Hard' ? 'badge-hard' : 'badge-medium'}`}>
                  {r.difficulty}
                </span>
                <span className="text-xl font-bold text-[var(--accent-light)]">{r.evaluation.score}/100</span>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-[var(--text-muted)] text-sm mb-1 uppercase font-semibold">Question</p>
              <p className="text-[var(--text-primary)] leading-relaxed font-medium">{r.question}</p>
            </div>

            <div className="mb-6 p-4 rounded-xl bg-[var(--bg-dark)] border border-[var(--border)]">
              <p className="text-[var(--accent-light)] text-xs font-bold uppercase mb-2 flex items-center gap-1.5">
                <span className="text-sm">🗣️</span> Your Answer
              </p>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                {r.userAnswer || r.user_answer || '(No answer provided)'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <div className="flex justify-between items-center mb-2">
                <p className="text-amber-400 text-xs font-bold uppercase flex items-center gap-1.5">
                  <span className="text-sm">🎯</span> Missing Key Points
                </p>
                {isAdmin && r.evaluation?.id && (
                  editingId === r.evaluation.id ? (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditingId(null)} 
                        className="text-xs text-[var(--text-muted)] hover:text-white"
                        disabled={savingId === r.evaluation.id}
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => handleSaveClick(r.evaluation.id, i)}
                        className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded hover:bg-amber-500/30"
                        disabled={savingId === r.evaluation.id}
                      >
                        {savingId === r.evaluation.id ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleEditClick(r.evaluation.id, r.evaluation.missing_points)}
                      className="text-xs text-[var(--accent-light)] hover:underline"
                    >
                      Edit
                    </button>
                  )
                )}
              </div>
              
              {editingId === r.evaluation?.id ? (
                <textarea
                  className="w-full bg-[var(--bg-dark)] border border-amber-500/30 rounded p-2 text-sm text-[var(--text-primary)] outline-none min-h-[100px]"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Enter one point per line..."
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-[var(--text-primary)] leading-relaxed space-y-1">
                  {Array.isArray(r.evaluation?.missing_points) && r.evaluation.missing_points.length > 0 ? (
                    r.evaluation.missing_points.map((pt, idx) => (
                      <li key={idx}>{pt}</li>
                    ))
                  ) : (
                    <li>{r.evaluation?.missing_points ? String(r.evaluation?.missing_points) : "None"}</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-12 mb-6">
        <div className="p-6 rounded-xl bg-green-500/5 border border-green-500/10 h-full">
          <div className="flex justify-between items-center mb-4">
            <p className="text-[var(--success)] text-sm font-bold uppercase flex items-center gap-2">
              <span className="text-xl">✅</span> Strengths & Mastered Concepts
            </p>
            {isAdmin && summary.id && (
              editingSessionField === 'strengths' ? (
                <div className="flex gap-2">
                  <button onClick={() => setEditingSessionField(null)} className="text-xs text-[var(--text-muted)] hover:text-white" disabled={savingSession}>Cancel</button>
                  <button onClick={() => handleSaveSession('strengths')} className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded" disabled={savingSession}>{savingSession ? 'Saving...' : 'Save'}</button>
                </div>
              ) : (
                <button onClick={() => handleEditSession('strengths', summary.strengths)} className="text-xs text-[var(--accent-light)] hover:underline">Edit</button>
              )
            )}
          </div>
          
          {editingSessionField === 'strengths' ? (
            <textarea
              className="w-full bg-[var(--bg-dark)] border border-green-500/30 rounded p-2 text-sm text-[var(--text-primary)] outline-none min-h-[120px]"
              value={sessionEditValue}
              onChange={(e) => setSessionEditValue(e.target.value)}
              placeholder="Enter one point per line..."
            />
          ) : (
            <ul className="list-disc list-inside space-y-3 text-[var(--text-primary)]">
              {Array.isArray(summary.strengths) && summary.strengths.length > 0 ? (
                summary.strengths.map((str, i) => (
                  <li key={i} className="leading-relaxed text-sm">
                    {str}
                  </li>
                ))
              ) : (
                <li className="text-[var(--text-muted)] italic text-sm">No specific strengths identified.</li>
              )}
            </ul>
          )}
        </div>
        <div className="p-6 rounded-xl bg-red-500/5 border border-red-500/10 h-full">
          <div className="flex justify-between items-center mb-4">
            <p className="text-[var(--danger)] text-sm font-bold uppercase flex items-center gap-2">
              <span className="text-xl">⚠️</span> Areas for Improvement
            </p>
            {isAdmin && summary.id && (
              editingSessionField === 'weaknesses' ? (
                <div className="flex gap-2">
                  <button onClick={() => setEditingSessionField(null)} className="text-xs text-[var(--text-muted)] hover:text-white" disabled={savingSession}>Cancel</button>
                  <button onClick={() => handleSaveSession('weaknesses')} className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded" disabled={savingSession}>{savingSession ? 'Saving...' : 'Save'}</button>
                </div>
              ) : (
                <button onClick={() => handleEditSession('weaknesses', summary.weaknesses)} className="text-xs text-[var(--accent-light)] hover:underline">Edit</button>
              )
            )}
          </div>
          
          {editingSessionField === 'weaknesses' ? (
            <textarea
              className="w-full bg-[var(--bg-dark)] border border-red-500/30 rounded p-2 text-sm text-[var(--text-primary)] outline-none min-h-[120px]"
              value={sessionEditValue}
              onChange={(e) => setSessionEditValue(e.target.value)}
              placeholder="Enter one point per line..."
            />
          ) : (
            <ul className="list-disc list-inside space-y-3 text-[var(--text-primary)]">
              {Array.isArray(summary.weaknesses) && summary.weaknesses.length > 0 ? (
                summary.weaknesses.map((wk, i) => (
                  <li key={i} className="leading-relaxed text-sm">
                    {wk}
                  </li>
                ))
              ) : (
                <li className="text-[var(--text-muted)] italic text-sm">No specific weaknesses identified.</li>
              )}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-12 text-center">
        {isAdmin ? (
          <div className="flex items-center justify-center gap-4">
            <button 
              onClick={() => alert('Future Logic: Setting session as verified and visible to student.')} 
              className="btn-primary px-10 py-3 font-bold bg-gradient-to-r from-green-500 to-emerald-600 shadow-[0_4px_20px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_25px_rgba(16,185,129,0.4)]"
            >
              ✅ Approve & Submit Report
            </button>
          </div>
        ) : (
          <button onClick={() => navigate('/setup')} className="btn-primary px-10 py-4 text-lg">
            Practice Again
          </button>
        )}
      </div>
    </div>
  )
}
