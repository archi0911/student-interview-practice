import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const PRACTICE_OPTIONS = [
  {
    id: 'role',
    icon: '💼',
    title: 'Job Role',
    description: 'Practice for a specific role like Frontend, Backend, AI/ML, or Data Analyst.',
    color: 'from-blue-500 to-cyan-500',
    glow: 'rgba(59,130,246,0.35)',
  },
  {
    id: 'topic',
    icon: '📚',
    title: 'Topic / Skill',
    description: 'Deep-dive into a specific topic: Python, DSA, SQL, JavaScript, and more.',
    color: 'from-emerald-500 to-teal-500',
    glow: 'rgba(16,185,129,0.35)',
  },
]

export default function PracticeSetup() {
  const { isAdmin, isFaculty } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="page max-w-4xl mx-auto pt-8">
      <div className="animate-fadeInUp">

        {/* Header */}
        <div className="mb-10">
          <button
            onClick={() => navigate('/')}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-sm flex items-center gap-1 mb-6"
          >
            ← Back
          </button>
          {(!isAdmin && !isFaculty) && (
            <div className="inline-block px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-medium mb-3">
              Student Portal
            </div>
          )}
          <div className="inline-block px-4 py-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent-light)] text-sm font-medium mb-4 ml-2">
            Practice Mode
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Practice Interview</h1>
          <p className="text-[var(--text-muted)] text-lg max-w-xl">
            Choose a mode to focus your practice session on what matters most to you.
          </p>
        </div>

        {/* Option Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {PRACTICE_OPTIONS.map((opt, i) => (
            <button
              key={opt.id}
              onClick={() => navigate('/setup', { state: { mode: opt.id } })}
              className="glass glass-hover p-8 text-left w-full group animate-fadeInUp"
              style={{ animationDelay: `${0.1 + i * 0.1}s` }}
            >
              <div
                className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${opt.color} flex items-center justify-center text-3xl mb-6 shadow-lg transition-transform group-hover:scale-110`}
                style={{ boxShadow: `${opt.glow} 0px 4px 24px` }}
              >
                {opt.icon}
              </div>
              <h2 className="text-2xl font-bold mb-3">{opt.title}</h2>
              <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-6">
                {opt.description}
              </p>
              <div className="flex items-center gap-2 text-[var(--accent-light)] font-semibold">
                Select <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
