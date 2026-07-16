// ===== 用户相关 =====
export interface User {
  id: string
  username: string
  email: string
  avatar?: string
  settings: UserSettings
  created_at: string
  updated_at: string
}

export interface UserSettings {
  theme: 'light' | 'dark'
  autoLogin: boolean
  rememberPassword: boolean
  lockScreenEnabled: boolean
  lockScreenPassword?: string
  soundEnabled: boolean
  scheduleReminderEnabled: boolean
  autoLockEnabled: boolean
  autoLockTimeout: number // 分钟：5, 10, 15, 30, 60
  defaultHomePage: string
  hiddenModules: string[]
  moduleOrder: string[]
  homeShortcuts: string[] // 首页快捷操作项ID列表
  username?: string
}

// ===== 任务待办 =====
export interface Task {
  id: string
  user_id: string
  title: string
  content: string
  priority: 'high' | 'medium' | 'low'
  tags: string[]
  subtasks: Subtask[]
  is_completed: boolean
  completed_at: string | null
  is_archived: boolean
  archived_at: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface Subtask {
  id: string
  title: string
  is_completed: boolean
}

// ===== 日历日程 =====
export interface Schedule {
  id: string
  user_id: string
  title: string
  content: string
  start_time: string
  end_time: string
  is_all_day: boolean
  repeat_rule: RepeatRule | null
  is_reminder: boolean
  reminder_type: 'popup' | 'system' | 'both' | null
  plan_id: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface RepeatRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
  interval: number
  endDate?: string
  daysOfWeek?: number[]
  daysOfMonth?: number[]
  monthsOfYear?: number[]
}

// ===== 习惯打卡 =====
export interface Habit {
  id: string
  user_id: string
  name: string
  type: 'positive' | 'negative'
  checkins: CheckinRecord[]
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface CheckinRecord {
  date: string
  note: string
}

// ===== 宏观规划 =====
export interface Plan {
  id: string
  user_id: string
  title: string
  content: string
  priority: 'high' | 'medium' | 'low'
  tags: string[]
  is_scheduled: boolean
  scheduled_to: 'task' | 'schedule' | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

// ===== 随心贴 =====
export interface NoteWall {
  id: string
  user_id: string
  name: string
  description: string
  sort_order: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  user_id: string
  wall_id: string
  content: NoteContent
  image_ids: string[]
  audio_ids?: string[] // 音频文件 base64 数组
  color: string
  background: string
  position: number
  sort_order: number
  is_pinned: boolean
  comments: NoteComment[]
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface NoteContent {
  text: string
  html?: string
  format?: Record<string, unknown>
}

export interface NoteComment {
  id: string
  text: string
  created_at: string
}

// ===== 同步日志 =====
export interface SyncLog {
  id: string
  user_id: string
  device_type: 'pc' | 'tablet' | 'phone'
  sync_time: string
  status: 'success' | 'failed'
  note: string
  created_at: string
}

// ===== 通用标签 =====
export interface Tag {
  id: string
  name: string
  color: string
  is_builtin: boolean
  created_at: string
}

// ===== 模块配置 =====
export interface ModuleConfig {
  id: string
  name: string
  title: string
  icon: string
  path: string
  isVisible: boolean
}

// ===== 回收站通用项 =====
export interface RecycleBinItem {
  id: string
  type: string
  title: string
  deleted_at: string
  data: Record<string, unknown>
}

export interface TrackerCategory {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  unit: string
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface TrackerEntry {
  id: string
  user_id: string
  category_id: string
  timestamp: string
  note: string
  deleted_at: string | null
  created_at: string
}

// ===== 登录相关 =====
export interface LoginForm {
  username: string
  password: string
  rememberPassword: boolean
  autoLogin: boolean
}

export interface RegisterForm {
  username: string
  email: string
  password: string
  confirmPassword: string
}

export interface LockScreenState {
  isLocked: boolean
  passwordHash: string
  failedAttempts: number
  lockUntil: number | null
}
