import { useEffect } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { Lightbulb, PenLine, FileText, Flame, Settings, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app'
import { Toaster } from '@/components/ui/sonner'
import TopicsPage from '@/pages/TopicsPage'
import ComposePage from '@/pages/ComposePage'
import DraftsPage from '@/pages/DraftsPage'
import ViralPage from '@/pages/ViralPage'
import SettingsPage from '@/pages/SettingsPage'

const NAV = [
  { to: '/', label: '选题', icon: Lightbulb, end: true },
  { to: '/compose', label: '创作', icon: PenLine, end: false },
  { to: '/drafts', label: '草稿库', icon: FileText, end: false },
  { to: '/viral', label: '爆款库', icon: Flame, end: false },
  { to: '/settings', label: '设置', icon: Settings, end: false }
]

function Sidebar(): React.JSX.Element {
  return (
    <aside className="flex w-56 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-5 pb-4 pt-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">小红书内容工厂</div>
          <div className="text-xs text-muted-foreground">选题 · 创作</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-sidebar-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 text-xs text-muted-foreground">本地数据 · 仅自己可见</div>
    </aside>
  )
}

function App(): React.JSX.Element {
  const loadPersonas = useAppStore((s) => s.loadPersonas)

  useEffect(() => {
    void loadPersonas()
  }, [loadPersonas])

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<TopicsPage />} />
          <Route path="/compose" element={<ComposePage />} />
          <Route path="/compose/:topicId" element={<ComposePage />} />
          <Route path="/drafts" element={<DraftsPage />} />
          <Route path="/viral" element={<ViralPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <Toaster />
    </div>
  )
}

export default App
