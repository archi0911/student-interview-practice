import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'

export default function FacultyDashboard() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [pendingSessions, setPendingSessions] = useState([])
  const [stats, setStats] = useState({ totalStudents: 0, totalInterviews: 0, pendingVerifications: 0, averageScore: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('students') // 'students' | 'pending'
  const [searchTerm, setSearchTerm] = useState('')

  // Filters for Pending Tab
  const [pendingFilters, setPendingFilters] = useState({
    student: '',
    date: ''
  })

  useEffect(() => {
    Promise.all([fetchUsers(), fetchStats(), fetchPendingSessions()])
      .finally(() => setLoading(false))
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users')
      setUsers(res.data.users)
    } catch (err) {
      setError(err.message)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/stats')
      setStats(res.data.stats)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  const fetchPendingSessions = async () => {
    try {
      const res = await api.get('/admin/sessions/pending')
      setPendingSessions(res.data.sessions)
    } catch (err) {
      console.error('Failed to fetch pending sessions:', err)
    }
  }

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredPending = pendingSessions.filter(s => {
    const matchStudent = s.student_name.toLowerCase().includes(pendingFilters.student.toLowerCase()) || 
                       s.student_email.toLowerCase().includes(pendingFilters.student.toLowerCase());
    
    const matchDate = !pendingFilters.date || s.created_at.startsWith(pendingFilters.date);
    
    return matchStudent && matchDate;
  })

  const handleReviewSession = (session) => {
    // We need to fetch responses for this session to use handleViewReport logic
    setLoading(true)
    api.get(`/admin/sessions/${session.id}`).then(res => {
      if (!res.data.session || !res.data.responses) {
        throw new Error('Could not find session data')
      }
      const summary = {
        id: session.id,
        is_verified: session.is_verified,
        overall_score: session.overall_score || 0,
        strengths: session.overall_strengths || [],
        weaknesses: session.overall_weaknesses || []
      }
      const results = res.data.responses.map(r => ({
        id: r.id,
        category: r.category || 'General',
        difficulty: r.difficulty || 'Medium',
        question_text: r.question_text,
        user_answer: r.user_answer || '(No answer provided)',
        score: r.score || 0,
        missing_points: r.missing_points || [],
        feedback: r.feedback || '',
        detailed_breakdown: r.detailed_breakdown || null
      }))
      navigate('/faculty/results', { state: { summary, results, mode: session.mode, context: session.context } })
    }).catch(err => {
      alert('Error loading session: ' + err.message)
    }).finally(() => setLoading(false))
  }

  if (loading) {
    return (
      <div className="page flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page pt-8">
        <div className="glass p-8 text-center text-red-400">
          <p className="text-xl font-semibold mb-2">Error loading dashboard</p>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page max-w-5xl mx-auto pt-8">
      <div className="animate-fadeInUp">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-block px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-medium mb-3">
              Faculty Access
            </div>
            <h1 className="text-3xl font-bold">Faculty Dashboard</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">Review and manage student performance</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass p-5">
            <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider font-bold mb-1">Total Students</div>
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
          </div>
          <div className="glass p-5">
            <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider font-bold mb-1">Total Interviews</div>
            <div className="text-2xl font-bold">{stats.totalInterviews}</div>
          </div>
          <button 
            onClick={() => setActiveTab('pending')}
            className={`glass p-5 border-l-2 transition-all text-left ${activeTab === 'pending' ? 'border-orange-500 bg-orange-500/5' : 'border-orange-500/50 hover:bg-orange-500/5'}`}
          >
            <div className="text-orange-400 text-[10px] uppercase tracking-wider font-bold mb-1">Pending Review</div>
            <div className="text-2xl font-bold">{stats.pendingVerifications}</div>
          </button>
          <div className="glass p-5 border-l-2 border-[var(--accent)]">
            <div className="text-[var(--accent-light)] text-[10px] uppercase tracking-wider font-bold mb-1">Avg Score</div>
            <div className="text-2xl font-bold">{stats.averageScore}%</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-black/20 rounded-xl w-fit border border-[var(--border)]">
          <button 
            onClick={() => setActiveTab('students')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'students' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-muted)] hover:text-white'}`}
          >
            Registered Students
          </button>
          <button 
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'pending' ? 'bg-orange-600 text-white shadow-lg' : 'text-[var(--text-muted)] hover:text-white'}`}
          >
            Pending Approvals
            {stats.pendingVerifications > 0 && (
               <span className="bg-white/20 px-1.5 py-0.5 rounded-md text-[10px]">{stats.pendingVerifications}</span>
            )}
          </button>
        </div>

        {/* Main Content Area */}
        <div className="glass overflow-hidden">
          
          {/* ────── REGISTERED STUDENTS VIEW ────── */}
          {activeTab === 'students' && (
            <>
              <div className="p-4 border-b border-[var(--border)] bg-black/20 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="font-semibold">Registered Students</h2>
                <input
                  type="text"
                  placeholder="Search students..."
                  className="input max-w-xs text-sm py-2"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-sm">
                      <th className="p-4 font-medium">Student</th>
                      <th className="p-4 font-medium">Joined</th>
                      <th className="p-4 font-medium text-center">Interviews</th>
                      <th className="p-4 font-medium text-center">Avg Score</th>
                      <th className="p-4 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan="5" className="p-8 text-center text-[var(--text-muted)]">No users found.</td></tr>
                    ) : (
                      filteredUsers.map(user => (
                        <tr key={user.id} className="border-b border-[var(--border)]/50 hover:bg-black/10 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--bg-card)] to-[var(--border)] flex items-center justify-center font-bold text-[var(--text-muted)] border border-[var(--border)] text-xs">
                                {user.full_name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div>
                                <div className="font-medium text-sm">{user.full_name}</div>
                                <div className="text-[10px] text-[var(--text-muted)]">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-xs text-[var(--text-muted)]">{new Date(user.created_at).toLocaleDateString()}</td>
                          <td className="p-4 text-center font-medium text-sm">{user.session_count}</td>
                          <td className="p-4 text-center">
                            {user.session_count > 0 ? (
                              <span className={`font-bold text-sm ${user.avg_score >= 70 ? 'text-green-400' : user.avg_score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {user.avg_score}%
                              </span>
                            ) : <span className="text-[var(--text-muted)]">-</span>}
                          </td>
                          <td className="p-4 text-right">
                            <Link to={`/faculty/users/${user.id}`} className="text-[var(--accent-light)] hover:text-white text-xs font-medium transition-colors">View details →</Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ────── PENDING APPROVALS VIEW ────── */}
          {activeTab === 'pending' && (
            <>
              <div className="p-4 border-b border-[var(--border)] bg-black/20">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <h2 className="font-semibold whitespace-nowrap">Interviews Waiting for Review</h2>
                  
                  <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    {/* Student Search */}
                    <input
                      type="text"
                      placeholder="Filter by student..."
                      className="input text-xs py-2 flex-1 lg:w-48"
                      value={pendingFilters.student}
                      onChange={(e) => setPendingFilters(prev => ({ ...prev, student: e.target.value }))}
                    />
                    
                    {/* Date Filter */}
                    <input
                      type="date"
                      className="input text-xs py-2 w-36 cursor-pointer"
                      value={pendingFilters.date}
                      onChange={(e) => setPendingFilters(prev => ({ ...prev, date: e.target.value }))}
                    />
                    
                    {(pendingFilters.student || pendingFilters.date) && (
                      <button 
                        onClick={() => setPendingFilters({ student: '', date: '' })}
                        className="text-[var(--text-muted)] hover:text-white text-[10px] font-bold uppercase"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-sm">
                      <th className="p-4 font-medium">Student</th>
                      <th className="p-4 font-medium">Date</th>
                      <th className="p-4 font-medium">Role/Topic</th>
                      <th className="p-4 font-medium text-center">Score</th>
                      <th className="p-4 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPending.length === 0 ? (
                      <tr><td colSpan="5" className="p-12 text-center">
                        <div className="text-3xl mb-3">🎉</div>
                        <p className="font-semibold text-[var(--text-primary)]">All Caught Up!</p>
                        <p className="text-sm text-[var(--text-muted)]">No pending interviews match your filters.</p>
                      </td></tr>
                    ) : (
                      filteredPending.map(session => (
                        <tr key={session.id} className="border-b border-[var(--border)]/50 hover:bg-black/10 transition-colors">
                          <td className="p-4">
                            <div className="font-medium text-sm">{session.student_name}</div>
                            <div className="text-[10px] text-[var(--text-muted)]">{session.student_email}</div>
                          </td>
                          <td className="p-4 text-xs text-[var(--text-muted)]">
                            {new Date(session.created_at).toLocaleDateString()}
                            <span className="block opacity-50">{new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="p-4">
                            <div className="text-sm font-medium w-full truncate max-w-[180px]" title={session.context}>
                              {session.context}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            {session.overall_score > 0 ? (
                              <span className={`font-bold text-sm ${session.overall_score >= 70 ? 'text-green-400' : session.overall_score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {session.overall_score}%
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)] text-xs italic">Not Scored</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                             <button
                               onClick={() => handleReviewSession(session)}
                               className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold py-2 px-4 rounded-lg transition-all"
                             >
                               {session.overall_score > 0 ? 'Review & Publish' : 'Analyze & Verify'}
                             </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
