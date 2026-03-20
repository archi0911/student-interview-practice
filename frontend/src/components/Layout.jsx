import Sidebar from './Sidebar'
import { useSidebar } from '../context/SidebarContext'

export default function Layout({ children }) {
  const { isCollapsed } = useSidebar()
  
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className={`flex-1 transition-all duration-300 relative ${isCollapsed ? 'ml-[80px]' : 'ml-[260px]'}`}>
        <div className="relative z-10 w-full">
          {children}
        </div>
      </main>
    </div>
  )
}
