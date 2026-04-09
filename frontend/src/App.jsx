import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import SetupInterview from './pages/SetupInterview'
import PracticeSetup from './pages/PracticeSetup'
import InterviewSession from './pages/InterviewSession'
import Results from './pages/Results'
import History from './pages/History'
import AdminDashboard from './pages/AdminDashboard'
import AdminUserDetail from './pages/AdminUserDetail'
import FacultyDashboard from './pages/FacultyDashboard'
import FacultyUserDetail from './pages/FacultyUserDetail'

function ProtectedRoute({ children }) {
  const { user, loading, isAdmin, isFaculty } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (isAdmin) return <Navigate to="/admin" replace />
  if (isFaculty) return <Navigate to="/faculty" replace />
  return <Layout>{children}</Layout>
}

function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

function FacultyRoute({ children }) {
  const { user, loading, isFaculty } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (!isFaculty) return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="mesh-bg" />
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Student Routes */}
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/setup"    element={<ProtectedRoute><SetupInterview /></ProtectedRoute>} />
        <Route path="/practice" element={<ProtectedRoute><PracticeSetup /></ProtectedRoute>} />
        <Route path="/interview" element={<ProtectedRoute><InterviewSession /></ProtectedRoute>} />
        <Route path="/results"   element={<ProtectedRoute><Results /></ProtectedRoute>} />        <Route path="/history"   element={<ProtectedRoute><History /></ProtectedRoute>} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/users/:userId" element={<AdminRoute><AdminUserDetail /></AdminRoute>} />
        <Route path="/admin/results" element={<AdminRoute><Results /></AdminRoute>} />
        
        {/* Faculty Routes */}
        <Route path="/faculty" element={<FacultyRoute><FacultyDashboard /></FacultyRoute>} />
        <Route path="/faculty/users/:userId" element={<FacultyRoute><FacultyUserDetail /></FacultyRoute>} />
        <Route path="/faculty/results" element={<FacultyRoute><Results /></FacultyRoute>} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
