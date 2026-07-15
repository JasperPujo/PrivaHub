import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAppStore } from '@/store'
import { AnimatePresence, motion } from 'framer-motion'
import Layout from '@/components/Layout'
import ElectronTitleBar from '@/components/ElectronTitleBar'
import LockScreen from '@/components/LockScreen'
import Login from '@/pages/Login'
import Home from '@/pages/Home'
import Todo from '@/pages/Todo'
import Calendar from '@/pages/Calendar'
import Plan from '@/pages/Plan'
import Habit from '@/pages/Habit'
import Tracker from '@/pages/Tracker'
import Notes from '@/pages/Notes'
import RecycleBin from '@/pages/RecycleBin'
import Settings from '@/pages/Settings'
import About from '@/pages/About'
import Focus from '@/pages/Focus'
import HabitStats from '@/pages/HabitStats'
import TrackerStats from '@/pages/TrackerStats'
import FocusStats from '@/pages/FocusStats'
import Notification from '@/components/Notification'
import { supabase } from '@/lib/supabase'

const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 }
}

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.15
}

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        transition={pageTransition}
        className="w-full h-full"
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/todo" element={<Todo />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/habit" element={<Habit />} />
          <Route path="/tracker" element={<Tracker />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/recycle" element={<RecycleBin />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
          <Route path="/focus" element={<Focus />} />
          <Route path="/habit/stats" element={<HabitStats />} />
          <Route path="/tracker/stats" element={<TrackerStats />} />
          <Route path="/focus/stats" element={<FocusStats />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

function App() {
  const { isLoggedIn, lockScreen, theme, setUser } = useAppStore()
  const [checkingSession, setCheckingSession] = useState(true)

  const themeClass = theme === 'dark' ? 'dark' : ''

  // 自动登录：检查 Supabase session
  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()
        // 从 localStorage 读取备用头像
        const cachedAvatar = localStorage.getItem('user_avatar_' + session.user.id)
        if (userData) {
          setUser({
            id: userData.id,
            email: userData.email,
            name: userData.name,
            avatar: userData.avatar || cachedAvatar || null,
            role: userData.role || 'user',
            created_at: userData.created_at,
            updated_at: userData.updated_at,
          })
        } else {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || '',
            avatar: session.user.user_metadata?.avatar || cachedAvatar || null,
            role: 'user',
            created_at: session.user.created_at,
            updated_at: session.user.updated_at || session.user.created_at,
          })
        }
        // 自动登录成功后静默同步数据
        try {
          const { fullSync, taskToDb, taskFromDb, scheduleToDb, scheduleFromDb, planToDb, planFromDb, habitToDb, habitFromDb, noteToDb, noteFromDb, trackerCategoryToDb, trackerEntryToDb } = await import('@/lib/sync')
          const { useTodoStore, useScheduleStore, usePlanStore, useHabitStore, useNoteStore, useTrackerStore } = await import('@/store')
          await fullSync(session.user.id, {
            tasks: { table: 'tasks', getData: () => useTodoStore.getState().tasks, setData: (data) => useTodoStore.getState().setTasks(data), toDbRow: taskToDb, fromDbRow: taskFromDb },
            schedules: { table: 'schedules', getData: () => useScheduleStore.getState().schedules, setData: (data) => useScheduleStore.getState().setSchedules(data), toDbRow: scheduleToDb, fromDbRow: scheduleFromDb },
            plans: { table: 'plans', getData: () => usePlanStore.getState().plans, setData: (data) => usePlanStore.getState().setPlans(data), toDbRow: planToDb, fromDbRow: planFromDb },
            habits: { table: 'habits', getData: () => useHabitStore.getState().habits, setData: (data) => useHabitStore.getState().setHabits(data), toDbRow: habitToDb, fromDbRow: habitFromDb },
            notes: { table: 'notes', getData: () => useNoteStore.getState().notes, setData: (data) => useNoteStore.getState().setNotes(data), toDbRow: noteToDb, fromDbRow: noteFromDb },
            trackerCategories: { table: 'tracker_categories', getData: () => useTrackerStore.getState().categories, setData: (data) => useTrackerStore.getState().setCategories(data), toDbRow: trackerCategoryToDb },
            trackerEntries: { table: 'tracker_entries', getData: () => useTrackerStore.getState().entries, setData: (data) => useTrackerStore.getState().setEntries(data), toDbRow: trackerEntryToDb },
          })
        } catch (e) {
          console.warn('Auto sync on login skipped:', e)
        }
      }
      setCheckingSession(false)
    }
    initSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setUser(null)
    })
    return () => subscription.unsubscribe()
  }, [setUser])

  // 检查 session 期间显示加载态
  if (checkingSession) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center ${themeClass}`}>
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#6B4C9A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--text-secondary)]">正在检查登录状态...</p>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className={themeClass}>
        <ElectronTitleBar />
        <div className="pt-8">
          <Login />
        </div>
        <Notification />
      </div>
    )
  }

  return (
    <div className={`h-screen w-screen flex overflow-hidden ${themeClass}`}>
      <ElectronTitleBar />
      {lockScreen.isLocked && <LockScreen />}
      <Layout className="pt-8">
        <AnimatedRoutes />
      </Layout>
      <Notification />
    </div>
  )
}

export default App
