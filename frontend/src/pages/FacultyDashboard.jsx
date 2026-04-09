import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function FacultyDashboard() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users')
      setUsers(res.data.users)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const stats = {
    totalUsers: users.length,
    totalSessions: users.reduce((acc, u) => acc + u.session_count, 0),
    avgScore: users.length ? Math.round(users.reduce((acc, u) => acc + u.avg_score, 0) / users.length) : 0
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="glass p-6">
            <div className="text-[var(--text-muted)] text-sm mb-1">Total Users</div>
            <div className="text-3xl font-bold">{stats.totalUsers}</div>
          </div>
          <div className="glass p-6">
            <div className="text-[var(--text-muted)] text-sm mb-1">Total Interviews</div>
            <div className="text-3xl font-bold">{stats.totalSessions}</div>
          </div>
          <div className="glass p-6">
            <div className="text-[var(--text-muted)] text-sm mb-1">Platform Avg Score</div>
            <div className="text-3xl font-bold text-[var(--accent-light)]">{stats.avgScore}%</div>
          </div>
        </div>

        {/* Users List */}
        <div className="glass overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] bg-black/20 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="font-semibold">Registered Users</h2>
            <input
              type="text"
              placeholder="Search by name or email..."
              className="input max-w-xs text-sm py-2"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-sm">
                  <th className="p-4 font-medium">User</th>
                  <th className="p-4 font-medium">Joined</th>
                  <th className="p-4 font-medium">Role</th>
                  <th className="p-4 font-medium text-center">Interviews</th>
                  <th className="p-4 font-medium text-center">Avg Score</th>
                  <th className="p-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-[var(--text-muted)]">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr key={user.id} className="border-b border-[var(--border)]/50 hover:bg-black/10 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--bg-card)] to-[var(--border)] flex items-center justify-center font-bold text-[var(--text-muted)] border border-[var(--border)] shrink-0">
                            {user.full_name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <div className="font-medium">{user.full_name}</div>
                            <div className="text-xs text-[var(--text-muted)]">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-[var(--text-muted)]">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        {user.role === 'admin' ? (
                          <span className="badge bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs">Admin</span>
                        ) : user.role === 'faculty' ? (
                          <span className="badge bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs">Faculty</span>
                        ) : (
                          <span className="badge bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-muted)]">Student</span>
                        )}
                      </td>
                      <td className="p-4 text-center font-medium">
                        {user.session_count}
                      </td>
                      <td className="p-4 text-center">
                        {user.session_count > 0 ? (
                          <span className={`font-bold ${user.avg_score >= 70 ? 'text-green-400' : user.avg_score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {user.avg_score}%
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">-</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <Link to={`/faculty/users/${user.id}`} className="text-[var(--accent-light)] hover:text-white text-sm font-medium transition-colors">
                          View details →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
