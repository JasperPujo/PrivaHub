import { useEffect, useCallback, useRef } from 'react'
import { useAppStore, useTodoStore, useScheduleStore, usePlanStore, useHabitStore, useNoteStore, useTrackerStore } from '@/store'
import { fullSync, noteWallToDb, noteWallFromDb, taskToDb, taskFromDb, scheduleToDb, scheduleFromDb, planToDb, planFromDb, habitToDb, habitFromDb, noteToDb, noteFromDb, trackerCategoryToDb, trackerEntryToDb } from '@/lib/sync'

export function useAutoSync() {
  const user = useAppStore((s) => s.user)
  const isLoggedIn = useAppStore((s) => s.isLoggedIn)
  const isSyncing = useAppStore((s) => s.isSyncing)
  const setLastSyncTime = useAppStore((s) => s.setLastSyncTime)
  const lastSyncTime = useAppStore((s) => s.lastSyncTime)

  const autoSyncRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSyncTimeRef = useRef<string | null>(lastSyncTime)

  const silentSync = useCallback(async () => {
    if (!user || isSyncing) return
    const since = lastSyncTimeRef.current
    try {
      const now = new Date().toISOString()
      await fullSync(user.id, {
        noteWalls: { table: 'note_walls', getData: () => useNoteStore.getState().walls, setData: (data: any) => useNoteStore.getState().setWalls(data), toDbRow: noteWallToDb, fromDbRow: noteWallFromDb },
        tasks: { table: 'tasks', getData: () => useTodoStore.getState().tasks, setData: (data: any) => useTodoStore.getState().setTasks(data), toDbRow: taskToDb, fromDbRow: taskFromDb },
        schedules: { table: 'schedules', getData: () => useScheduleStore.getState().schedules, setData: (data: any) => useScheduleStore.getState().setSchedules(data), toDbRow: scheduleToDb, fromDbRow: scheduleFromDb },
        plans: { table: 'plans', getData: () => usePlanStore.getState().plans, setData: (data: any) => usePlanStore.getState().setPlans(data), toDbRow: planToDb, fromDbRow: planFromDb },
        habits: { table: 'habits', getData: () => useHabitStore.getState().habits, setData: (data: any) => useHabitStore.getState().setHabits(data), toDbRow: habitToDb, fromDbRow: habitFromDb },
        notes: { table: 'notes', getData: () => useNoteStore.getState().notes, setData: (data: any) => useNoteStore.getState().setNotes(data), toDbRow: noteToDb, fromDbRow: noteFromDb },
        trackerCategories: { table: 'tracker_categories', getData: () => useTrackerStore.getState().categories, setData: (data: any) => useTrackerStore.getState().setCategories(data), toDbRow: trackerCategoryToDb, fromDbRow: trackerEntryToDb },
        trackerEntries: { table: 'tracker_entries', getData: () => useTrackerStore.getState().entries, setData: (data: any) => useTrackerStore.getState().setEntries(data), toDbRow: trackerEntryToDb, fromDbRow: trackerEntryToDb },
      }, { since, parallel: true })

      lastSyncTimeRef.current = now
      setLastSyncTime(now)
      console.log('[AutoSync] Silent sync completed at', now)
    } catch (err: any) {
      console.error('[AutoSync] Silent sync failed:', err)
    }
  }, [user, isSyncing, setLastSyncTime])

  useEffect(() => {
    if (user && isLoggedIn) {
      const timer = setTimeout(() => { silentSync() }, 5000)
      autoSyncRef.current = setInterval(silentSync, 3 * 60 * 1000)
      return () => {
        clearTimeout(timer)
        if (autoSyncRef.current) clearInterval(autoSyncRef.current)
      }
    }
  }, [user, isLoggedIn, silentSync])

  return { silentSync, lastSyncTimeRef }
}
