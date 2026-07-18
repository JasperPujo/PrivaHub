import React, { useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppStore, useTodoStore, useScheduleStore, usePlanStore, useHabitStore, useNoteStore, useTrackerStore } from '@/store'
import { motion, AnimatePresence } from 'framer-motion'
import { useAutoSync } from '@/hooks/useAutoSync'
import { supabase } from '@/lib/supabase'
import { fullSync, noteWallToDb, noteWallFromDb, taskToDb, taskFromDb, scheduleToDb, scheduleFromDb, planToDb, planFromDb, habitToDb, habitFromDb, noteToDb, noteFromDb, trackerCategoryToDb, trackerEntryToDb } from '@/lib/sync'
import { Home, CheckSquare, Calendar, Target, TrendingUp, Activity, StickyNote,
  Trash2, Settings, ChevronLeft, ChevronRight,
  RefreshCw, LogOut, User, Zap
} from '@/utils/icons'
import appIcon from '@/assets/app-icon.png'

const iconMap: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Home, CheckSquare, Calendar, Target, TrendingUp, Activity, StickyNote,
  Trash2, Settings, Zap
}

interface LayoutProps {
  children: React.ReactNode
  className?: string
}

const Layout: React.FC<LayoutProps> = ({ children, className }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    modules,
    settings,
    sidebarCollapsed,
    toggleSidebar,
    logout,
    user,
    isSyncing,
    setSyncing,
    setLastSyncTime,
    addNotification,
    reorderModules,
    setUser
  } = useAppStore()
  const { lastSyncTimeRef } = useAutoSync()

  const [showUserMenu, setShowUserMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      addNotification({ message: '头像图片不能超过2MB', type: 'error' })
      return
    }
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      setUser({ ...user!, avatar: dataUrl })
      // 同时保存到 localStorage 作为可靠备份
      localStorage.setItem('user_avatar_' + user!.id, dataUrl)
      // 同步头像到 Supabase
      try {
          const { error } = await supabase
          .from('users')
          .update({ avatar: dataUrl, updated_at: new Date().toISOString() })
          .eq('id', user!.id)
        if (error) {
          console.error('头像同步失败:', error)
        } else {
          addNotification({ message: '头像已更新并同步', type: 'success' })
        }
      } catch (err) {
        console.error('头像同步异常:', err)
        addNotification({ message: '头像已更新（本地）', type: 'success' })
      }
    }
    reader.readAsDataURL(file)
  }

  // 拖拽排序状态
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const dragItemRef = useRef<number | null>(null)
  const navItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // 侧边栏导航顺序：首页固定最上，设置移到底部固定区，其余在中间
  const orderedVisibleModules = React.useMemo(() => {
    const visible = modules.filter(m => !settings.hiddenModules.includes(m.id) && m.id !== 'settings')
    const homeModule = visible.find(m => m.id === 'home')
    const middleModules = visible.filter(m => m.id !== 'home')
    const result: typeof visible = []
    if (homeModule) result.push(homeModule)
    result.push(...middleModules)
    return result
  }, [modules, settings.hiddenModules])

  const visibleModules = orderedVisibleModules

  const handleSync = async () => {
    if (!user) {
      addNotification({ message: '请先登录', type: 'warning' })
      return
    }
    setSyncing(true)
    try {
      const todoStore = useTodoStore.getState()
      const scheduleStore = useScheduleStore.getState()
      const planStore = usePlanStore.getState()
      const habitStore = useHabitStore.getState()
      const noteStore = useNoteStore.getState()
      const trackerStore = useTrackerStore.getState()


      // 手动同步：增量模式（带 since 参数）
      const results = await fullSync(user.id, {
        noteWalls: { table: 'note_walls', getData: () => noteStore.walls, setData: (data: any) => noteStore.setWalls(data), toDbRow: noteWallToDb, fromDbRow: noteWallFromDb },
        tasks: { table: 'tasks', getData: () => todoStore.tasks, setData: (data: any) => todoStore.setTasks(data), toDbRow: taskToDb, fromDbRow: taskFromDb },
        schedules: { table: 'schedules', getData: () => scheduleStore.schedules, setData: (data: any) => scheduleStore.setSchedules(data), toDbRow: scheduleToDb, fromDbRow: scheduleFromDb },
        plans: { table: 'plans', getData: () => planStore.plans, setData: (data: any) => planStore.setPlans(data), toDbRow: planToDb, fromDbRow: planFromDb },
        habits: { table: 'habits', getData: () => habitStore.habits, setData: (data: any) => habitStore.setHabits(data), toDbRow: habitToDb, fromDbRow: habitFromDb },
        notes: { table: 'notes', getData: () => noteStore.notes, setData: (data: any) => noteStore.setNotes(data), toDbRow: noteToDb, fromDbRow: noteFromDb },
        trackerCategories: { table: 'tracker_categories', getData: () => trackerStore.categories, setData: (data: any) => trackerStore.setCategories(data), toDbRow: trackerCategoryToDb },
        trackerEntries: { table: 'tracker_entries', getData: () => trackerStore.entries, setData: (data: any) => trackerStore.setEntries(data), toDbRow: trackerEntryToDb },
      }, { since: lastSyncTimeRef.current, parallel: true })

      // Collect failed table names and error details
      const failedTables: string[] = []
      for (const [key, result] of Object.entries(results)) {
        const r = result as any
        if (!r.push?.success || !r.pull?.success) {
          const tableName = r.table || key
          const errInfo = r.push?.error?.message || r.pull?.error?.message || 'unknown'
          failedTables.push(tableName + '(' + errInfo + ')')
          console.error('[Sync] Table "' + tableName + '" failed:', r.push?.error || r.pull?.error)
        }
      }

      if (failedTables.length > 0) {
        const failedStr = failedTables.join('; ')
        addNotification({ message: '部分数据同步失败: ' + failedStr, type: 'warning' })
      } else {
        addNotification({ message: '数据同步完成', type: 'success' })
      }
    } catch (err: any) {
      console.error('[Sync] Unhandled sync error:', err)
      addNotification({ message: '同步失败：' + (err.message || '未知错误'), type: 'error' })
    } finally {
      const now = new Date().toISOString()
      lastSyncTimeRef.current = now
      setSyncing(false)
    }
  }


  return (
    <div className={`flex h-full w-full ${className || ''}`}>
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 72 : 240 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="flex flex-col h-full bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex-shrink-0"
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-[var(--border-color)]">
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5"
            >
              <img src={appIcon} alt="PrivaHub" className="w-8 h-8 rounded-button" />
              <span className="font-semibold text-[var(--text-primary)] text-sm">PrivaHub</span>
            </motion.div>
          )}
          {sidebarCollapsed && (
            <img src={appIcon} alt="PrivaHub" className="w-8 h-8 rounded-button mx-auto" />
          )}
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {visibleModules.map((module, idx) => {
            const Icon = iconMap[module.icon]
            const isActive = location.pathname === module.path
            return (
              <button
                key={module.id}
                ref={(el) => { if (el) navItemRefs.current.set(module.id, el) }}
                draggable={module.id !== 'home' && module.id !== 'settings'}
                onDragStart={(e) => {
                  if (module.id === 'home' || module.id === 'settings') return
                  dragItemRef.current = idx
                  setDragIndex(idx)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', module.id)
                  // 延迟设置透明度，让拖拽镜像保持清晰
                  requestAnimationFrame(() => {
                    if (e.target instanceof HTMLElement) {
                      e.target.style.opacity = '0.4'
                    }
                  })
                }}
                onDragEnd={(e) => {
                  setDragIndex(null)
                  setDropIndex(null)
                  dragItemRef.current = null
                  if (e.target instanceof HTMLElement) {
                    e.target.style.opacity = '1'
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDropIndex(idx)
                }}
                onDragLeave={() => {
                  setDropIndex(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setDropIndex(null)
                  const fromIdx = dragItemRef.current
                  if (fromIdx === null || fromIdx === idx) return
                  // 计算新的模块顺序
                  const currentIds = visibleModules.map(m => m.id)
                  const newIds = [...currentIds]
                  const [moved] = newIds.splice(fromIdx, 1)
                  newIds.splice(idx, 0, moved)
                  // 保留隐藏模块在原位，只重排可见模块
                  const hiddenIds = modules.map(m => m.id).filter(id => !visibleModules.some(v => v.id === id))
                  reorderModules([...newIds, ...hiddenIds])
                }}
                onClick={() => navigate(module.path)}
                className={`sidebar-item w-full relative ${isActive ? 'active' : ''} ${sidebarCollapsed ? 'justify-center' : ''} ${dragIndex === idx ? 'opacity-40' : ''}`}
              >
                {/* 拖拽目标指示线 */}
                {dropIndex === idx && dragIndex !== idx && dragIndex !== null && (
                  <div
                    className={`absolute left-0 right-0 h-0.5 bg-primary-600 rounded-full z-10 ${
                      dragIndex !== null && dragIndex < idx ? 'top-[-4px]' : 'bottom-[-4px]'
                    }`}
                    style={{ top: dragIndex !== null && dragIndex < idx ? '-2px' : undefined, bottom: dragIndex !== null && dragIndex >= idx ? '-2px' : undefined }}
                  />
                )}
                {Icon && <Icon size={20} />}
                {!sidebarCollapsed && <span className="text-sm font-medium">{module.title}</span>}
              </button>
            )
          })}
        </nav>

        {/* 底部操作区 */}
        <div className="p-2 border-t border-[var(--border-color)] space-y-1">
          <button
            onClick={() => navigate('/settings')}
            className={`sidebar-item w-full ${sidebarCollapsed ? 'justify-center' : ''} ${location.pathname === '/settings' ? 'active' : ''}`}
          >
            <Settings size={20} />
            {!sidebarCollapsed && <span className="text-sm">设置</span>}
          </button>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`sidebar-item w-full ${sidebarCollapsed ? 'justify-center' : ''} ${isSyncing ? 'opacity-50' : ''}`}
          >
            <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
            {!sidebarCollapsed && <span className="text-sm">{isSyncing ? '同步中...' : '手动同步'}</span>}
          </button>

          <button
            onClick={toggleSidebar}
            className={`sidebar-item w-full ${sidebarCollapsed ? 'justify-center' : ''}`}
          >
            {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            {!sidebarCollapsed && <span className="text-sm">收起侧边栏</span>}
          </button>
        </div>
      </motion.aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部栏 */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex-shrink-0">
          <h1 className="text-lg font-medium text-[var(--text-primary)]">
            {visibleModules.find(m => m.path === location.pathname)?.title || '主页'}
          </h1>

          <div className="flex items-center gap-3">
            {/* 用户菜单 */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-button hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-600/10 flex items-center justify-center">
                    <User size={16} className="text-primary-600" />
                  </div>
                )}
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {user?.name || user?.username || '用户'}
                </span>
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-secondary)] rounded-card shadow-soft-lg border border-[var(--border-color)] z-40 py-1"
                  >
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        fileInputRef.current?.click()
                      }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <User size={16} />
                      更换头像
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        navigate('/settings')
                      }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <Settings size={16} />
                      设置
                    </button>
                    <div className="border-t border-[var(--border-color)] my-1" />
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        logout()
                      }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-danger hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    >
                      <LogOut size={16} />
                      退出登录
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 overflow-auto bg-[var(--bg-primary)]">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout
