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
  const [editScoreValue, setEditScoreValue] = useState('')
  const [savingId, setSavingId] = useState(null)

  const [editingSessionField, setEditingSessionField] = useState(null)
  const [sessionEditValue, setSessionEditValue] = useState('')
  
  const [editingOverallScore, setEditingOverallScore] = useState(false)
  const [overallScoreEditValue, setOverallScoreEditValue] = useState('')

  const [savingSession, setSavingSession] = useState(false)
  const [approving, setApproving] = useState(false)

  const handleEditClick = (evalId, currentPoints, currentScore) => {
    let text = ''
    if (Array.isArray(currentPoints)) {
      text = currentPoints.join('\n')
    } else if (currentPoints) {
      text = currentPoints
    }
    setEditValue(text)
    setEditScoreValue(String(currentScore || 0))
    setEditingId(evalId)
  }

  const handleSaveClick = async (evalId, index) => {
    if (!evalId) return

    setSavingId(evalId)
    try {
      const newScore = parseInt(editScoreValue)
      if (isNaN(newScore) || newScore < 0 || newScore > 100) {
        throw new Error("Score must be between 0 and 100")
      }
      
      // Split by newline and filter out empties
      const newPoints = editValue.split('\n').map(p => p.trim()).filter(Boolean)
      
      await api.put(`/admin/responses/${evalId}`, { 
        score: newScore,
        missing_points: newPoints 
      })
      
      // Update local state so UI reflects changes immediately
      const updatedResults = [...results]
      updatedResults[index].score = newScore
      updatedResults[index].missing_points = newPoints
      setResults(updatedResults)
      
      setEditingId(null)
    } catch (err) {
      console.error("Failed to save evaluation:", err)
      alert("Failed to save evaluation. " + err.message)
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

  const handleOverallScoreSave = async () => {
    if (!summary.id) return

    setSavingSession(true)
    try {
      const newScore = parseInt(overallScoreEditValue)
      if (isNaN(newScore) || newScore < 0 || newScore > 100) {
        throw new Error("Score must be between 0 and 100")
      }
      
      await api.put(`/admin/sessions/${summary.id}`, { overall_score: newScore })
      
      setSummary(prev => ({ ...prev, overall_score: newScore }))
      setEditingOverallScore(false)
    } catch (err) {
      console.error("Failed to save overall score:", err)
      alert("Failed to save overall score. " + err.message)
    } finally {
      setSavingSession(false)
    }
  }

  const [showConfirm, setShowConfirm] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleApproveClick = () => {
    if (!summary.id) {
       alert('Missing session ID. Cannot approve.');
       return;
    }
    setShowConfirm(true)
  }

  const executeApproval = async () => {
    setShowConfirm(false)
    setApproving(true)
    try {
      await api.put(`/admin/sessions/${summary.id}`, { is_verified: true })
      setSummary(prev => ({ ...prev, is_verified: true }))
      setShowSuccess(true)
      // Success modal stays for 2 seconds then navigates
      setTimeout(() => {
        navigate('/admin')
      }, 2000)
    } catch (err) {
      console.error('Failed to approve:', err)
      alert('Error: ' + err.message)
    } finally {
      setApproving(false)
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
          <div className="relative w-32 h-32 mb-2 group">
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
              {isAdmin && editingOverallScore ? (
                <div className="flex flex-col items-center gap-1">
                  <input
                    type="number"
                    className="w-16 bg-[var(--bg-dark)] border border-[var(--accent)] rounded text-center text-xl font-bold py-1 outline-none"
                    value={overallScoreEditValue}
                    onChange={(e) => setOverallScoreEditValue(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button onClick={() => setEditingOverallScore(false)} className="text-[10px] text-[var(--text-muted)] hover:text-white">✕</button>
                    <button onClick={handleOverallScoreSave} className="text-[10px] text-green-400 font-bold" disabled={savingSession}>✓</button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <span className="text-3xl font-bold text-[var(--text-primary)]">{avgScore}%</span>
                  {isAdmin && (
                    <button 
                      onClick={() => { setOverallScoreEditValue(String(avgScore)); setEditingOverallScore(true); }}
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-dark)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[8px] flex items-center gap-1"
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}
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
        {results.map((r, i) => {
          let detailedBreakdown = r.detailed_breakdown;
          let feedbackText = r.feedback || '';

          if (r.feedback && typeof r.feedback === 'string' && r.feedback.startsWith('{')) {
             try {
                const parsed = JSON.parse(r.feedback);
                if (parsed.detailed_breakdown) {
                   detailedBreakdown = parsed.detailed_breakdown;
                   feedbackText = parsed.text || '';
                }
             } catch(e) {}
          }
          
          const questionText = r.question || r.question_text;
          const userAnswerText = r.userAnswer || r.user_answer || '(No answer provided)';

          return (
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
                
                {editingId === r.id ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">Score:</span>
                      <input
                        type="number"
                        className="w-16 bg-[var(--bg-dark)] border border-[var(--accent)] rounded px-2 py-1 text-sm font-bold text-[var(--accent-light)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                        value={editScoreValue}
                        onChange={(e) => setEditScoreValue(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2 ml-2 border-l border-[var(--border)] pl-3">
                      <button 
                        onClick={() => handleSaveClick(r.id, i)}
                        className="text-xs bg-green-500/20 text-green-400 font-bold px-3 py-1.5 rounded hover:bg-green-500/30 transition-colors"
                        disabled={savingId === r.id}
                      >
                        {savingId === r.id ? 'Saving...' : 'Save'}
                      </button>
                      <button 
                        onClick={() => setEditingId(null)} 
                        className="text-xs text-[var(--text-muted)] hover:text-white px-2 py-1.5"
                        disabled={savingId === r.id}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <span className="text-xl font-bold text-[var(--accent-light)]">{r.score ?? 0}/100</span>
                    {isAdmin && r.id && (
                      <button 
                        onClick={() => handleEditClick(r.id, r.missing_points, r.score)}
                        className="btn-secondary text-[10px] py-1 px-3 border border-[var(--border)] hover:border-[var(--accent)] transition-all uppercase font-bold tracking-tight"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6">
              <p className="text-[var(--text-muted)] text-sm mb-1 uppercase font-semibold">Question</p>
              <p className="text-[var(--text-primary)] leading-relaxed font-medium">{questionText}</p>
            </div>

            <div className="mb-6 p-4 rounded-xl bg-[var(--bg-dark)] border border-[var(--border)]">
              <p className="text-[var(--accent-light)] text-xs font-bold uppercase mb-2 flex items-center gap-1.5">
                <span className="text-sm">🗣️</span> Your Answer
              </p>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                {userAnswerText}
              </p>
            </div>

            {detailedBreakdown && (
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                  <p className="text-indigo-400 text-xs font-bold uppercase mb-2">🧑‍💻 Dataset Layer (40%)</p>
                  <p className="text-[var(--text-muted)] text-[10px] mb-3 font-mono">Score Formula: {detailedBreakdown.dataset_layer_40_percent.keyword_math}</p>
                  
                  <div className="flex justify-between items-center bg-black/20 p-2 rounded mb-2 border border-white/5">
                    <span className="text-xs text-[var(--text-muted)] font-medium">Objective Score</span>
                    <span className="text-indigo-400 font-bold">{detailedBreakdown.dataset_layer_40_percent.keyword_score}</span>
                  </div>
                  
                  <div className="mb-2">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase mt-3 mb-1.5 font-bold tracking-wider">Covered from Dataset:</p>
                    <ul className="list-inside list-disc text-xs text-[var(--text-primary)] pl-1 space-y-1">
                      {detailedBreakdown.dataset_layer_40_percent.covered_key_points.map((pt, idx) => <li key={idx}>{pt}</li>)}
                      {detailedBreakdown.dataset_layer_40_percent.covered_key_points.length === 0 && <li className="text-[var(--text-muted)] italic list-none">0 points matched</li>}
                    </ul>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                  <p className="text-purple-400 text-xs font-bold uppercase mb-2">🤖 AI Semantic Layer (60%)</p>
                  <p className="text-[var(--text-muted)] text-[10px] mb-3 font-mono">Gemini Evaluated Metric</p>
                  
                  <div className="flex justify-between items-center bg-black/20 p-2 rounded mb-2 border border-white/5">
                    <span className="text-xs text-[var(--text-muted)] font-medium">Subjective AI Score</span>
                    <span className="text-purple-400 font-bold">{detailedBreakdown.ai_layer_60_percent.ai_score}</span>
                  </div>

                  <div className="mb-2">
                    <p className="text-[10px] text-[var(--text-muted)] uppercase mt-3 mb-1.5 font-bold tracking-wider">Concepts Inferred by AI:</p>
                    <ul className="list-inside list-disc text-xs text-[var(--text-primary)] pl-1 space-y-1">
                      {detailedBreakdown.ai_layer_60_percent.covered_concepts.map((pt, idx) => <li key={idx}>{pt}</li>)}
                      {detailedBreakdown.ai_layer_60_percent.covered_concepts.length === 0 && <li className="text-[var(--text-muted)] italic list-none">No extra concepts</li>}
                    </ul>
                  </div>
                </div>

                <div className="md:col-span-2 p-3 rounded-lg bg-black/30 border border-white/10 flex flex-col sm:flex-row justify-between items-center">
                  <span className="text-xs text-[var(--text-muted)] font-mono">Hybrid Merge: {detailedBreakdown.calculation.formula} = {detailedBreakdown.calculation.math}</span>
                  <span className="font-bold text-[var(--accent-light)] mt-2 sm:mt-0 text-sm bg-[var(--accent)]/10 px-3 py-1 rounded-full border border-[var(--accent)]/30">Final Result: {detailedBreakdown.calculation.final_score}/100</span>
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <div className="flex justify-between items-center mb-2">
                <p className="text-amber-400 text-xs font-bold uppercase flex items-center gap-1.5">
                  <span className="text-sm">🎯</span> Missing Hybrid Key Points
                </p>
              </div>
              
              {editingId === r.id ? (
                <textarea
                  className="w-full bg-[var(--bg-dark)] border border-amber-500/30 rounded p-2 text-sm text-[var(--text-primary)] outline-none min-h-[100px]"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Enter one point per line..."
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-[var(--text-primary)] leading-relaxed space-y-1">
                  {Array.isArray(r.missing_points) && r.missing_points.length > 0 ? (
                    r.missing_points.map((pt, idx) => (
                      <li key={idx}>{pt}</li>
                    ))
                  ) : (
                    <li>{r.missing_points ? String(r.missing_points) : "None"}</li>
                  )}
                </ul>
              )}
            </div>
          </div>
          )
        })}
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
              onClick={handleApproveClick} 
              disabled={approving || summary.is_verified}
              className={`px-10 py-3 font-bold transition-all shadow-xl shadow-purple-500/10 min-w-[280px] transform hover:scale-105 active:scale-95 ${
                summary.is_verified 
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed shadow-none grayscale' 
                  : 'btn-primary bg-gradient-to-r from-purple-600 to-indigo-600'
              }`}
            >
              {approving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  Publishing...
                </span>
              ) : summary.is_verified ? 'Report Already Published' : 'Approve & Submit Report'}
            </button>
          </div>
        ) : (
          <button onClick={() => navigate('/setup')} className="btn-primary px-10 py-4 text-lg">
            Practice Again
          </button>
        )}
      </div>

      {/* Custom Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setShowConfirm(false)} />
          <div className="relative glass p-8 max-w-sm w-full text-center shadow-2xl border-[var(--border)] animate-scaleUp overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
            <h3 className="text-xl font-bold mb-2">Publish Report?</h3>
            <p className="text-[var(--text-muted)] text-sm mb-8 leading-relaxed">This will verify the session and make all scores and feedback visible to the student.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1 py-3 text-sm">Cancel</button>
              <button onClick={executeApproval} className="btn-primary flex-1 py-3 text-sm">Yes, Publish</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative glass p-10 max-w-sm w-full text-center shadow-2xl border-purple-500/50 border-2 animate-bounceIn">
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-purple-400">
               <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2">Verified!</h3>
            <p className="text-[var(--text-muted)] text-sm">The report has been published successfully.</p>
            <div className="mt-8 flex justify-center">
               <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 animate-[loadingBar_2s_linear_forwards]" />
               </div>
            </div>
            <p className="text-[10px] mt-2 text-purple-400 uppercase tracking-widest font-bold">Redirecting...</p>
          </div>
        </div>
      )}
    </div>
  )
}
