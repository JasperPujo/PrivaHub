import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User, UserSettings, Task, Schedule, Habit, Plan, NoteWall, Note, Tag, ModuleConfig, LockScreenState, TrackerCategory, TrackerEntry } from '@/types'

// 删除时立即同步 deleted_at 到 Supabase，防止下次 pull 复活
function immediateSyncDelete(table: string, id: string, userId: string | null) {
  if (!userId) return
  import('@/lib/supabase').then(({ supabase }) => {
    supabase.from(table).update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', userId)
      .then(({ error }) => {
        if (error) console.warn(`[Store] Failed to immediate sync delete for ${table}/${id}:`, error.message)
      })
  })
}

const APP_VERSION = '1.2.0'

// 模块配置
const defaultModules: ModuleConfig[] = [
  { id: 'home', name: 'home', title: '主页', icon: 'Home', path: '/', isVisible: true },
  { id: 'todo', name: 'todo', title: '任务待办', icon: 'CheckSquare', path: '/todo', isVisible: true },
  { id: 'calendar', name: 'calendar', title: '日历日程', icon: 'Calendar', path: '/calendar', isVisible: true },
  { id: 'plan', name: 'plan', title: '宏观规划', icon: 'Target', path: '/plan', isVisible: true },
  { id: 'habit', name: 'habit', title: '习惯记录', icon: 'TrendingUp', path: '/habit', isVisible: true },
  { id: 'tracker', name: 'tracker', title: '实时记录', icon: 'Activity', path: '/tracker', isVisible: true },
  { id: 'notes', name: 'notes', title: '随心贴', icon: 'StickyNote', path: '/notes', isVisible: true },
  { id: 'focus', name: 'focus', title: 'Priva专注', icon: 'Zap', path: '/focus', isVisible: true },
  { id: 'recycle', name: 'recycle', title: '回收站', icon: 'Trash2', path: '/recycle', isVisible: true },
  { id: 'settings', name: 'settings', title: '设置', icon: 'Settings', path: '/settings', isVisible: true },
]

const defaultSettings: UserSettings = {
  theme: 'light',
  autoLogin: false,
  rememberPassword: false,
  lockScreenEnabled: false,
  soundEnabled: false,
  scheduleReminderEnabled: false,
  autoLockEnabled: false,
  autoLockTimeout: 15,
  defaultHomePage: 'home',
  hiddenModules: [],
  moduleOrder: defaultModules.map(m => m.id),
  homeShortcuts: ['todo', 'calendar', 'plan', 'notes']
}

// 全局应用状态
interface AppState {
  // 主题
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void

  // 用户
  user: User | null
  isLoggedIn: boolean
  setUser: (user: User | null) => void
  logout: () => void

  // 设置
  settings: UserSettings
  updateSettings: (settings: Partial<UserSettings>) => void

  // 模块
  modules: ModuleConfig[]
  setModules: (modules: ModuleConfig[]) => void
  toggleModuleVisibility: (moduleId: string) => void
  reorderModules: (newOrder: string[]) => void

  // 锁屏
  lockScreen: LockScreenState
  setLockScreen: (state: Partial<LockScreenState>) => void
  lockApp: () => void
  unlockApp: (password: string) => boolean

  // 通知
  notifications: { id: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }[]
  addNotification: (notification: Omit<{ id: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }, 'id'>) => void
  removeNotification: (id: string) => void

  // 同步
  lastSyncTime: string | null
  isSyncing: boolean
  setSyncing: (syncing: boolean) => void
  setLastSyncTime: (time: string) => void

  // 侧边栏
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 主题
      theme: 'light',
      setTheme: (theme) => {
        set({ theme })
        if (theme === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      },
      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light'
        get().setTheme(newTheme)
      },

      // 用户
      user: null,
      isLoggedIn: false,
      setUser: (user) => set({ user, isLoggedIn: !!user }),
      logout: async () => {
        const state = get()
        // 如果开启了自动登录，保留 Supabase session，仅清除本地状态
        if (!state.settings.autoLogin) {
          const { supabase } = await import('@/lib/supabase')
          await supabase.auth.signOut()
        }
        set({ user: null, isLoggedIn: false })
        // 清除本地登录缓存
        localStorage.removeItem('auth_token')
      },

      // 设置
      settings: defaultSettings,
      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        }))
        // 异步保存到 Supabase
        const user = get().user
        if (user?.id) {
          import('@/lib/supabase').then(({ supabase }) => {
            const settings = get().settings
            supabase.from('users').update({ settings }).eq('id', user.id).then(({ error }) => {
              if (error) console.warn('[Store] Failed to save settings:', error.message)
            })
          })
        }
      },

      // 模块
      modules: defaultModules,
      setModules: (modules) => set({ modules }),
      toggleModuleVisibility: (moduleId) => {
        set((state) => {
          const hidden = state.settings.hiddenModules.includes(moduleId)
            ? state.settings.hiddenModules.filter(id => id !== moduleId)
            : [...state.settings.hiddenModules, moduleId]
          return {
            settings: { ...state.settings, hiddenModules: hidden }
          }
        })
      },
      reorderModules: (newOrder) => {
        set((state) => {
          const reordered = newOrder.map(id => state.modules.find(m => m.id === id)!).filter(Boolean)
          return {
            modules: reordered,
            settings: { ...state.settings, moduleOrder: newOrder }
          }
        })
      },

      // 锁屏
      lockScreen: {
        isLocked: false,
        passwordHash: '',
        failedAttempts: 0,
        lockUntil: null
      },
      setLockScreen: (state) => {
        set((prev) => ({
          lockScreen: { ...prev.lockScreen, ...state }
        }))
      },
      lockApp: () => {
        const { lockScreen } = get()
        if (lockScreen.passwordHash) {
          set({ lockScreen: { ...lockScreen, isLocked: true } })
        }
      },
      unlockApp: (password: string) => {
        const { lockScreen } = get()
        const now = Date.now()
        if (lockScreen.lockUntil && now < lockScreen.lockUntil) {
          return false
        }
        // 简单哈希比较（实际使用 crypto 模块）
        const hashed = btoa(password)
        if (hashed === lockScreen.passwordHash) {
          set({ lockScreen: { ...lockScreen, isLocked: false, failedAttempts: 0 } })
          return true
        } else {
          const attempts = lockScreen.failedAttempts + 1
          const lockUntil = attempts >= 5 ? now + 5 * 60 * 1000 : null
          set({ lockScreen: { ...lockScreen, failedAttempts: attempts, lockUntil } })
          return false
        }
      },

      // 通知
      notifications: [],
      addNotification: (notification) => {
        const id = Date.now().toString()
        set((state) => ({
          notifications: [...state.notifications, { ...notification, id }]
        }))
        setTimeout(() => {
          get().removeNotification(id)
        }, 3000)
      },
      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id)
        }))
      },

      // 同步
      lastSyncTime: null,
      isSyncing: false,
      setSyncing: (syncing) => set({ isSyncing: syncing }),
      setLastSyncTime: (time) => set({ lastSyncTime: time }),

      // 侧边栏
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: 'private-workbench-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        settings: state.settings,
        modules: state.modules,
        lockScreen: state.lockScreen,
        lastSyncTime: state.lastSyncTime
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const storedVersion = state.settings?.appVersion
        if (storedVersion !== APP_VERSION) {
          // 版本变化：合并模块列表（保留用户可见性设置，添加新模块）
          const mergedModules = defaultModules.map((defaultModule) => {
            const stored = state.modules?.find((m) => m.id === defaultModule.id)
            if (stored) {
              return { ...defaultModule, isVisible: stored.isVisible }
            }
            return defaultModule
          })
          state.setModules(mergedModules)
          // 合并设置（保留用户设置，添加新字段默认值）
          state.updateSettings({
            ...defaultSettings,
            ...state.settings,
            appVersion: APP_VERSION,
          })
        }
      }
    }
  )
)

