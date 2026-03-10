import { useLocation, useNavigate, Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'

export default function Results() {
  const { state } = useLocation()
  const navigate  = useNavigate()
  const results   = state?.results || []

  if (results.length === 0) {
    return (
      <div className="page flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold mb-4">No results found</h1>
        <Link to="/" className="btn-primary">Return Home</Link>
      </div>
    )
  }

  const avgScore = Math.round(results.reduce((acc, r) => acc + r.evaluation.score, 0) / results.length)
  const avgCorrectness = Math.round(results.reduce((acc, r) => acc + r.evaluation.correctness_pct, 0) / results.length)

  const chartData = [
    { name: 'Score', value: avgScore, color: '#6c63ff' },
    { name: 'Correctness', value: avgCorrectness, color: '#10b981' },
  ]

  return (
    <div className="page max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Interview Analysis</h1>
        <div className="flex gap-3">
          <Link to="/" className="btn-secondary text-sm">Dashboard</Link>
          <button onClick={() => window.print()} className="btn-secondary text-sm">🖨️ Print Report</button>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-6 mb-10 animate-fadeInUp">
        <div className="glass p-6 text-center flex flex-col items-center justify-center">
          <p className="text-[var(--text-muted)] text-sm mb-2 font-medium">Overall Score</p>
          <div className="relative w-32 h-32 mb-2">
            <svg className="w-full h-full score-ring">
              <circle className="score-ring-track" cx="64" cy="64" r="58" strokeWidth="8" />
              <circle
                className="score-ring-fill" cx="64" cy="64" r="58" strokeWidth="8"
                strokeDasharray="364.4"
                strokeDashoffset={364.4 - (364.4 * avgScore) / 100}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold">{avgScore}%</span>
            </div>
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--accent-light)" />
              </linearGradient>
            </defs>
          </div>
          <p className="text-xs text-[var(--text-muted)]">Based on {results.length} questions</p>
        </div>

        <div className="glass p-6 flex flex-col justify-center gap-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[var(--text-muted)] text-xs font-medium uppercase mb-1">Correctness</p>
              <p className="text-2xl font-bold text-[var(--success)]">{avgCorrectness}%</p>
            </div>
            <div className="w-20 h-1 rounded-full bg-white/10 overflow-hidden">
               <div className="h-full bg-[var(--success)]" style={{ width: `${avgCorrectness}%` }} />
            </div>
          </div>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[var(--text-muted)] text-xs font-medium uppercase mb-1">Confidence</p>
              <p className="text-2xl font-bold text-[var(--accent-light)]">High</p>
            </div>
            <div className="w-20 h-1 rounded-full bg-white/10 overflow-hidden">
               <div className="h-full bg-[var(--accent-light)]" style={{ width: `85%` }} />
            </div>
          </div>
        </div>

        <div className="glass p-6">
          <p className="text-sm font-semibold mb-4 text-[var(--text-muted)]">Performance Metrics</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
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
      </div>

      {/* ── Question Breakdown ────────────────────────────────────── */}
      <h2 className="text-xl font-bold mb-6">Step-by-Step Breakdown</h2>
      <div className="space-y-6">
        {results.map((r, i) => (
          <div key={i} className="glass p-6 animate-fadeInUp" style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 border border-[var(--border)] flex items-center justify-center font-bold text-sm">{i + 1}</span>
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
              <p className="text-white leading-relaxed">{r.question}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10">
                <p className="text-[var(--success)] text-xs font-bold uppercase mb-2 flex items-center gap-1.5">
                  <span className="text-sm">✅</span> Strengths
                </p>
                <p className="text-sm text-white/90 leading-relaxed">{r.evaluation.strengths}</p>
              </div>
              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                <p className="text-[var(--danger)] text-xs font-bold uppercase mb-2 flex items-center gap-1.5">
                  <span className="text-sm">⚠️</span> Improvement Areas
                </p>
                <p className="text-sm text-white/90 leading-relaxed">{r.evaluation.weaknesses}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-[var(--border)]">
              <p className="text-[var(--text-muted)] text-xs font-bold uppercase mb-2 flex items-center gap-1.5">
                <span className="text-sm">💡</span> AI Coaching Feedback
              </p>
              <p className="text-sm text-white/90 leading-relaxed">{r.evaluation.feedback}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <button onClick={() => navigate('/setup')} className="btn-primary px-10 py-4 text-lg">
          Practice Again
        </button>
      </div>
    </div>
  )
}
