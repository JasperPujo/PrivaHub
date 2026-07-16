-- ============================================================
-- PrivaHub 私密工作台 - 完整数据库迁移脚本
-- 在 Supabase SQL Editor 中执行此脚本
-- 版本: v1.0.1
-- ============================================================

-- ===== 启用扩展 =====
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ===== 1. 用户表（基于 auth.users 扩展） =====
-- ============================================================
-- 注意：auth.users 是 Supabase 内置表，这里通过自定义 profiles 表扩展
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  avatar text,
  role text DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- ===== 2. 用户设置表 =====
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text DEFAULT 'light',
  auto_login boolean DEFAULT false,
  remember_password boolean DEFAULT false,
  lock_screen_enabled boolean DEFAULT false,
  lock_screen_password text,
  sound_enabled boolean DEFAULT false,
  schedule_reminder_enabled boolean DEFAULT false,
  auto_lock_enabled boolean DEFAULT false,
  auto_lock_timeout integer DEFAULT 15,
  default_home_page text DEFAULT 'home',
  hidden_modules text[] DEFAULT '{}',
  module_order text[] DEFAULT '{}',
  home_shortcuts text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- ============================================================
-- ===== 3. 任务待办表（tasks / todos） =====
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text DEFAULT '',
  description text DEFAULT '',
  priority text DEFAULT 'medium',
  tags text[] DEFAULT '{}',
  subtasks jsonb DEFAULT '[]',
  due_date timestamptz,
  is_scheduled boolean DEFAULT false,
  scheduled_for text,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  is_archived boolean DEFAULT false,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- ===== 4. 日历日程表（schedules） =====
-- ============================================================
CREATE TABLE IF NOT EXISTS public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text DEFAULT '',
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  is_all_day boolean DEFAULT false,
  repeat_rule jsonb,
  is_reminder boolean DEFAULT false,
  reminder_type text,
  plan_id uuid,
  type text DEFAULT 'schedule',
  note text DEFAULT '',
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- ===== 5. 宏观规划表（plans） =====
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text DEFAULT '',
  priority text DEFAULT 'medium',
  tags text[] DEFAULT '{}',
  is_scheduled boolean DEFAULT false,
  scheduled_to text,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- ===== 6. 习惯表（habits） =====
-- ============================================================
CREATE TABLE IF NOT EXISTS public.habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  title text DEFAULT '',
  description text DEFAULT '',
  color text DEFAULT '#6B4C9A',
  icon text DEFAULT '',
  frequency text DEFAULT 'daily',
  reminder_time text,
  type text DEFAULT 'positive',
  checkins jsonb DEFAULT '[]',
  is_archived boolean DEFAULT false,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- ===== 7. 随心贴主题墙表（note_walls） =====
-- ============================================================
CREATE TABLE IF NOT EXISTS public.note_walls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '默认',
  description text DEFAULT '',
  sort_order integer DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- ===== 8. 随心贴表（notes） =====
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wall_id uuid REFERENCES note_walls(id) ON DELETE SET NULL,
  title text DEFAULT '',
  content jsonb DEFAULT '{"text":""}',
  image_ids text[] DEFAULT '{}',
  color text DEFAULT '',
  background text DEFAULT '',
  position integer DEFAULT 0,
  sort_order integer DEFAULT 0,
  is_pinned boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  comments jsonb DEFAULT '[]',
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- ===== 9. 实时记录分类表（tracker_categories） =====
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tracker_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  icon text DEFAULT '',
  color text DEFAULT '',
  unit text DEFAULT '次',
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- ===== 10. 实时记录表（tracker_entries） =====
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tracker_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES tracker_categories(id) ON DELETE CASCADE,
  timestamp timestamptz DEFAULT now(),
  note text DEFAULT '',
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- ===== 11. 专注会话表（focus_sessions） =====
-- ============================================================
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'pomodoro',  -- countUp, countDown, pomodoro
  theme text DEFAULT '',
  task_id uuid,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  duration integer NOT NULL DEFAULT 0,  -- 秒数
  completed_tasks text[] DEFAULT '{}',
  is_rest boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- ===== 12. 同步日志表（sync_logs） =====
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_type text DEFAULT 'pc',  -- pc, tablet, phone
  sync_time timestamptz DEFAULT now(),
  status text DEFAULT 'success',  -- success, failed
  note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- ===== 13. 通用标签表（tags） =====
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '',
  is_builtin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

-- ============================================================
-- ===== 索引优化 =====
-- ============================================================
-- tasks
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_is_completed ON tasks(is_completed);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

-- schedules
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_start_time ON schedules(start_time);
CREATE INDEX IF NOT EXISTS idx_schedules_end_time ON schedules(end_time);
CREATE INDEX IF NOT EXISTS idx_schedules_deleted_at ON schedules(deleted_at);
CREATE INDEX IF NOT EXISTS idx_schedules_plan_id ON schedules(plan_id);

-- plans
CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_deleted_at ON plans(deleted_at);
CREATE INDEX IF NOT EXISTS idx_plans_priority ON plans(priority);