// 各模块独立状态
interface TodoState {
  tasks: Task[]
  archivedTasks: Task[]
  tags: Tag[]
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (id: string, task: Partial<Task>) => void
  deleteTask: (id: string) => void
  archiveTask: (id: string) => void
  unarchiveTask: (id: string) => void
  exportArchived: () => string
  clearOldArchived: () => void
  addTag: (tag: Tag) => void
  clearData: () => void
}

export const useTodoStore = create<TodoState>()(
  persist(
    (set, get) => ({
      tasks: [],
      archivedTasks: [],
      tags: [],
      setTasks: (tasks) => set({ tasks }),
      addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
      updateTask: (id, task) => set((state) => {
        const now = new Date().toISOString()
        return {
          tasks: state.tasks.map(t => {
            if (t.id !== id) return t
            const isCompleting = task.is_completed === true && !t.is_completed
            const isReopening = task.is_completed === false && t.is_completed
            return {
              ...t,
              ...task,
              completed_at: isCompleting ? now : isReopening ? null : t.completed_at,
              updated_at: now
            }
          })
        }
      }),
      deleteTask: (id) => {
        const userId = get().user?.id || null
        immediateSyncDelete('tasks', id, userId)
        set((state) => ({
          tasks: state.tasks.map(t => t.id === id ? { ...t, deleted_at: new Date().toISOString() } : t)
        }))
      },
      archiveTask: (id) => set((state) => {
        const task = state.tasks.find(t => t.id === id)
        if (!task || !task.is_completed) return state
        const now = new Date().toISOString()
        return {
          tasks: state.tasks.filter(t => t.id !== id),
          archivedTasks: [{ ...task, is_archived: true, archived_at: now }, ...state.archivedTasks]
        }
      }),
      unarchiveTask: (id) => set((state) => {
        const task = state.archivedTasks.find(t => t.id === id)
        if (!task) return state
        return {
          archivedTasks: state.archivedTasks.filter(t => t.id !== id),
          tasks: [{ ...task, is_archived: false, archived_at: null }, ...state.tasks]
        }
      }),
      exportArchived: () => {
        const { archivedTasks } = get()
        return JSON.stringify(archivedTasks, null, 2)
      },
      clearOldArchived: () => set((state) => {
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
        return {
          archivedTasks: state.archivedTasks.filter(t => !t.archived_at || t.archived_at > oneYearAgo)
        }
      }),
      addTag: (tag) => set((state) => ({ tags: [...state.tags, tag] })),
      clearData: () => set({ tasks: [], archivedTasks: [], tags: [] }),
    }),
    {
      name: 'private-workbench-todo',
      storage: createJSONStorage(() => localStorage)
    }
  )
)

interface ScheduleState {
  schedules: Schedule[]
  setSchedules: (schedules: Schedule[]) => void
  addSchedule: (schedule: Schedule) => void
  updateSchedule: (id: string, schedule: Partial<Schedule>) => void
  deleteSchedule: (id: string) => void
  clearData: () => void
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set) => ({
      schedules: [],
      setSchedules: (schedules) => set({ schedules }),
      addSchedule: (schedule) => set((state) => ({ schedules: [...state.schedules, schedule] })),
      updateSchedule: (id, schedule) => set((state) => ({
        schedules: state.schedules.map(s => s.id === id ? { ...s, ...schedule, updated_at: new Date().toISOString() } : s)
      })),
      deleteSchedule: (id) => {
        const userId = get().user?.id || null
        immediateSyncDelete('schedules', id, userId)
        set((state) => ({
          schedules: state.schedules.map(s => s.id === id ? { ...s, deleted_at: new Date().toISOString() } : s)
        }))
      },
      clearData: () => set({ schedules: [] }),
    }),
    {
      name: 'private-workbench-schedule',
      storage: createJSONStorage(() => localStorage)
    }
  )
)

