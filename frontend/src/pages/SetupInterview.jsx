import { useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api'

const ROLES = [
  { id: 'Software Developer',  icon: '💻', color: 'from-violet-500 to-purple-600' },
  { id: 'Frontend Developer',  icon: '🎨', color: 'from-pink-500 to-rose-500' },
  { id: 'Backend Developer',   icon: '⚙️', color: 'from-blue-500 to-indigo-600' },
  { id: 'Data Analyst',        icon: '📊', color: 'from-emerald-500 to-teal-500' },
  { id: 'Full Stack Developer',icon: '🌐', color: 'from-orange-500 to-amber-500' },
  { id: 'DevOps Engineer',     icon: '🚀', color: 'from-cyan-500 to-blue-500' },
]

const TOPICS = [
  'HTML', 'CSS', 'JavaScript', 'React', 'Node.js',
  'Python', 'Java', 'SQL', 'Data Structures', 'Algorithms',
  'System Design', 'DBMS', 'Operating Systems', 'Computer Networks', 'Git'
]

const CATEGORIES = ['Technical', 'HR', 'Behavioral', 'Aptitude']

export default function SetupInterview() {
  const { state }  = useLocation()
  const navigate   = useNavigate()
  const mode       = state?.mode || 'topic'

  const [selectedRole,     setSelectedRole]     = useState(null)
  const [selectedTopic,    setSelectedTopic]    = useState(null)
  const [selectedCategory] = useState('Technical')
  const [resumeFile,       setResumeFile]       = useState(null)
  const [parsedResume,     setParsedResume]     = useState(null)
  const [questionCount]    = useState(10)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const fileRef = useRef()

  const handleFileChange = (e) => {
    const f = e.target.files[0]
    if (f) { setResumeFile(f); setParsedResume(null) }
  }
  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) { setResumeFile(f); setParsedResume(null) }
  }

  const handleParseResume = async () => {
    if (!resumeFile) return
    setLoading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('resume', resumeFile)
      const res = await api.post('/resume/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setParsedResume(res.data.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const canStart = () => {
    if (mode === 'resume') return !!parsedResume
    if (mode === 'role')  return !!selectedRole
    if (mode === 'topic') return !!selectedTopic
    return false
  }

  const handleStart = () => {
    let context = ''
    if (mode === 'resume') context = parsedResume.skills // Pass the full array
    if (mode === 'role')   context = selectedRole
    if (mode === 'topic')  context = selectedTopic
    navigate('/interview', {
      state: { mode, context, category: selectedCategory, questionCount, parsedResume },
    })
  }

  const modeTitle = { resume: 'Resume Upload', role: 'Job Role', topic: 'Topic / Skill' }[mode]

  return (
    <div className="page max-w-3xl mx-auto">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-[var(--text-muted)] hover:text-white mb-8 transition-colors text-sm">
        ← Back to Dashboard
      </button>

      <div className="animate-fadeInUp">
        <h1 className="text-3xl font-bold mb-1">Set Up Your Interview</h1>
        <p className="text-[var(--text-muted)] mb-8">Mode: <span className="text-[var(--accent-light)] font-medium">{modeTitle}</span></p>

        {/* ── Resume Mode ────────────────────────────────────────────── */}
        {mode === 'resume' && (
          <div className="glass p-6 mb-6">
            <h2 className="font-semibold mb-4">📄 Upload Your Resume</h2>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] rounded-xl p-10 text-center cursor-pointer transition-colors"
            >
              <div className="text-4xl mb-3">☁️</div>
              <p className="text-[var(--text-muted)] text-sm">
                {resumeFile ? `✅ ${resumeFile.name}` : 'Drag & drop your PDF or DOCX, or click to browse'}
              </p>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileChange} />
            </div>
            {resumeFile && !parsedResume && (
              <button onClick={handleParseResume} className="btn-primary mt-4 w-full" disabled={loading}>
                {loading ? <span className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" /> : '✨ Extract Skills from Resume'}
              </button>
            )}
            {parsedResume && (
              <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-emerald-400 font-medium mb-2">✅ Resume Parsed Successfully</p>
                {parsedResume.name && <p className="text-sm text-[var(--text-muted)]">Name: <span className="text-white">{parsedResume.name}</span></p>}
                <p className="text-sm text-[var(--text-muted)] mt-1">Skills: <span className="text-white">{parsedResume.skills?.join(', ')}</span></p>
              </div>
            )}
          </div>
        )}

        {/* ── Role Mode ──────────────────────────────────────────────── */}
        {mode === 'role' && (
          <div className="glass p-6 mb-6">
            <h2 className="font-semibold mb-4">💼 Select a Job Role</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRole(r.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedRole === r.id
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[var(--border)] hover:border-[var(--accent)]/50 bg-white/5'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${r.color} flex items-center justify-center text-lg mb-2`}>{r.icon}</div>
                  <p className="text-sm font-medium">{r.id}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Topic Mode ─────────────────────────────────────────────── */}
        {mode === 'topic' && (
          <div className="glass p-6 mb-6">
            <h2 className="font-semibold mb-4">📚 Select a Topic</h2>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTopic(t)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    selectedTopic === t
                      ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent-light)]'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Category + Count ───────────────────────────────────────── */}
        <div className="glass p-6 mb-6">
          <h2 className="font-semibold mb-4">⚙️ Interview Mode</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-[var(--text-muted)] mb-2 block">Question Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <span
                    key={c}
                    className="px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] text-[var(--text-muted)] opacity-70 cursor-not-allowed"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-[var(--text-muted)] mb-2 block">
                Number of Questions: <span className="text-white font-semibold">10</span>
              </label>
              <p className="text-sm text-[var(--text-muted)] mt-4 leading-relaxed">
                A simulated interview session where students answer questions from multiple categories to experience a real interview environment.
              </p>
            </div>
          </div>
        </div>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

        <button onClick={handleStart} className="btn-primary w-full text-base py-4" disabled={!canStart()}>
          🚀 Start Interview Session
        </button>
      </div>
    </div>
  )
}
