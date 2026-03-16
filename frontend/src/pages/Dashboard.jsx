import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const MODES = [
  {
    id: 'resume',
    icon: '📄',
    title: 'Resume-Based',
    description: 'Upload your resume and get questions tailored to your skills and experience.',
    color: 'from-violet-500 to-purple-600',
    glow: 'rgba(139,92,246,0.3)',
  },
  {
    id: 'role',
    icon: '💼',
    title: 'Job Role',
    description: 'Practice for a specific role like Software Developer, Data Analyst, or Frontend Dev.',
    color: 'from-blue-500 to-cyan-500',
    glow: 'rgba(59,130,246,0.3)',
  },
  {
    id: 'topic',
    icon: '📚',
    title: 'Topic / Skill',
    description: 'Deep-dive into a specific topic: Python, DSA, SQL, JavaScript, and more.',
    color: 'from-emerald-500 to-teal-500',
    glow: 'rgba(16,185,129,0.3)',
  },
]

const STATS = [
  { label: 'Questions Generated', value: '∞', icon: '🤖' },
  { label: 'Question Types',      value: '4',  icon: '🧩' },
  { label: 'Voice-Powered',       value: 'Yes', icon: '🎙️' },
  { label: 'AI Feedback',         value: 'Live', icon: '⚡' },
]

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there'

  return (
    <div className="page max-w-5xl mx-auto">

      {/* Nav */}
      <nav className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] flex items-center justify-center text-lg">🎯</div>
          <span className="font-bold text-lg">InterviewHub</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/history" className="btn-secondary text-sm px-4 py-2">📊 History</Link>
          <button onClick={logout} className="btn-secondary text-sm px-4 py-2">Sign Out</button>
        </div>
      </nav>

      {/* Hero */}
      <div className="text-center mb-12 animate-fadeInUp">
        <div className="inline-block px-4 py-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent-light)] text-sm font-medium mb-4">
          AI-Powered Interview Practice
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-3">
          Hello, <span className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-light)] bg-clip-text text-transparent">{name}!</span>
        </h1>
        <p className="text-[var(--text-muted)] text-lg max-w-xl mx-auto">
          Choose how you'd like to practice today. The AI will generate real interview questions just for you.
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10 animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
        {STATS.map((s) => (
          <div key={s.label} className="glass p-4 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-[var(--text-muted)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Mode cards */}
      <div className="grid md:grid-cols-3 gap-5">
        {MODES.map((mode, i) => (
          <button
            key={mode.id}
            onClick={() => navigate('/setup', { state: { mode: mode.id } })}
            className="glass glass-hover p-6 text-left w-full animate-fadeInUp"
            style={{ animationDelay: `${0.15 + i * 0.08}s` }}
          >
            <div
              className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${mode.color} flex items-center justify-center text-2xl mb-4 shadow-lg`}
              style={{ boxShadow: `0 4px 20px ${mode.glow}` }}
            >
              {mode.icon}
            </div>
            <h3 className="text-lg font-semibold mb-2">{mode.title}</h3>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed">{mode.description}</p>
            <div className="mt-4 flex items-center gap-2 text-[var(--accent-light)] text-sm font-medium">
              Start Practice <span>→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