interface PlanState {
  plans: Plan[]
  tags: Tag[]
  setPlans: (plans: Plan[]) => void
  addPlan: (plan: Plan) => void
  updatePlan: (id: string, plan: Partial<Plan>) => void
  deletePlan: (id: string) => void
  addTag: (tag: Tag) => void
  clearData: () => void
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      plans: [],
      tags: [],
      setPlans: (plans) => set({ plans }),
      addPlan: (plan) => set((state) => ({ plans: [plan, ...state.plans] })),
      updatePlan: (id, plan) => set((state) => ({
        plans: state.plans.map(p => p.id === id ? { ...p, ...plan, updated_at: new Date().toISOString() } : p)
      })),
      deletePlan: (id) => {
        const userId = get().user?.id || null
        immediateSyncDelete('plans', id, userId)
        set((state) => ({
          plans: state.plans.map(p => p.id === id ? { ...p, deleted_at: new Date().toISOString() } : p)
        }))
      },
      addTag: (tag) => set((state) => ({ tags: [...state.tags, tag] })),
      clearData: () => set({ plans: [], tags: [] }),
    }),
    {
      name: 'private-workbench-plan',
      storage: createJSONStorage(() => localStorage)
    }
  )
)

interface HabitState {
  habits: Habit[]
  setHabits: (habits: Habit[]) => void
  addHabit: (habit: Habit) => void
  updateHabit: (id: string, habit: Partial<Habit>) => void
  deleteHabit: (id: string) => void
  checkin: (id: string, date: string, note: string) => void
  uncheckin: (id: string, date: string) => void
  clearData: () => void
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set) => ({
      habits: [],
      setHabits: (habits) => set({ habits }),
      addHabit: (habit) => set((state) => ({ habits: [habit, ...state.habits] })),
      updateHabit: (id, habit) => set((state) => ({
        habits: state.habits.map(h => h.id === id ? { ...h, ...habit, updated_at: new Date().toISOString() } : h)
      })),
      deleteHabit: (id) => {
        const userId = get().user?.id || null
        immediateSyncDelete('habits', id, userId)
        set((state) => ({
          habits: state.habits.map(h => h.id === id ? { ...h, deleted_at: new Date().toISOString() } : h)
        }))
      },
      checkin: (id, date, note) => set((state) => ({
        habits: state.habits.map(h => {
          if (h.id !== id) return h
          const existingIndex = h.checkins.findIndex(c => c.date === date)
          let newCheckins
          if (existingIndex >= 0) {
            newCheckins = h.checkins.map((c, i) => i === existingIndex ? { date, note } : c)
          } else {
            newCheckins = [...h.checkins, { date, note }]
          }
          newCheckins.sort((a, b) => a.date.localeCompare(b.date))
          return { ...h, checkins: newCheckins, updated_at: new Date().toISOString() }
        })
      })),
      uncheckin: (id, date) => set((state) => ({
        habits: state.habits.map(h => {
          if (h.id !== id) return h
          return {
            ...h,
            checkins: h.checkins.filter(c => c.date !== date),
            updated_at: new Date().toISOString()
          }
        })
      })),
      clearData: () => set({ habits: [] }),
    }),
    {
      name: 'private-workbench-habit',
      storage: createJSONStorage(() => localStorage)
    }
  )
)

interface NoteState {
  walls: NoteWall[]
  notes: Note[]
  setWalls: (walls: NoteWall[]) => void
  setNotes: (notes: Note[]) => void
  addWall: (wall: NoteWall) => void
  updateWall: (id: string, wall: Partial<NoteWall>) => void
  deleteWall: (id: string) => void
  reorderWalls: (wallIds: string[]) => void
  addNote: (note: Note) => void
  updateNote: (id: string, note: Partial<Note>) => void
  deleteNote: (id: string) => void
  moveNote: (noteId: string, targetWallId: string) => void
  pinNote: (id: string) => void
  reorderNotes: (wallId: string, noteIds: string[]) => void
  addComment: (noteId: string, comment: { id: string; text: string; created_at: string }) => void
  deleteComment: (noteId: string, commentId: string) => void
  clearData: () => void
}

