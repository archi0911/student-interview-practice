import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const FEATURES = [
  { icon: '🎯', text: 'Targeted Questions' },
  { icon: '🧠', text: 'Deep Concept Analysis' },
  { icon: '🎙️', text: 'Voice-Powered' },
  { icon: '📊', text: 'Rich Detailed Reports' },
  { icon: '⚡', text: 'Instant AI Feedback' },
  { icon: '🔒', text: 'Secure & Private' },
  { icon: '📈', text: 'Track Your Progress' },
  { icon: '🤖', text: 'Powered by Gemini AI' },
]

export default function Dashboard() {
  const { user, isAdmin, isFaculty } = useAuth()
  const navigate = useNavigate()
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there'

  return (
    <div className="page max-w-5xl mx-auto relative">
      {(!isAdmin && !isFaculty) && (
        <div className="absolute top-6 right-6 z-20">
          <span className="px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-500/10">
            Student Portal
          </span>
        </div>
      )}

      {/* Hero */}
      <div className="text-center pt-8 mb-12 animate-fadeInUp">
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

      {/* Marquee ticker */}
      <div className="relative mb-10 overflow-hidden" style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}>
        <div className="flex gap-4 animate-marquee whitespace-nowrap w-max">
          {[...FEATURES, ...FEATURES].map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-sm font-medium text-[var(--text-muted)] shrink-0"
            >
              <span>{f.icon}</span> {f.text}
            </span>
          ))}
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="grid md:grid-cols-2 gap-6 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>

        {/* Start Interview */}
        <button
          onClick={() => navigate('/setup', { state: { mode: 'resume' } })}
          className="glass glass-hover p-8 text-left w-full group"
        >
          <div
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-3xl mb-5 shadow-lg transition-transform group-hover:scale-110"
            style={{ boxShadow: 'rgba(139,92,246,0.35) 0px 4px 24px' }}
          >
            📄
          </div>
          <h2 className="text-2xl font-bold mb-2">Start Interview</h2>
          <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-5">
            Upload your resume and receive a fully personalized interview session tailored to your skills and experience.
          </p>
          <div className="flex items-center gap-2 text-[var(--accent-light)] font-semibold">
            Begin Now <span className="transition-transform group-hover:translate-x-1">→</span>
          </div>
        </button>

        {/* Practice Interview */}
        <button
          onClick={() => navigate('/practice')}
          className="glass glass-hover p-8 text-left w-full group"
        >
          <div
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-3xl mb-5 shadow-lg transition-transform group-hover:scale-110"
            style={{ boxShadow: 'rgba(249,115,22,0.35) 0px 4px 24px' }}
          >
            🎯
          </div>
          <h2 className="text-2xl font-bold mb-2">Practice Interview</h2>
          <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-5">
            Choose a specific job role or topic/skill to focus your practice session on what matters most.
          </p>
          <div className="flex items-center gap-2 text-[var(--accent-light)] font-semibold">
            Choose Mode <span className="transition-transform group-hover:translate-x-1">→</span>
          </div>
        </button>

      </div>
    </div>
  )
}
