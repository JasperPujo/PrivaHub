-- ============================================================
-- PrivaHub 完整数据库 Schema
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================================

-- users
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL,
  email text NOT NULL UNIQUE,
  avatar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  name text,
  role text DEFAULT 'user',
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  content text,
  priority text NOT NULL DEFAULT 'medium',
  tags text[] DEFAULT '{}',
  subtasks jsonb DEFAULT '{}',
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  description text,
  due_date timestamptz,
  is_scheduled boolean DEFAULT false,
  scheduled_for text,
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- schedules
CREATE TABLE IF NOT EXISTS public.schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  content text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  repeat_rule jsonb,
  is_reminder boolean NOT NULL DEFAULT false,
  reminder_type text,
  plan_id uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_all_day boolean DEFAULT false,
  type text DEFAULT 'schedule',
  CONSTRAINT schedules_pkey PRIMARY KEY (id),
  CONSTRAINT schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- plans
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  content text,
  priority text NOT NULL DEFAULT 'medium',
  tags text,
  is_scheduled boolean NOT NULL DEFAULT false,
  scheduled_to text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT plans_pkey PRIMARY KEY (id),
  CONSTRAINT plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- habits
CREATE TABLE IF NOT EXISTS public.habits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'positive',
  checkins jsonb DEFAULT '[]',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  archived_at timestamptz,
  title text DEFAULT '',
  description text DEFAULT '',
  color text DEFAULT '#6B4C9A',
  icon text DEFAULT '',
  frequency text DEFAULT 'daily',
  reminder_time text,
  is_archived boolean DEFAULT false,
  CONSTRAINT habits_pkey PRIMARY KEY (id),
  CONSTRAINT habits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- note_walls
CREATE TABLE IF NOT EXISTS public.note_walls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT note_walls_pkey PRIMARY KEY (id),
  CONSTRAINT note_walls_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- notes
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wall_id uuid NOT NULL,
  content jsonb DEFAULT '{}',
  color text,
  background text,
  position bigint NOT NULL DEFAULT 0,
  sort_order bigint NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  comments jsonb DEFAULT '[]',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  image_ids text[] DEFAULT '{}',
  audio_ids text[] DEFAULT '{}',
  is_archived boolean DEFAULT false,
  title text DEFAULT '',
  is_deleted boolean DEFAULT false,
  CONSTRAINT notes_pkey PRIMARY KEY (id),
  CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT notes_wall_id_fkey FOREIGN KEY (wall_id) REFERENCES public.note_walls(id)
);

-- tracker_categories
CREATE TABLE IF NOT EXISTS public.tracker_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  icon text,
  color text,
  unit text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT tracker_categories_pkey PRIMARY KEY (id),
  CONSTRAINT tracker_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- tracker_entries
CREATE TABLE IF NOT EXISTS public.tracker_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  note text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tracker_entries_pkey PRIMARY KEY (id),
  CONSTRAINT tracker_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT tracker_entries_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.tracker_categories(id)
);

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  username text,
  avatar text,
  role text DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- user_settings
CREATE TABLE IF NOT EXISTS public.user_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
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
  CONSTRAINT user_settings_pkey PRIMARY KEY (id),
  CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- focus_sessions
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'pomodoro',
  theme text DEFAULT '',
  task_id uuid,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  duration integer NOT NULL DEFAULT 0,
  completed_tasks text[] DEFAULT '{}',
  is_rest boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT focus_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT focus_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- sync_logs
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_type text DEFAULT 'pc',
  sync_time timestamptz DEFAULT now(),
  status text DEFAULT 'success',
  note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT sync_logs_pkey PRIMARY KEY (id),
  CONSTRAINT sync_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- tags
CREATE TABLE IF NOT EXISTS public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text DEFAULT '',
  is_builtin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT tags_pkey PRIMARY KEY (id),
  CONSTRAINT tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_walls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracker_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracker_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 通用 RLS 策略
CREATE OR REPLACE FUNCTION public.create_rls_policies()
RETURNS void AS $$
DECLARE
  t text;
  tables text[] := ARRAY['users','tasks','schedules','plans','habits','note_walls','notes','tracker_categories','tracker_entries','user_settings','focus_sessions','sync_logs','tags'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Enable access for own data" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Enable access for own data" ON public.%I FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT public.create_rls_policies();

-- users 和 profiles 特殊处理
DROP POLICY IF EXISTS "Enable access for own data" ON public.users;
CREATE POLICY "Enable access for own data" ON public.users FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Enable access for own profile" ON public.profiles;
CREATE POLICY "Enable access for own profile" ON public.profiles FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- updated_at 自动更新
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['users','tasks','schedules','plans','habits','note_walls','notes','tracker_categories','tracker_entries','user_settings','focus_sessions','tags'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END $$;