export const useNoteStore = create<NoteState>()(
  persist(
    (set) => ({
      walls: [],
      notes: [],
      setWalls: (walls) => set({ walls }),
      setNotes: (notes) => set({ notes }),
      addWall: (wall) => set((state) => ({ walls: [wall, ...state.walls] })),
      updateWall: (id, wall) => set((state) => ({
        walls: state.walls.map(w => w.id === id ? { ...w, ...wall, updated_at: new Date().toISOString() } : w)
      })),
      deleteWall: (id) => {
        const userId = get().user?.id || null
        immediateSyncDelete('note_walls', id, userId)
        set((state) => ({
          walls: state.walls.map(w => w.id === id ? { ...w, deleted_at: new Date().toISOString() } : w)
        }))
      },
      reorderWalls: (wallIds) => set((state) => {
        const orderMap = new Map(wallIds.map((id, idx) => [id, idx]))
        return {
          walls: state.walls.map(w => ({
            ...w,
            sort_order: orderMap.has(w.id) ? orderMap.get(w.id)! : w.sort_order
          })).sort((a, b) => a.sort_order - b.sort_order)
        }
      }),
      addNote: (note) => set((state) => ({ notes: [note, ...state.notes] })),
      updateNote: (id, note) => set((state) => ({
        notes: state.notes.map(n => n.id === id ? { ...n, ...note, updated_at: new Date().toISOString() } : n)
      })),
      deleteNote: (id) => {
        const userId = get().user?.id || null
        immediateSyncDelete('notes', id, userId)
        set((state) => ({
          notes: state.notes.map(n => n.id === id ? { ...n, deleted_at: new Date().toISOString() } : n)
        }))
      },
      moveNote: (noteId, targetWallId) => set((state) => ({
        notes: state.notes.map(n => n.id === noteId ? { ...n, wall_id: targetWallId, updated_at: new Date().toISOString() } : n)
      })),
      pinNote: (id) => set((state) => ({
        notes: state.notes.map(n => n.id === id ? { ...n, is_pinned: !n.is_pinned } : n)
      })),
      reorderNotes: (wallId, noteIds) => set((state) => {
        const orderMap = new Map(noteIds.map((id, idx) => [id, idx]))
        return {
          notes: state.notes.map(n => {
            if (n.wall_id !== wallId) return n
            return {
              ...n,
              sort_order: orderMap.has(n.id) ? orderMap.get(n.id)! : n.sort_order
            }
          })
        }
      }),
      addComment: (noteId, comment) => set((state) => ({
        notes: state.notes.map(n => {
          if (n.id !== noteId) return n
          return { ...n, comments: [...n.comments, comment], updated_at: new Date().toISOString() }
        })
      })),
      deleteComment: (noteId, commentId) => set((state) => ({
        notes: state.notes.map(n => {
          if (n.id !== noteId) return n
          return { ...n, comments: n.comments.filter(c => c.id !== commentId), updated_at: new Date().toISOString() }
        })
      })),
      clearData: () => set({ walls: [], notes: [] }),
    }),
    {
      name: 'private-workbench-note',
      storage: createJSONStorage(() => localStorage)
    }
  )
)

interface RecycleBinState {
  items: { id: string; type: string; title: string; deleted_at: string; data: unknown }[]
  addItem: (item: { id: string; type: string; title: string; data: unknown }) => void
  restoreItem: (id: string) => void
  permanentDelete: (id: string) => void
  clearExpired: () => void
  clearData: () => void
}

