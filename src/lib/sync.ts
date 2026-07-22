import { supabase } from './supabase'

// 通用同步工具：将本地数据同步到 Supabase

/** 同步锁，防止并发同步导致数据冲突 */
let isSyncing = false

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
  // 删除状态优先：任意一方已删除，保留已删除状态（防止已删除记录被复活）
  if (local.deleted_at || remote.deleted_at) {
    return local.deleted_at ? local : remote
  }
  const localTime = local.updated_at || local.created_at || '1970-01-01'
  const remoteTime = remote.updated_at || remote.created_at || '1970-01-01'
  // 本地时间 >= 远程时间时保留本地（相等时优先保留本地最新操作）
  return localTime >= remoteTime ? local : remote
}

/**
 * 从错误消息中提取缺失的列名
 * Postgres 错误格式: column "xxx" of relation "yyy" does not exist
 */
/**
 * 从错误消息中提取缺失的列名
 * Postgres 错误格式: column "xxx" of relation "yyy" does not exist
 */
/**
 * 从错误消息中提取缺失的列名
 * Postgres 错误格式: column "xxx" of relation "yyy" does not exist
 */
function extractMissingColumn(errorMessage: string): string | null {
  const match = errorMessage.match(/column "(\w+)" of relation "\w+" does not exist/)
  return match ? match[1] : null
}

/**
 * 全量推送：将本地数据推送到 Supabase（更新或插入）
 * 支持列缺失自动重试：当检测到 "column does not exist" 错误时，
 * 自动移除缺失列并重试 upsert（最多重试 2 次）
 */
export async function syncPush({ table, userId, data, idField = 'id', toDbRow }: SyncOptions) {
  if (!userId || data.length === 0) return { success: true, count: 0 }

  // 转换并给每条数据加上 user_id
  let rows = data
    .filter(item => item && item.id)
    .map(item => ({
      ...(toDbRow ? toDbRow(item) : item),
      user_id: userId,
    }))

  if (rows.length === 0) return { success: true, count: 0 }

  // 确保每条数据的 user_id 是有效 UUID
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  rows = rows.map(row => ({
    ...row,
    user_id: UUID_REGEX.test(row.user_id) ? row.user_id : userId,
  }))

  // 最多重试 2 次（每次移除一个缺失列）
  const maxRetries = 2
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { error, status, statusText } = await supabase
        .from(table)
        .upsert(rows, { onConflict: idField })

      if (error) {
        const errMsg = error.message || ''
        const errCode = error.code || ''

        // 检测 "column does not exist" 错误
        if (
          (errMsg.includes('does not exist') && errMsg.includes('column')) ||
          errCode === '42703'
        ) {
          const missingCol = extractMissingColumn(errMsg)
          if (missingCol && attempt < maxRetries) {
            console.warn(
              `[Sync] Table "${table}" missing column "${missingCol}", removing it and retrying (attempt ${attempt + 1}/${maxRetries})`
            )
            rows = rows.map(row => {
              const cleaned = { ...row }
              delete cleaned[missingCol]
              return cleaned
            })
            continue
          }
        }

        console.error(
          `[Sync] Push to table "${table}" failed:`,
          `\n  HTTP status: ${status} ${statusText}`,
          `\n  Error code: ${error.code}`,
          `\n  Error message: ${error.message}`,
          `\n  Error details: ${error.details || 'N/A'}`,
          `\n  Error hint: ${error.hint || 'N/A'}`,
          `\n  Row count attempted: ${rows.length}`,
        )
        return { success: false, error, table }
      }

      // upsert 成功后，额外确保已删除记录的 deleted_at 被写入（upsert 可能因列缺失静默忽略）
      const deletedRows = rows.filter(r => r.deleted_at)
      if (deletedRows.length > 0) {
        try {
          await supabase.from(table).upsert(
            deletedRows.map(r => ({ id: r.id, deleted_at: r.deleted_at, user_id: r.user_id, updated_at: r.updated_at })),
            { onConflict: idField }
          )
        } catch (e) {
          console.warn(`[Sync] Failed to explicitly sync deleted_at for table "${table}":`, e)
        }
      }

      return { success: true, count: rows.length }
    } catch (err: any) {
      const errMsg = err.message || String(err)

      if (errMsg.includes('does not exist') && errMsg.includes('column')) {
        const missingCol = extractMissingColumn(errMsg)
        if (missingCol && attempt < maxRetries) {
          console.warn(
            `[Sync] Table "${table}" missing column "${missingCol}" (exception), removing and retrying (attempt ${attempt + 1}/${maxRetries})`
          )
          rows = rows.map(row => {
            const cleaned = { ...row }
            delete cleaned[missingCol]
            return cleaned
          })
          continue
        }
      }

      console.error(
        `[Sync] Push to table "${table}" threw exception:`,
        `\n  Error: ${errMsg}`,
        `\n  Row count attempted: ${rows.length}`,
      )
      return { success: false, error: { message: errMsg, code: 'EXCEPTION' }, table }
    }
  }

  return { success: false, error: { message: 'Max retries exceeded for missing columns', code: 'MAX_RETRIES' }, table }
}


