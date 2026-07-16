-- ============================================================
-- PrivaHub 数据库 Schema 修复脚本
-- 在 Supabase SQL Editor 中执行此脚本
-- 执行前请备份数据！
-- ============================================================

-- 1. tasks 表：添加缺失的列
DO $ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'is_scheduled') THEN
    ALTER TABLE public.tasks ADD COLUMN is_scheduled boolean DEFAULT false;
  END IF;
END $;

DO $ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'scheduled_for') THEN
    ALTER TABLE public.tasks ADD COLUMN scheduled_for text;
  END IF;
END $;

-- 2. schedules 表：添加缺失的列
DO $ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedules' AND column_name = 'type') THEN
    ALTER TABLE public.schedules ADD COLUMN type text DEFAULT 'schedule';
  END IF;
END $;

-- 3. habits 表：添加缺失的列
DO $ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'habits' AND column_name = 'title') THEN
    ALTER TABLE public.habits ADD COLUMN title text DEFAULT '';
  END IF;
END $;

DO $ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'habits' AND column_name = 'description') THEN
    ALTER TABLE public.habits ADD COLUMN description text DEFAULT '';
  END IF;
END $;

DO $ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'habits' AND column_name = 'color') THEN
    ALTER TABLE public.habits ADD COLUMN color text DEFAULT '#6B4C9A';
  END IF;
END $;

DO $ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'habits' AND column_name = 'icon') THEN
    ALTER TABLE public.habits ADD COLUMN icon text DEFAULT '';
  END IF;
END $;

DO $ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'habits' AND column_name = 'frequency') THEN
    ALTER TABLE public.habits ADD COLUMN frequency text DEFAULT 'daily';
  END IF;
END $;

DO $ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'habits' AND column_name = 'reminder_time') THEN
    ALTER TABLE public.habits ADD COLUMN reminder_time text;
  END IF;
END $;

DO $ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'habits' AND column_name = 'is_archived') THEN
    ALTER TABLE public.habits ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
END $;

-- 4. note_walls 表：修复 sort_order 列类型（从 uuid 改为 integer）
-- 注意：如果 sort_order 列已有 uuid 数据，需要先将它们迁移到新列，然后删除旧列重命名
DO $ BEGIN
  -- 检查 sort_order 是否为 uuid 类型
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'note_walls' AND column_name = 'sort_order' AND data_type = 'uuid'
  ) THEN
    -- 创建临时列
    ALTER TABLE public.note_walls ADD COLUMN sort_order_new integer DEFAULT 0;
    -- 将现有数据转为整数（uuid 转不了，设为 0）
    UPDATE public.note_walls SET sort_order_new = 0;
    -- 删除旧列
    ALTER TABLE public.note_walls DROP COLUMN sort_order;
    -- 重命名新列
    ALTER TABLE public.note_walls RENAME COLUMN sort_order_new TO sort_order;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'note_walls' AND column_name = 'sort_order') THEN
    ALTER TABLE public.note_walls ADD COLUMN sort_order integer DEFAULT 0;
  END IF;
END $;

-- 5. notes 表：添加缺失的列
DO $ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'is_deleted') THEN
    ALTER TABLE public.notes ADD COLUMN is_deleted boolean DEFAULT false;
  END IF;
END $;

-- ============================================================
-- 验证
-- ============================================================
SELECT 'tasks' as table_name, column_name, data_type FROM information_schema.columns WHERE table_name = 'tasks' AND column_name IN ('is_scheduled', 'scheduled_for')
UNION ALL
SELECT 'schedules', column_name, data_type FROM information_schema.columns WHERE table_name = 'schedules' AND column_name = 'type'
UNION ALL
SELECT 'habits', column_name, data_type FROM information_schema.columns WHERE table_name = 'habits' AND column_name IN ('title', 'description', 'color', 'icon', 'frequency', 'reminder_time', 'is_archived')
UNION ALL
SELECT 'note_walls', column_name, data_type FROM information_schema.columns WHERE table_name = 'note_walls' AND column_name = 'sort_order'
UNION ALL
SELECT 'notes', column_name, data_type FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'is_deleted'
ORDER BY table_name, column_name;