export const useRecycleBinStore = create<RecycleBinState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) => set((state) => ({
        items: [{ ...item, deleted_at: new Date().toISOString() }, ...state.items]
      })),
      restoreItem: (id) => set((state) => ({
        items: state.items.filter(item => item.id !== id)
      })),
      permanentDelete: (id) => set((state) => ({
        items: state.items.filter(item => item.id !== id)
      })),
      clearExpired: () => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        set((state) => ({
          items: state.items.filter(item => item.deleted_at > sevenDaysAgo)
        }))
      },
      clearData: () => set({ items: [] }),
    }),
    {
      name: 'private-workbench-recycle',
      storage: createJSONStorage(() => localStorage)
    }
  )
)

// 实时记录（Tracker）状态
interface TrackerState {
  categories: TrackerCategory[]
  entries: TrackerEntry[]
  setCategories: (categories: TrackerCategory[]) => void
  setEntries: (entries: TrackerEntry[]) => void
  addCategory: (category: TrackerCategory) => void
  updateCategory: (id: string, category: Partial<TrackerCategory>) => void
  deleteCategory: (id: string) => void
  addEntry: (entry: TrackerEntry) => void
  deleteEntry: (id: string) => void
  clearData: () => void
}

export const useTrackerStore = create<TrackerState>()(
  persist(
    (set) => ({
      categories: [],
      entries: [],
      setCategories: (categories) => set({ categories }),
      setEntries: (entries) => set({ entries }),
      addCategory: (category) => set((state) => ({ categories: [category, ...state.categories] })),
      updateCategory: (id, category) => set((state) => ({
        categories: state.categories.map(c => c.id === id ? { ...c, ...category, updated_at: new Date().toISOString() } : c)
      })),
      deleteCategory: (id) => {
        const userId = get().user?.id || null
        immediateSyncDelete('tracker_categories', id, userId)
        set((state) => ({
          categories: state.categories.map(c => c.id === id ? { ...c, deleted_at: new Date().toISOString() } : c)
        }))
      },
      addEntry: (entry) => set((state) => ({ entries: [entry, ...state.entries] })),
      deleteEntry: (id) => {
        const userId = get().user?.id || null
        immediateSyncDelete('tracker_entries', id, userId)
        set((state) => ({
          entries: state.entries.map(e => e.id === id ? { ...e, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() } : e)
        }))
      },
      clearData: () => set({ categories: [], entries: [] }),
    }),
    {
      name: 'private-workbench-tracker',
      storage: createJSONStorage(() => localStorage)
    }
  )
)

// ---- 切换账号时清除所有本地数据 ----
const STORE_KEYS = [
  'private-workbench-store',
  'private-workbench-todo',
  'private-workbench-schedule',
  'private-workbench-plan',
  'private-workbench-habit',
  'private-workbench-note',
  'private-workbench-recycle',
  'private-workbench-tracker',
]

export function clearAllDataStores() {
  // 清除除了 app store 以外的所有数据 store（app store 保留主题、设置等）
  // 但需要重置 lastSyncTime
  STORE_KEYS.forEach(key => {
    if (key === 'private-workbench-store') {
      const existing = localStorage.getItem(key)
      if (existing) {
        try {
          const parsed = JSON.parse(existing)
          // 保留主题、设置、模块配置，但清除 user/isLoggedIn、lastSyncTime
          delete parsed.state?.user
          delete parsed.state?.isLoggedIn
          delete parsed.state?.lastSyncTime
          localStorage.setItem(key, JSON.stringify(parsed))
        } catch { /* ignore */ }
      }
    } else {
      localStorage.removeItem(key)
    }
  })
  // 同时清除内存中的状态（避免 zustand 从内存中保留旧数据）
  useTodoStore.getState().clearData()
  useScheduleStore.getState().clearData()
  usePlanStore.getState().clearData()
  useHabitStore.getState().clearData()
  useNoteStore.getState().clearData()
  useRecycleBinStore.getState().clearData()
  useTrackerStore.getState().clearData()
}