/**
 * 拉取：从 Supabase 拉取用户数据，支持增量（since 参数）
 */
export async function syncPull(table: string, userId: string, fromDbRow?: (row: any) => any, since?: string | null) {
  if (!userId) return { success: false, data: [] }

  try {
    let query = supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)

    // 增量：只拉取 updated_at 大于 since 的记录
    if (since) {
      query = query.gt('updated_at', since)
    }

    const { data, error, status, statusText } = await query

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        console.warn(`[Sync] Table "${table}" does not exist yet, skipping`)
        return { success: true, data: [] }
      }
      console.error(
        `[Sync] Pull from table "${table}" failed:`,
        `\n  HTTP status: ${status} ${statusText}`,
        `\n  Error code: ${error.code}`,
        `\n  Error message: ${error.message}`,
        `\n  Error details: ${error.details || 'N/A'}`,
        `\n  Error hint: ${error.hint || 'N/A'}`,
      )
      return { success: false, error, data: [], table }
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
  } catch (err: any) {
    console.error(
      `[Sync] Pull from table "${table}" threw exception:`,
      `\n  Error: ${err.message || err}`,
    )
    return { success: false, error: { message: err.message || String(err), code: 'EXCEPTION' }, data: [], table }
  }
}

/**
 * 单条删除同步
 */
export async function syncDelete(table: string, id: string, userId: string) {
  try {
    const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId)
    if (error) {
      console.error(
        `[Sync] Delete from table "${table}" failed: id=${id}`,
        `\n  Error code: ${error.code}`,
        `\n  Error message: ${error.message}`,
        `\n  Error details: ${error.details || 'N/A'}`,
      )
      return { success: false, error }
    }
    return { success: true }
  } catch (err: any) {
    console.error(
      `[Sync] Delete from table "${table}" threw exception: id=${id}`,
      `\n  Error: ${err.message || err}`,
    )
    return { success: false, error: { message: err.message || String(err), code: 'EXCEPTION' } }
  }
}

/**
 * 同步：支持增量和并行
 * @param since 如果提供，只拉取/推送 updated_at > since 的数据（增量模式）
 * @param parallel 是否并行同步（默认 true）
 */
