import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm]   = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    try {
      await register(form.email, form.password, form.name)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const field = (label, key, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">{label}</label>
      <input
        type={type}
        className="input"
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        required
      />
    </div>
  )

  return (
    <div className="page flex items-center justify-center">
      <div className="w-full max-w-md animate-fadeInUp">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] mb-4 shadow-lg animate-pulse-glow">
            <span className="text-2xl">🎯</span>
          </div>
          <h1 className="text-3xl font-bold text-white">InterviewHub</h1>
          <p className="text-[var(--text-muted)] mt-1">Start your practice journey today</p>
        </div>

        <div className="glass p-8">
          <h2 className="text-xl font-semibold mb-6">Create account</h2>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {field('Full Name', 'name', 'text', 'John Doe')}
            {field('Email', 'email', 'email', 'you@example.com')}
            {field('Password', 'password', 'password', '••••••••')}
            {field('Confirm Password', 'confirm', 'password', '••••••••')}
            <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
              {loading
                ? <span className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-[var(--text-muted)] text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-[var(--accent-light)] hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
