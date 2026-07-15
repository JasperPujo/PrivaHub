import { supabase } from './supabase'

// 通用同步工具：将本地数据同步到 Supabase

interface SyncOptions {
  table: string
  userId: string
  data: any[]
  idField?: string
  /** 推送前转换本地数据为数据库字段格式 */
  toDbRow?: (item: any) => any
  /** 拉取后转换数据库行为本地格式 */
  fromDbRow?: (row: any) => any
}

/**
 * 合并两条记录：以 updated_at 较新的为准
 */
function mergeRecords(local: any, remote: any): any {
  if (!local) return remote
  if (!remote) return local
  const localTime = local.updated_at || local.created_at || '1970-01-01'
  const remoteTime = remote.updated_at || remote.created_at || '1970-01-01'
  return localTime > remoteTime ? local : remote
}

/**
 * 全量推送：将本地数据推送到 Supabase（更新或插入）
 */
export async function syncPush({ table, userId, data, idField = 'id', toDbRow }: SyncOptions) {
  if (!userId || data.length === 0) return { success: true, count: 0 }

  // 转换并给每条数据加上 user_id
  const rows = data
    .filter(item => item && item.id)
    .map(item => ({
      ...(toDbRow ? toDbRow(item) : item),
      user_id: userId,
    }))

  if (rows.length === 0) return { success: true, count: 0 }

  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: idField })

  if (error) {
    console.error(`[Sync] Push to ${table} failed:`, error)
    return { success: false, error }
  }

  return { success: true, count: rows.length }
}

/**
 * 全量拉取：从 Supabase 拉取用户数据
 */
export async function syncPull(table: string, userId: string, fromDbRow?: (row: any) => any) {
  if (!userId) return { success: false, data: [] }

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)

  if (error) {
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      console.warn(`[Sync] Table ${table} does not exist yet`)
      return { success: true, data: [] }
    }
    console.error(`[Sync] Pull from ${table} failed:`, error)
    return { success: false, error, data: [] }
  }

  const parsed = (data || []).map((row: any) => {
    const item = fromDbRow ? fromDbRow(row) : { ...row }
    // 通用 JSON 字段还原
    try {
      if (item.subtasks && typeof item.subtasks === 'string') item.subtasks = JSON.parse(item.subtasks)
    } catch { item.subtasks = [] }
    try {
      if (item.repeat_rule && typeof item.repeat_rule === 'string') item.repeat_rule = JSON.parse(item.repeat_rule)
    } catch { item.repeat_rule = null }
    try {
      if (item.checkins && typeof item.checkins === 'string') item.checkins = JSON.parse(item.checkins)
    } catch { item.checkins = [] }
    try {
      if (item.comments && typeof item.comments === 'string') item.comments = JSON.parse(item.comments)
    } catch { item.comments = [] }
    return item
  })

  return { success: true, data: parsed }
}

/**
 * 单条删除同步
 */
export async function syncDelete(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) {
    console.error(`[Sync] Delete from ${table} failed:`, error)
    return { success: false, error }
  }
  return { success: true }
}

/**
 * 全量同步：先拉取远程，与本地数据合并（以 updated_at 较新的为准），再推送合并结果
 */
export async function fullSync(userId: string, stores: Record<string, {
  table: string
  getData: () => any[]
  setData: (data: any[]) => void
  toDbRow?: (item: any) => any
  fromDbRow?: (row: any) => any
}>) {
  const results: Record<string, any> = {}

  for (const [key, { table, getData, setData, toDbRow, fromDbRow }] of Object.entries(stores)) {
    try {
      // 1. 拉取远程数据
      const pullResult = await syncPull(table, userId, fromDbRow)
      const remoteData = pullResult.success ? pullResult.data : []

      // 2. 获取本地数据
      const localData = getData()

      // 3. 合并：按 ID 去重，以 updated_at 较新的为准
      const mergedMap = new Map<string, any>()

      for (const item of localData) {
        if (item && item.id) mergedMap.set(item.id, item)
      }

      for (const item of remoteData) {
        if (!item || !item.id) continue
        const existing = mergedMap.get(item.id)
        const merged = mergeRecords(existing, item)
        mergedMap.set(item.id, merged)
      }

      const mergedData = Array.from(mergedMap.values())

      // 4. 写回本地
      setData(mergedData)

      // 5. 推送合并结果到远程
      const pushResult = await syncPush({ table, userId, data: mergedData, toDbRow })

      results[key] = { pull: pullResult, push: pushResult, mergedCount: mergedData.length }
    } catch (err) {
      console.error(`[Sync] Error syncing ${key}:`, err)
      results[key] = { pull: { success: false }, push: { success: false }, error: err }
    }
  }

  return results
}