export async function fullSync(userId: string, stores: Record<string, {
  table: string
  getData: () => any[]
  setData: (data: any[]) => void
  toDbRow?: (item: any) => any
  fromDbRow?: (row: any) => any
}>, options?: { since?: string | null; parallel?: boolean }) {
  // 同步锁：防止并发同步导致数据冲突
  if (isSyncing) {
    console.log('[Sync] Another sync is in progress, skipping')
    return {}
  }
  isSyncing = true

  const since = options?.since || null
  const useParallel = options?.parallel !== false

  // 如果所有本地 store 都为空，说明是新设备/首次同步，强制全量拉取
  const allStores = Object.values(stores)
  const hasAnyLocalData = allStores.some(s => s.getData().length > 0)
  const effectiveSince = hasAnyLocalData ? since : null
  if (!hasAnyLocalData && since) {
    console.log('[Sync] No local data detected, forcing full sync (ignoring since)')
  }
  const results: Record<string, any> = {}

  const syncOne = async ([key, store]: [string, any]) => {
    const { table, getData, setData, toDbRow, fromDbRow } = store
    try {
      // 1. 获取本地数据
      let localData = getData()

      // 2. 拉取远程数据（增量或全量）
      const pullResult = await syncPull(table, userId, fromDbRow, effectiveSince)
      const remoteData = pullResult.success ? pullResult.data : []

      // 3. 合并远程数据到本地
      // 关键：如果本地已删除（deleted_at 存在），即使远程没有删除标记，也保留删除状态
      if (remoteData.length > 0) {
        const localMap = new Map(localData.map((item: any) => [item.id, item]))
        for (const item of remoteData) {
          if (!item?.id) continue
          const existing = localMap.get(item.id)
          // 如果本地已删除，强制保留删除状态
          if (existing?.deleted_at && !item.deleted_at) {
            item.deleted_at = existing.deleted_at
          }
          const merged = mergeRecords(existing, item)
          localMap.set(item.id, merged)
        }
        localData = Array.from(localMap.values())
        setData(localData)
      }

      // 4. 计算需要推送的数据（增量模式下只推送本地更新过的数据）
      let dataToPush = localData
      if (effectiveSince) {
        dataToPush = localData.filter((item: any) => {
          const t = item.updated_at || item.created_at || ''
          return t > effectiveSince
        })
      }

      // 5. 推送到远程（增量模式下只推送变化的数据）
      let pushResult: any = { success: true, count: 0 }
      if (dataToPush.length > 0) {
        pushResult = await syncPush({ table, userId, data: dataToPush, toDbRow })
      }

      // 额外确保本地已删除记录同步到云端
      const allLocalData = getData()
      const deletedItems = allLocalData.filter((item: any) => item.deleted_at)
      if (deletedItems.length > 0) {
        try {
          const deletedRows = deletedItems.map((item: any) => ({
            id: item.id,
            deleted_at: item.deleted_at,
            user_id: userId,
            updated_at: item.updated_at || new Date().toISOString(),
          }))
          await supabase.from(table).upsert(deletedRows, { onConflict: 'id' })
          console.log(`[Sync] Explicitly synced ${deletedItems.length} deleted records for table "${table}"`)
        } catch (e) {
          console.warn(`[Sync] Failed to explicitly sync deleted records for table "${table}":`, e)
        }
      }

      results[key] = { pull: pullResult, push: pushResult, mergedCount: dataToPush.length, table }
    } catch (err: any) {
      console.error(`[Sync] Error syncing table "${table}" (key: ${key}):`, err)
      results[key] = { pull: { success: false }, push: { success: false }, error: err, table }
    }
  }

  try {
    if (useParallel) {
      // 并行同步所有表
      await Promise.all(Object.entries(stores).map(syncOne))
    } else {
      // 串行同步
      for (const entry of Object.entries(stores)) {
        await syncOne(entry)
      }
    }
  } finally {
    isSyncing = false
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
  tags: Array.isArray(item.tags) ? item.tags : (typeof item.tags === 'string' ? JSON.parse(item.tags || '[]') : []),
  subtasks: item.subtasks ? (typeof item.subtasks === 'string' ? item.subtasks : JSON.stringify(item.subtasks)) : '[]',
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
  tags: Array.isArray(row.tags) ? row.tags : (typeof row.tags === 'string' ? JSON.parse(row.tags || '[]') : []),
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
  repeat_rule: item.repeat_rule ? (typeof item.repeat_rule === 'string' ? item.repeat_rule : JSON.stringify(item.repeat_rule)) : null,
  is_reminder: !!item.is_reminder,
  reminder_type: item.reminder_type || null,
  plan_id: item.plan_id || null,
  type: item.type || 'schedule',
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
  name: item.name || item.title || '未命名习惯',
  title: item.title || item.name || '',
  description: item.description || '',
  color: item.color || '#6B4C9A',
  icon: item.icon || '',
  frequency: item.frequency || 'daily',
  reminder_time: item.reminder_time || null,
  type: item.type || 'positive',
  checkins: item.checkins ? (typeof item.checkins === 'string' ? item.checkins : JSON.stringify(item.checkins)) : '[]',
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
  tags: Array.isArray(item.tags) ? JSON.stringify(item.tags) : (typeof item.tags === 'string' ? item.tags : '[]'),
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
  tags: Array.isArray(row.tags) ? row.tags : (typeof row.tags === 'string' ? JSON.parse(row.tags || '[]') : []),
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
  content: typeof item.content === 'string'
    ? item.content
    : (item.content != null ? JSON.stringify(item.content) : ''),
  wall_id: item.wall_id || null,
  image_ids: Array.isArray(item.image_ids) ? item.image_ids : (typeof item.image_ids === 'string' ? JSON.parse(item.image_ids || '[]') : []),
  audio_ids: Array.isArray(item.audio_ids) ? item.audio_ids : (typeof item.audio_ids === 'string' ? JSON.parse(item.audio_ids || '[]') : []),
  color: item.color || '',
  background: item.background || '',
  position: item.position || 0,
  sort_order: item.sort_order || 0,
  is_pinned: !!item.is_pinned,
  is_archived: !!item.is_archived,
  is_deleted: !!item.deleted_at,
  comments: item.comments ? (typeof item.comments === 'string' ? item.comments : JSON.stringify(item.comments)) : '[]',
  deleted_at: item.deleted_at || null,
  created_at: item.created_at || new Date().toISOString(),
  updated_at: item.updated_at || new Date().toISOString(),
})

