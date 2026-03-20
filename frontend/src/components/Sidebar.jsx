import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useSidebar } from '../context/SidebarContext'
import logo from '../assets/logo.png'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { isCollapsed, toggleSidebar } = useSidebar()
  const location = useLocation()
  
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const navItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'History', path: '/history' },
  ]

  return (
    <aside className={`fixed left-0 top-0 h-full glass border-r border-[var(--border)] z-50 flex flex-col items-stretch transition-all duration-300 ${isCollapsed ? 'w-[80px]' : 'w-[260px]'}`}>
      {/* Brand - Toggles Sidebar */}
      <div 
        onClick={toggleSidebar}
        className={`p-6 flex items-center gap-3 cursor-pointer hover:bg-[var(--accent-glow)] transition-colors ${isCollapsed ? 'justify-center p-4' : ''}`}
        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        <img 
          src={logo} 
          alt="InterviewHub Logo" 
          className="w-10 h-10 object-contain drop-shadow-lg" 
        />
        {!isCollapsed && (
          <span className="font-bold text-xl tracking-tight text-[var(--text-primary)] animate-fadeIn">InterviewHub</span>
        )}
      </div>

      {/* Nav Links */}
      <nav className={`flex-1 px-4 py-6 space-y-2 ${isCollapsed ? 'px-2' : ''}`}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent-glow)]' 
                : 'text-[var(--text-muted)] hover:bg-[var(--accent-glow)] hover:text-[var(--text-primary)]'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
              title={isCollapsed ? item.label : ''}
            >
              {!isCollapsed && <span className="font-medium animate-fadeIn">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Actions */}
      <div className={`p-4 border-t border-[var(--border)] space-y-4 ${isCollapsed ? 'p-2' : ''}`}>
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`flex items-center gap-3 px-4 py-3 w-full rounded-xl text-[var(--text-muted)] hover:bg-[var(--accent-glow)] hover:text-[var(--text-primary)] transition-all ${isCollapsed ? 'justify-center px-0' : ''}`}
          title={isCollapsed ? `${theme === 'dark' ? 'Light' : 'Dark'} Mode` : ''}
        >
          <span className="text-xl">{theme === 'dark' ? '☀️' : '🌙'}</span>
          {!isCollapsed && <span className="font-medium animate-fadeIn">{theme === 'dark' ? 'Light' : 'Dark'} Mode</span>}
        </button>

        {/* Profile Section */}
        <div className={`p-4 rounded-2xl bg-[var(--bg-dark)] border border-[var(--border)] ${isCollapsed ? 'p-2' : ''}`}>
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center mb-0' : 'mb-4'}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] flex-shrink-0 flex items-center justify-center font-bold text-white text-sm shadow-md">
              {initials}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 animate-fadeIn">
                <p className="text-sm font-bold text-[var(--text-primary)] truncate">{name}</p>
                <p className="text-[10px] text-[var(--text-muted)] truncate">{user?.email}</p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={logout}
              className="w-full py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold transition-colors border border-red-500/20 animate-fadeIn"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