// ===== 各表的字段映射函数 =====

/** Task: 本地 -> 数据库 */
export const taskToDb = (item: any) => ({
  id: item.id,
  title: item.title,
  content: item.content || item.description || '',
  description: item.content || item.description || '',
  priority: item.priority || 'medium',
  tags: item.tags || [],
  subtasks: item.subtasks ? JSON.stringify(item.subtasks) : '[]',
  due_date: item.due_date || null,
  is_scheduled: item.is_scheduled || false,
  scheduled_for: item.scheduled_for || null,
  is_completed: !!item.is_completed,
  completed_at: item.completed_at || null,
  is_archived: !!item.is_archived,
  archived_at: item.archived_at || null,
  deleted_at: item.deleted_at || null,
  created_at: item.created_at || new Date().toISOString(),
  updated_at: item.updated_at || new Date().toISOString(),
})

/** Task: 数据库 -> 本地 */
export const taskFromDb = (row: any) => ({
  id: row.id,
  user_id: row.user_id,
  title: row.title || '',
  content: row.content || row.description || '',
  description: row.description || row.content || '',
  priority: row.priority || 'medium',
  tags: Array.isArray(row.tags) ? row.tags : [],
  subtasks: Array.isArray(row.subtasks) ? row.subtasks : (typeof row.subtasks === 'string' ? JSON.parse(row.subtasks || '[]') : []),
  due_date: row.due_date || null,
  is_scheduled: !!row.is_scheduled,
  scheduled_for: row.scheduled_for || null,
  is_completed: !!row.is_completed,
  completed_at: row.completed_at || null,
  is_archived: !!row.is_archived,
  archived_at: row.archived_at || null,
  deleted_at: row.deleted_at || null,
  created_at: row.created_at || new Date().toISOString(),
  updated_at: row.updated_at || new Date().toISOString(),
})

/** Schedule: 本地 -> 数据库 */
export const scheduleToDb = (item: any) => ({
  id: item.id,
  title: item.title,
  content: item.content || '',
  start_time: item.start_time,
  end_time: item.end_time,
  is_all_day: !!item.is_all_day,
  repeat_rule: item.repeat_rule ? JSON.stringify(item.repeat_rule) : null,
  is_reminder: !!item.is_reminder,
  reminder_type: item.reminder_type || null,
  plan_id: item.plan_id || null,
  type: item.type || 'schedule',
  is_deleted: !!item.deleted_at,
  deleted_at: item.deleted_at || null,
  created_at: item.created_at || new Date().toISOString(),
  updated_at: item.updated_at || new Date().toISOString(),
})

/** Schedule: 数据库 -> 本地 */
export const scheduleFromDb = (row: any) => ({
  id: row.id,
  user_id: row.user_id,
  title: row.title || '',
  content: row.content || '',
  start_time: row.start_time,
  end_time: row.end_time,
  is_all_day: !!row.is_all_day,
  repeat_rule: row.repeat_rule || null,
  is_reminder: !!row.is_reminder,
  reminder_type: row.reminder_type || null,
  plan_id: row.plan_id || null,
  deleted_at: row.deleted_at || (row.is_deleted ? new Date().toISOString() : null),
  created_at: row.created_at || new Date().toISOString(),
  updated_at: row.updated_at || new Date().toISOString(),
})

/** Habit: 本地 -> 数据库（数据库用 title，本地用 name） */
export const habitToDb = (item: any) => ({
  id: item.id,
  title: item.name || item.title || '',
  description: item.description || '',
  color: item.color || '#6B4C9A',
  icon: item.icon || '',
  frequency: item.frequency || 'daily',
  reminder_time: item.reminder_time || null,
  type: item.type || 'positive',
  checkins: item.checkins ? JSON.stringify(item.checkins) : '[]',
  is_archived: !!item.is_archived,
  archived_at: item.archived_at || null,
  deleted_at: item.deleted_at || null,
  created_at: item.created_at || new Date().toISOString(),
  updated_at: item.updated_at || new Date().toISOString(),
})

/** Habit: 数据库 -> 本地（数据库 title -> 本地 name） */
export const habitFromDb = (row: any) => ({
  id: row.id,
  user_id: row.user_id,
  name: row.name || row.title || '',
  description: row.description || '',
  color: row.color || '#6B4C9A',
  icon: row.icon || '',
  frequency: row.frequency || 'daily',
  reminder_time: row.reminder_time || null,
  type: row.type || 'positive',
  checkins: Array.isArray(row.checkins) ? row.checkins : (typeof row.checkins === 'string' ? JSON.parse(row.checkins || '[]') : []),
  is_archived: !!row.is_archived,
  archived_at: row.archived_at || null,
  deleted_at: row.deleted_at || null,
  created_at: row.created_at || new Date().toISOString(),
  updated_at: row.updated_at || new Date().toISOString(),
})

/** Plan: 本地 -> 数据库 */
export const planToDb = (item: any) => ({
  id: item.id,
  title: item.title,
  content: item.content || '',
  priority: item.priority || 'medium',
  tags: item.tags || [],
  is_scheduled: !!item.is_scheduled,
  scheduled_to: item.scheduled_to || null,
  deleted_at: item.deleted_at || null,
  created_at: item.created_at || new Date().toISOString(),
  updated_at: item.updated_at || new Date().toISOString(),
})

/** Plan: 数据库 -> 本地 */
export const planFromDb = (row: any) => ({
  id: row.id,
  user_id: row.user_id,
  title: row.title || '',
  content: row.content || '',
  priority: row.priority || 'medium',
  tags: Array.isArray(row.tags) ? row.tags : [],
  is_scheduled: !!row.is_scheduled,
  scheduled_to: row.scheduled_to || null,
  deleted_at: row.deleted_at || null,
  created_at: row.created_at || new Date().toISOString(),
  updated_at: row.updated_at || new Date().toISOString(),
})

/** Note: 本地 -> 数据库 */
export const noteToDb = (item: any) => ({
  id: item.id,
  title: item.title || '',
  content: typeof item.content === 'string' ? item.content : JSON.stringify(item.content),
  wall_id: item.wall_id || null,
  image_ids: item.image_ids || [],
  color: item.color || '',
  background: item.background || '',
  position: item.position || 0,
  sort_order: item.sort_order || 0,
  is_pinned: !!item.is_pinned,
  is_archived: !!item.is_archived,
  is_deleted: !!item.deleted_at,
  comments: item.comments ? JSON.stringify(item.comments) : '[]',
  deleted_at: item.deleted_at || null,
  created_at: item.created_at || new Date().toISOString(),
  updated_at: item.updated_at || new Date().toISOString(),
})

/** Note: 数据库 -> 本地 */
export const noteFromDb = (row: any) => ({
  id: row.id,
  user_id: row.user_id,
  wall_id: row.wall_id || null,
  content: row.content || { text: '' },
  image_ids: Array.isArray(row.image_ids) ? row.image_ids : [],
  color: row.color || '',
  background: row.background || '',
  position: row.position || 0,
  sort_order: row.sort_order || 0,
  is_pinned: !!row.is_pinned,
  is_archived: !!row.is_archived,
  comments: Array.isArray(row.comments) ? row.comments : (typeof row.comments === 'string' ? JSON.parse(row.comments || '[]') : []),
  deleted_at: row.deleted_at || null,
  created_at: row.created_at || new Date().toISOString(),
  updated_at: row.updated_at || new Date().toISOString(),
})

/** NoteWall: 本地 -> 数据库 */
export const noteWallToDb = (item: any) => ({
  id: item.id,
  name: item.name || '默认',
  description: item.description || '',
  sort_order: item.sort_order || 0,
  deleted_at: item.deleted_at || null,
  created_at: item.created_at || new Date().toISOString(),
  updated_at: item.updated_at || new Date().toISOString(),
})

/** NoteWall: 数据库 -> 本地 */
export const noteWallFromDb = (row: any) => ({
  id: row.id,
  user_id: row.user_id,
  name: row.name || '默认',
  description: row.description || '',
  sort_order: row.sort_order || 0,
  deleted_at: row.deleted_at || null,
  created_at: row.created_at || new Date().toISOString(),
  updated_at: row.updated_at || new Date().toISOString(),
})

/** TrackerCategory: 双向一致 */
export const trackerCategoryToDb = (item: any) => ({
  id: item.id,
  name: item.name || '',
  icon: item.icon || '',
  color: item.color || '',
  unit: item.unit || '',
  deleted_at: item.deleted_at || null,
  created_at: item.created_at || new Date().toISOString(),
  updated_at: item.updated_at || new Date().toISOString(),
})

/** TrackerEntry: 双向一致 */
export const trackerEntryToDb = (item: any) => ({
  id: item.id,
  category_id: item.category_id,
  timestamp: item.timestamp || new Date().toISOString(),
  note: item.note || '',
  deleted_at: item.deleted_at || null,
  created_at: item.created_at || new Date().toISOString(),
})