/** Note: 数据库 -> 本地 */
export const noteFromDb = (row: any) => {
  // content 字段还原：从数据库字符串还原为 NoteContent 对象 { text, html?, format? }
  let content: any = row.content
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content)
      if (content && typeof content === 'object') {
        if (!('text' in content)) {
          content = { text: String(content) }
        }
      } else {
        content = { text: String(content) }
      }
    } catch {
      content = { text: content }
    }
  } else if (content == null) {
    content = { text: '' }
  } else if (typeof content === 'object' && !('text' in content)) {
    content = { text: JSON.stringify(content) }
  }

  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title || '',
    wall_id: row.wall_id || null,
    content,
    image_ids: Array.isArray(row.image_ids) ? row.image_ids : (typeof row.image_ids === 'string' ? JSON.parse(row.image_ids || '[]') : []),
    audio_ids: Array.isArray(row.audio_ids) ? row.audio_ids : (typeof row.audio_ids === 'string' ? JSON.parse(row.audio_ids || '[]') : []),
    color: row.color || '',
    background: row.background || '',
    position: row.position || 0,
    sort_order: row.sort_order || 0,
    is_pinned: !!row.is_pinned,
    is_archived: !!row.is_archived,
    is_deleted: !!row.is_deleted,
    comments: Array.isArray(row.comments) ? row.comments : (typeof row.comments === 'string' ? JSON.parse(row.comments || '[]') : []),
    deleted_at: row.deleted_at || null,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  }
}

/** NoteWall: 本地 -> 数据库 */
export const noteWallToDb = (item: any) => ({
  id: item.id,
  name: item.name || '默认',
  description: item.description || '',
  sort_order: typeof item.sort_order === 'number' && Number.isInteger(item.sort_order) ? item.sort_order : 0,
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
  updated_at: item.updated_at || new Date().toISOString(),
})
