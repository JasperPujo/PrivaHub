-- PrivaHub 增量迁移 - 添加可能缺失的列
-- 在 Supabase SQL Editor 中执行

-- tasks 表
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'due_date') THEN
    ALTER TABLE public.tasks ADD COLUMN due_date timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'is_archived') THEN
    ALTER TABLE public.tasks ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'archived_at') THEN
    ALTER TABLE public.tasks ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

-- schedules 表
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedules' AND column_name = 'is_all_day') THEN
    ALTER TABLE public.schedules ADD COLUMN is_all_day boolean DEFAULT false;
  END IF;
END $$;

-- habits 表
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'habits' AND column_name = 'archived_at') THEN
    ALTER TABLE public.habits ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

-- notes 表
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'is_archived') THEN
    ALTER TABLE public.notes ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'title') THEN
    ALTER TABLE public.notes ADD COLUMN title text DEFAULT '';
  END IF;
END $$;