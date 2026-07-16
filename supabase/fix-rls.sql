-- ============================================================
-- PrivaHub RLS 权限修复脚本
-- 在 Supabase SQL Editor 中执行
-- 解决 403 Forbidden / permission denied 错误
-- ============================================================

-- ===== 1. 确保所有表启用 RLS =====
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

-- ===== 2. 删除旧策略 =====
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can manage own schedules" ON public.schedules;
DROP POLICY IF EXISTS "Users can manage own plans" ON public.plans;
DROP POLICY IF EXISTS "Users can manage own habits" ON public.habits;
DROP POLICY IF EXISTS "Users can manage own note walls" ON public.note_walls;
DROP POLICY IF EXISTS "Users can manage own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can manage own tracker categories" ON public.tracker_categories;
DROP POLICY IF EXISTS "Users can manage own tracker entries" ON public.tracker_entries;
DROP POLICY IF EXISTS "Users can manage own focus sessions" ON public.focus_sessions;
DROP POLICY IF EXISTS "Users can view own sync logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Users can insert own sync logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Users can delete own sync logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Users can manage own tags" ON public.tags;

-- ===== 3. 重新创建策略（显式指定 TO authenticated）=====

-- profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- user_settings
CREATE POLICY "user_settings_all" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- tasks
CREATE POLICY "tasks_all" ON public.tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- schedules
CREATE POLICY "schedules_all" ON public.schedules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- plans
CREATE POLICY "plans_all" ON public.plans FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- habits
CREATE POLICY "habits_all" ON public.habits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- note_walls
CREATE POLICY "note_walls_all" ON public.note_walls FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- notes
CREATE POLICY "notes_all" ON public.notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- tracker_categories
CREATE POLICY "tracker_categories_all" ON public.tracker_categories FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- tracker_entries
CREATE POLICY "tracker_entries_all" ON public.tracker_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- focus_sessions
CREATE POLICY "focus_sessions_all" ON public.focus_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- sync_logs
CREATE POLICY "sync_logs_select" ON public.sync_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sync_logs_insert" ON public.sync_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sync_logs_delete" ON public.sync_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- tags
CREATE POLICY "tags_all" ON public.tags FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===== 4. 授予表权限给 authenticated 角色 =====
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.user_settings TO authenticated;
GRANT ALL ON public.tasks TO authenticated;
GRANT ALL ON public.schedules TO authenticated;
GRANT ALL ON public.plans TO authenticated;
GRANT ALL ON public.habits TO authenticated;
GRANT ALL ON public.note_walls TO authenticated;
GRANT ALL ON public.notes TO authenticated;
GRANT ALL ON public.tracker_categories TO authenticated;
GRANT ALL ON public.tracker_entries TO authenticated;
GRANT ALL ON public.focus_sessions TO authenticated;
GRANT ALL ON public.sync_logs TO authenticated;
GRANT ALL ON public.tags TO authenticated;

-- 也授予 anon 角色（注册/登录时需要）
GRANT SELECT, INSERT ON public.profiles TO anon;
GRANT SELECT, INSERT ON public.user_settings TO anon;

-- ===== 5. 授予序列权限（如果有自增序列）=====
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