-- habits
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_deleted_at ON habits(deleted_at);
CREATE INDEX IF NOT EXISTS idx_habits_type ON habits(type);

-- note_walls
CREATE INDEX IF NOT EXISTS idx_note_walls_user_id ON note_walls(user_id);
CREATE INDEX IF NOT EXISTS idx_note_walls_deleted_at ON note_walls(deleted_at);
CREATE INDEX IF NOT EXISTS idx_note_walls_sort_order ON note_walls(sort_order);

-- notes
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_wall_id ON notes(wall_id);
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(is_pinned);
CREATE INDEX IF NOT EXISTS idx_notes_sort_order ON notes(sort_order);

-- tracker_categories
CREATE INDEX IF NOT EXISTS idx_tracker_categories_user_id ON tracker_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_tracker_categories_deleted_at ON tracker_categories(deleted_at);

-- tracker_entries
CREATE INDEX IF NOT EXISTS idx_tracker_entries_user_id ON tracker_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_tracker_entries_category_id ON tracker_entries(category_id);
CREATE INDEX IF NOT EXISTS idx_tracker_entries_timestamp ON tracker_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_tracker_entries_deleted_at ON tracker_entries(deleted_at);

-- focus_sessions
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_start_time ON focus_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_is_rest ON focus_sessions(is_rest);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_mode ON focus_sessions(mode);

-- sync_logs
CREATE INDEX IF NOT EXISTS idx_sync_logs_user_id ON sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_sync_time ON sync_logs(sync_time);

-- tags
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

-- user_settings
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- ============================================================
-- ===== 行级安全策略（RLS） =====
-- ============================================================

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_walls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracker_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracker_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- profiles 策略
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- user_settings 策略
DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_settings;
CREATE POLICY "Users can manage own settings" ON public.user_settings
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tasks 策略
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;
CREATE POLICY "Users can manage own tasks" ON public.tasks
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- schedules 策略
DROP POLICY IF EXISTS "Users can manage own schedules" ON public.schedules;
CREATE POLICY "Users can manage own schedules" ON public.schedules
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- plans 策略
DROP POLICY IF EXISTS "Users can manage own plans" ON public.plans;
CREATE POLICY "Users can manage own plans" ON public.plans
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- habits 策略
DROP POLICY IF EXISTS "Users can manage own habits" ON public.habits;
CREATE POLICY "Users can manage own habits" ON public.habits
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- note_walls 策略
DROP POLICY IF EXISTS "Users can manage own note walls" ON public.note_walls;
CREATE POLICY "Users can manage own note walls" ON public.note_walls
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- notes 策略
DROP POLICY IF EXISTS "Users can manage own notes" ON public.notes;
CREATE POLICY "Users can manage own notes" ON public.notes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tracker_categories 策略
DROP POLICY IF EXISTS "Users can manage own tracker categories" ON public.tracker_categories;
CREATE POLICY "Users can manage own tracker categories" ON public.tracker_categories
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tracker_entries 策略
DROP POLICY IF EXISTS "Users can manage own tracker entries" ON public.tracker_entries;
CREATE POLICY "Users can manage own tracker entries" ON public.tracker_entries
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- focus_sessions 策略
DROP POLICY IF EXISTS "Users can manage own focus sessions" ON public.focus_sessions;
CREATE POLICY "Users can manage own focus sessions" ON public.focus_sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- sync_logs 策略
DROP POLICY IF EXISTS "Users can view own sync logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Users can insert own sync logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Users can delete own sync logs" ON public.sync_logs;
CREATE POLICY "Users can view own sync logs" ON public.sync_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sync logs" ON public.sync_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own sync logs" ON public.sync_logs
  FOR DELETE USING (auth.uid() = user_id);

-- tags 策略
DROP POLICY IF EXISTS "Users can manage own tags" ON public.tags;
CREATE POLICY "Users can manage own tags" ON public.tags
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- ===== 自动更新 updated_at 触发器 =====
-- ============================================================

-- 创建触发器函数
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为各表添加触发器
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS user_settings_updated_at ON public.user_settings;
CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS schedules_updated_at ON public.schedules;
CREATE TRIGGER schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS plans_updated_at ON public.plans;
CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS habits_updated_at ON public.habits;
CREATE TRIGGER habits_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS note_walls_updated_at ON public.note_walls;
CREATE TRIGGER note_walls_updated_at
  BEFORE UPDATE ON public.note_walls
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS notes_updated_at ON public.notes;
CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tracker_categories_updated_at ON public.tracker_categories;
CREATE TRIGGER tracker_categories_updated_at
  BEFORE UPDATE ON public.tracker_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- ===== 用户注册时自动创建 profile 和 user_settings =====
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ===== 迁移完成 =====
-- ============================================================
-- 执行完成后，请在 Supabase 控制台验证：
-- 1. 所有表已创建
-- 2. RLS 已启用
-- 3. 触发器已创建
-- 4. 注册一个测试用户，验证 profile 和 user_settings 自动创建
