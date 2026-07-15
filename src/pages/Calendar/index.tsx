import React, { useState, useMemo } from 'react'
import { useScheduleStore, usePlanStore, useRecycleBinStore, useTodoStore } from '@/store'
import { motion, AnimatePresence } from 'framer-motion'
import Modal from '@/components/Modal/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import {
  Plus, ChevronLeft, ChevronRight, Trash, Edit,
  Calendar as CalendarIcon, Target
} from '@/utils/icons'
import type { Schedule, RepeatRule } from '@/types'

// 本地日期辅助函数 —— 修复时区偏移问题
const toLocalDateStr = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const toLocalISO = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// 日程色块预设 —— 深色文字保证可读性
const scheduleColors = [
  { bg: 'bg-primary-600', text: 'text-[#1A1759]', light: 'bg-primary-600/15', border: 'border-primary-600/30', hex: '#4B3FE3' },
  { bg: 'bg-accent', text: 'text-[#0F4C42]', light: 'bg-accent/15', border: 'border-accent/30', hex: '#27D2BF' },
  { bg: 'bg-success', text: 'text-[#14532D]', light: 'bg-success/15', border: 'border-success/30', hex: '#1DC981' },
  { bg: 'bg-warning', text: 'text-[#713F12]', light: 'bg-warning/15', border: 'border-warning/30', hex: '#EFAA17' },
  { bg: 'bg-danger', text: 'text-[#7F1D1D]', light: 'bg-danger/15', border: 'border-danger/30', hex: '#E8463A' },
  { bg: 'bg-[#8B5CF6]', text: 'text-[#3B1270]', light: 'bg-[#8B5CF6]/15', border: 'border-[#8B5CF6]/30', hex: '#8B5CF6' },
  { bg: 'bg-[#F97316]', text: 'text-[#7C2D12]', light: 'bg-[#F97316]/15', border: 'border-[#F97316]/30', hex: '#F97316' },
  { bg: 'bg-[#EC4899]', text: 'text-[#831843]', light: 'bg-[#EC4899]/15', border: 'border-[#EC4899]/30', hex: '#EC4899' },
]

const CalendarPage: React.FC = () => {
  const { schedules, addSchedule, updateSchedule, deleteSchedule } = useScheduleStore()
  const { plans } = usePlanStore()
  const { addItem } = useRecycleBinStore()
  const { tasks, updateTask } = useTodoStore()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [showModal, setShowModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showYearPicker, setShowYearPicker] = useState(false)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [viewMode, setViewMode] = useState<'month' | 'day'>('month')
  const [selectedDayDate, setSelectedDayDate] = useState(new Date())

  const [form, setForm] = useState({
    title: '',
    content: '',
    start_time: '',
    end_time: '',
    start_time_value: '09:00',
    end_time_value: '10:00',
    is_all_day: true,
    is_reminder: false,
    reminder_type: 'popup' as Schedule['reminder_type'],
    repeat_rule: null as RepeatRule | null,
    plan_id: null as string | null
  })

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPadding = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  // 给每个日程分配一个固定颜色索引
  const scheduleColorMap = useMemo(() => {
    const map: Record<string, number> = {}
    const active = schedules.filter(s => !s.deleted_at)
    active.forEach((s, i) => { map[s.id] = i % scheduleColors.length })
    return map
  }, [schedules])

  const monthSchedules = schedules.filter(s => !s.deleted_at)

  const getSchedulesForDay = (day: number) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const targetStr = `${year}-${pad(month + 1)}-${pad(day)}`
    return monthSchedules.filter(s => {
      // 提取开始日期字符串（YYYY-MM-DD）
      const startStr = s.start_time.slice(0, 10)
      // 提取结束日期字符串
      let endStr: string
      if (s.end_time && s.end_time.length >= 10) {
        endStr = s.end_time.slice(0, 10)
      } else {
        endStr = startStr
      }
      return targetStr >= startStr && targetStr <= endStr
    })
  }

  // 跨天日程列表
  const multiDaySchedules = monthSchedules.filter(s => {
    const startStr = s.start_time.slice(0, 10)
    const endStr = s.end_time && s.end_time.length >= 10 ? s.end_time.slice(0, 10) : startStr
    return startStr !== endStr
  })

  // 计算每个跨天日程按周的段
  const getMultiDayWeekSegments = () => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const monthStartStr = `${year}-${pad(month + 1)}-01`
    const monthEndStr = `${year}-${pad(month + 1)}-${pad(daysInMonth)}`

    // 计算当前月1号所在的"全局周序号"
    const firstOfMonth = new Date(year, month, 1)
    const firstWeekSunday = new Date(firstOfMonth)
    firstWeekSunday.setDate(firstWeekSunday.getDate() - firstOfMonth.getDay())
    const toWeekIdx = (d: Date) => {
      return Math.floor((d.getTime() - firstWeekSunday.getTime()) / (7 * 86400000))
    }

    return multiDaySchedules.map(s => {
      const startStr = s.start_time.slice(0, 10)
      const endStr = s.end_time && s.end_time.length >= 10 ? s.end_time.slice(0, 10) : startStr
      const visStart = startStr >= monthStartStr ? startStr : monthStartStr
      const visEnd = endStr <= monthEndStr ? endStr : monthEndStr

      const segments: Array<{ weekIdx: number; startCol: number; span: number }> = []
      const cur = new Date(Number(visStart.split('-')[0]), Number(visStart.split('-')[1]) - 1, Number(visStart.split('-')[2]))
      const end = new Date(Number(visEnd.split('-')[0]), Number(visEnd.split('-')[1]) - 1, Number(visEnd.split('-')[2]))

      while (cur <= end) {
        const weekDay = cur.getDay()
        const weekIdx = toWeekIdx(cur)
        const daysLeftInWeek = 7 - weekDay
        const span = Math.min(daysLeftInWeek, Math.floor((end.getTime() - cur.getTime()) / 86400000) + 1)

        segments.push({ weekIdx, startCol: weekDay, span })
        cur.setDate(cur.getDate() + daysLeftInWeek)
      }

      return segments
    })
  }

  // 为每个跨天日程分配行号，避免重叠
  const multiDayLayout = useMemo(() => {
    const segments = getMultiDayWeekSegments()
    // 对每个 schedule 的所有 segments 分配同一个 row
    const rowAssignment: Record<string, number> = {}
    let maxRow = 0
    const weekRowOccupancy: Record<string, Set<number>> = {} // weekIdx-row -> set of occupied cols

    segments.forEach((schedSegments, sIdx) => {
      const s = multiDaySchedules[sIdx]
      // 找一个不冲突的行
      let row = 0
      let found = false
      while (!found) {
        const conflict = schedSegments.some(seg => {
          const key = `${seg.weekIdx}-${row}`
          if (!weekRowOccupancy[key]) weekRowOccupancy[key] = new Set()
          // 检查这一行在这一周的这个段范围是否有占用
          for (let c = seg.startCol; c < seg.startCol + seg.span; c++) {
            if (weekRowOccupancy[key].has(c)) return true
          }
          return false
        })
        if (conflict) {
          row++
        } else {
          found = true
        }
      }
      rowAssignment[s.id] = row
      maxRow = Math.max(maxRow, row + 1)
      // 标记占用
      schedSegments.forEach(seg => {
        const key = `${seg.weekIdx}-${row}`
        if (!weekRowOccupancy[key]) weekRowOccupancy[key] = new Set()
        for (let c = seg.startCol; c < seg.startCol + seg.span; c++) {
          weekRowOccupancy[key].add(c)
        }
      })
    })

    return { segments, rowAssignment, maxRows: maxRow }
  }, [multiDaySchedules, year, month, startPadding, daysInMonth])

  const resetForm = () => {
    setForm({
      title: '', content: '', start_time: '', end_time: '',
      start_time_value: '09:00', end_time_value: '10:00', is_all_day: true,
      is_reminder: false, reminder_type: 'popup', repeat_rule: null, plan_id: null
    })
    setEditingSchedule(null)
  }

  const handleSave = () => {
    if (!form.title.trim() || !form.start_time) return
    const finalEndTime = form.end_time || form.start_time
    const startH = form.is_all_day ? '00:00' : form.start_time_value
    const endH = form.is_all_day ? '00:00' : form.end_time_value
    const payload = {
      title: form.title,
      content: form.content,
      start_time: form.start_time + 'T' + startH,
      end_time: finalEndTime + 'T' + endH,
      is_all_day: form.is_all_day,
      is_reminder: form.is_reminder,
      reminder_type: form.reminder_type,
      repeat_rule: form.repeat_rule,
      plan_id: form.plan_id,
    }
    if (editingSchedule) {
      updateSchedule(editingSchedule.id, payload)
    } else {
      addSchedule({
        id: 'schedule-' + Date.now(), user_id: 'current-user', ...payload,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
    setShowModal(false)
    resetForm()
  }

  const handleDelete = (schedule: Schedule) => {
    deleteSchedule(schedule.id)
    addItem({ id: schedule.id, type: 'schedule', title: schedule.title, data: schedule })
    setConfirmDelete(null)
  }

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const today = new Date()
  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day

  const numWeeks = Math.ceil((startPadding + daysInMonth) / 7)

  const handleGridClick = (day: number) => {
    const date = new Date(year, month, day)
    const dateStr = toLocalDateStr(date)
    setSelectedDate(dateStr)
    setForm(prev => ({
      ...prev,
      start_time: dateStr,
      end_time: dateStr,
      start_time_value: '09:00',
      end_time_value: '10:00',
      is_all_day: true,
    }))
  }

  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

  return (
    <div className="page-container">
      <div className="max-w-5xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="page-title mb-0">日历日程</h1>
            <div className="flex items-center gap-2 bg-[var(--bg-secondary)] rounded-button border border-[var(--border-color)]">
              <button onClick={prevMonth} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-l-button">
                <ChevronLeft size={18} />
              </button>

              {/* 年份选择 */}
              <div className="relative">
                <button
                  onClick={() => { setShowYearPicker(!showYearPicker); setShowMonthPicker(false) }}
                  className="text-sm font-medium px-2 min-w-[60px] text-center hover:text-primary-600"
                >
                  {year}年
                </button>
                <AnimatePresence>
                  {showYearPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-40 max-h-60 overflow-auto bg-[var(--bg-secondary)] rounded-card shadow-soft-lg border border-[var(--border-color)] z-30 py-2"
                    >
                      {Array.from({ length: 21 }, (_, i) => year - 10 + i).map(y => (
                        <button key={y}
                          onClick={() => { setCurrentDate(new Date(y, month, 1)); setShowYearPicker(false) }}
                          className={`w-full px-4 py-2 text-sm text-left hover:bg-[var(--bg-tertiary)] transition-colors ${y === year ? 'text-primary-600 font-medium bg-primary-600/5' : 'text-[var(--text-primary)]'}`}>
                          {y}年
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 月份选择 */}
              <div className="relative">
                <button
                  onClick={() => { setShowMonthPicker(!showMonthPicker); setShowYearPicker(false) }}
                  className="text-sm font-medium px-2 min-w-[50px] text-center hover:text-primary-600"
                >
                  {month + 1}月
                </button>
                <AnimatePresence>
                  {showMonthPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-[var(--bg-secondary)] rounded-card shadow-soft-lg border border-[var(--border-color)] z-30 py-3 px-2"
                    >
                      <div className="grid grid-cols-3 gap-2">
                        {monthNames.map((m, idx) => (
                          <button key={idx}
                            onClick={() => { setCurrentDate(new Date(year, idx, 1)); setShowMonthPicker(false) }}
                            className={`w-full px-2 py-2 text-sm rounded-button hover:bg-[var(--bg-tertiary)] transition-colors text-center ${
                              idx === month ? 'text-primary-600 font-medium bg-primary-600/5' : 'text-[var(--text-primary)]'
                            }`}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button onClick={nextMonth} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-r-button">
                <ChevronRight size={18} />
              </button>
            </div>
            <button onClick={() => setCurrentDate(new Date())} className="text-sm text-primary-600 hover:underline">今天</button>
            {/* 视图切换 */}
            <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-button p-0.5 border border-[var(--border-color)]">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${viewMode === 'month' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
              >
                月
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${viewMode === 'day' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
              >
                日
              </button>
            </div>
          </div>
          <button onClick={() => { resetForm(); setShowModal(true) }} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> 新建日程
          </button>
        </div>

        {/* 日历网格 */}
        {viewMode === 'month' && (
        <><div className="card overflow-hidden">
          {/* 星期标题 */}
          <div className="grid grid-cols-7 gap-px bg-[var(--border-color)]">
            {weekDays.map(day => (
              <div key={day} className="bg-[var(--bg-secondary)] py-2 text-center text-sm font-medium text-[var(--text-secondary)]">{day}</div>
            ))}
          </div>

          {/* 每周独立渲染 */}
          {Array.from({ length: numWeeks }).map((_, weekIdx) => {
            const weekStart = weekIdx * 7 - startPadding

            // 本周内的跨天日程条
            const weekMultiDayBars = multiDaySchedules.flatMap((s, sIdx) => {
              const segs = multiDayLayout.segments[sIdx]
              const row = multiDayLayout.rowAssignment[s.id] ?? 0
              return segs
                .filter(seg => seg.weekIdx === weekIdx)
                .map(seg => ({ schedule: s, seg, row, sIdx }))
            })

            return (
              <div key={weekIdx}>
                {/* 第1行：日期数字行 - 固定高度 */}
                <div className="grid grid-cols-7 gap-px bg-[var(--border-color)]">
                  {Array.from({ length: 7 }).map((_, colIdx) => {
                    const day = weekStart + colIdx + 1
                    const isPadding = day <= 0 || day > daysInMonth
                    const todayFlag = !isPadding && isToday(day)

                    if (isPadding) {
                      return <div key={`pad-date-${weekIdx}-${colIdx}`} className="bg-[var(--bg-secondary)] h-8" />
                    }

                    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const allDaySchedules = getSchedulesForDay(day)
                    const hasEvents = allDaySchedules.length > 0

                    return (
                      <div
                        key={`date-${day}`}
                        onClick={() => handleGridClick(day)}
                        className={`bg-[var(--bg-secondary)] h-8 flex items-center justify-between px-2 cursor-pointer transition-all hover:bg-[var(--bg-tertiary)]/30 ${
                          todayFlag ? 'ring-2 ring-inset ring-primary-600' : ''
                        } ${selectedDate === dateKey ? 'bg-primary-50/50' : ''}`}
                      >
                        <span className={`text-sm font-medium ${todayFlag ? 'text-primary-600' : 'text-[var(--text-primary)]'}`}>{day}</span>
                        {hasEvents && <div className="w-1.5 h-1.5 rounded-full bg-primary-600" />}
                      </div>
                    )
                  })}
                </div>

                {/* 第2行：跨天日程条区域 - relative 定位 */}
                {weekMultiDayBars.length > 0 && (
                <div className="relative bg-[var(--bg-secondary)]" style={{ height: `${multiDayLayout.maxRows * 20 + 2}px` }}>
                  {weekMultiDayBars.map(({ schedule, seg, row, sIdx }) => {
                    const colorIdx = scheduleColorMap[schedule.id] ?? 0
                    const color = scheduleColors[colorIdx]
                    const startStr = schedule.start_time.slice(0, 10)
                    const endStr = schedule.end_time && schedule.end_time.length >= 10 ? schedule.end_time.slice(0, 10) : startStr
                    const allSegs = multiDayLayout.segments[sIdx]
                    const isFirstSeg = allSegs[0] === seg
                    const isLastSeg = allSegs[allSegs.length - 1] === seg
                    return (
                      <div
                        key={`${schedule.id}-${seg.weekIdx}`}
                        className={`absolute h-5 text-[10px] font-medium truncate px-2 flex items-center cursor-pointer hover:brightness-95 transition-all ${isFirstSeg ? 'rounded-l-md' : ''} ${isLastSeg ? 'rounded-r-none' : ''}`}
                        style={{
                          left: `${seg.startCol * (100 / 7)}%`,
                          width: `${seg.span * (100 / 7)}%`,
                          top: `${row * 20 + 1}px`,
                          backgroundColor: color.hex,
                          color: '#fff',
                          opacity: 0.82
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingSchedule(schedule)
                          setForm({
                            title: schedule.title, content: schedule.content,
                            start_time: schedule.start_time.slice(0, 10), end_time: schedule.end_time.slice(0, 10),
                            start_time_value: schedule.start_time.slice(11, 16) || '00:00',
                            end_time_value: schedule.end_time.slice(11, 16) || '00:00',
                            is_all_day: schedule.is_all_day || (schedule.start_time.slice(11, 16) === '00:00' && schedule.end_time.slice(11, 16) === '00:00'),
                            is_reminder: schedule.is_reminder, reminder_type: schedule.reminder_type,
                            repeat_rule: schedule.repeat_rule, plan_id: schedule.plan_id
                          })
                          setShowModal(true)
                        }}
                        title={`${schedule.title} (${startStr} - ${endStr})`}
                      >
                        {schedule.title}
                      </div>
                    )
                  })}
                </div>
                )}

                {/* 第3行：单天日程区域 */}
                <div className="grid grid-cols-7 gap-px bg-[var(--border-color)]">
                  {Array.from({ length: 7 }).map((_, colIdx) => {
                    const day = weekStart + colIdx + 1
                    const isPadding = day <= 0 || day > daysInMonth

                    if (isPadding) {
                      return <div key={`pad-sched-${weekIdx}-${colIdx}`} className="bg-[var(--bg-secondary)] min-h-[80px]" />
                    }

                    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const allDaySchedules = getSchedulesForDay(day)
                    const daySchedules = allDaySchedules.filter(s => {
                      const startStr = s.start_time.slice(0, 10)
                      const endStr = s.end_time && s.end_time.length >= 10 ? s.end_time.slice(0, 10) : startStr
                      return startStr === endStr
                    })

                    return (
                      <div
                        key={`sched-${day}`}
                        onClick={() => handleGridClick(day)}
                        className={`bg-[var(--bg-secondary)] min-h-[80px] p-2 cursor-pointer transition-all hover:bg-[var(--bg-tertiary)]/30 ${
                          selectedDate === dateKey ? 'bg-primary-50/50' : ''
                        }`}
                      >
                        {daySchedules.length > 0 && (
                        <div className="space-y-1">
                          {daySchedules.slice(0, 4).map(s => {
                            const colorIdx = scheduleColorMap[s.id] ?? 0
                            const color = scheduleColors[colorIdx]
                            const startH = Number(s.start_time.slice(11, 13)) || 0
                            const startM = Number(s.start_time.slice(14, 16)) || 0
                            const timeStr = (startH === 0 && startM === 0) ? '' : `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`
                            return (
                              <div
                                key={s.id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingSchedule(s)
                                  setForm({
                                    title: s.title, content: s.content,
                                    start_time: s.start_time.slice(0, 10), end_time: s.end_time.slice(0, 10),
                                    start_time_value: s.start_time.slice(11, 16) || '00:00',
                                    end_time_value: s.end_time.slice(11, 16) || '00:00',
                                    is_all_day: s.is_all_day || (s.start_time.slice(11, 16) === '00:00' && s.end_time.slice(11, 16) === '00:00'),
                                    is_reminder: s.is_reminder, reminder_type: s.reminder_type,
                                    repeat_rule: s.repeat_rule, plan_id: s.plan_id
                                  })
                                  setShowModal(true)
                                }}
                                className={`relative text-[10px] px-1.5 py-0.5 rounded-l-md rounded-r-none truncate cursor-pointer font-medium ${color.light} ${color.text}`}
                                style={{ borderLeft: `2px solid ${color.hex}` }}
                                title={`${s.title} ${timeStr}`}
                              >
                                {timeStr}{timeStr ? ' ' : ''}{s.title}
                              </div>
                            )
                          })}
                          {daySchedules.length > 4 && (
                            <div className="text-[10px] text-[var(--text-tertiary)] pl-1">+{daySchedules.length - 4}</div>
                          )}
                        </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* 日程列表 */}
        <div className="mt-6">
          <h2 className="section-title">
            {selectedDate ? `${selectedDate} 的日程` : '本月日程'}
          </h2>
          <div className="space-y-3">
            <AnimatePresence>
              {(selectedDate
                ? monthSchedules.filter(s => {
                    const startStr = s.start_time.slice(0, 10)
                    const endStr = s.end_time && s.end_time.length >= 10 ? s.end_time.slice(0, 10) : startStr
                    return selectedDate >= startStr && selectedDate <= endStr
                  })
                : monthSchedules
              ).map(schedule => {
                const colorIdx = scheduleColorMap[schedule.id] ?? 0
                const color = scheduleColors[colorIdx]
                const startStr = schedule.start_time.slice(0, 10)
                const endStr = schedule.end_time && schedule.end_time.length >= 10 ? schedule.end_time.slice(0, 10) : startStr
                const isMultiDay = startStr !== endStr
                return (
                  <motion.div key={schedule.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="card-hover" style={{ borderLeft: `3px solid ${color.hex}` }}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-20 text-center flex-shrink-0">
                          <p className="text-lg font-bold" style={{ color: color.hex }}>
                            {Number(startStr.split('-')[2])}
                          </p>
                          {(() => {
                            const timePart = schedule.start_time.slice(11, 16)
                            return timePart !== '00:00' && <p className="text-xs text-[var(--text-tertiary)]">{timePart}</p>
                          })()}
                          {isMultiDay && (
                            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                              {startStr} 至 {endStr}
                            </p>
                          )}
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-[var(--text-primary)]">{schedule.title}</h3>
                          {schedule.content && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{schedule.content}</p>}
                          {schedule.plan_id && (
                            <div className="flex items-center gap-1 mt-1">
                              <Target size={12} className="text-primary-600" />
                              <span className="text-xs text-primary-600">关联规划: {plans.find(p => p.id === schedule.plan_id)?.title || '未知'}</span>
                            </div>
                          )}
                          {schedule.is_reminder && (
                            <span className="tag-pill text-xs mt-1 inline-flex">
                              {schedule.reminder_type === 'popup' ? '弹窗提醒' : schedule.reminder_type === 'system' ? '系统通知' : '双重提醒'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => {
                          setEditingSchedule(schedule)
                          setForm({
                            title: schedule.title, content: schedule.content,
                            start_time: schedule.start_time.slice(0, 10), end_time: schedule.end_time.slice(0, 10),
                            start_time_value: schedule.start_time.slice(11, 16) || '00:00',
                            end_time_value: schedule.end_time.slice(11, 16) || '00:00',
                            is_all_day: schedule.is_all_day || (schedule.start_time.slice(11, 16) === '00:00' && schedule.end_time.slice(11, 16) === '00:00'),
                            is_reminder: schedule.is_reminder, reminder_type: schedule.reminder_type,
                            repeat_rule: schedule.repeat_rule, plan_id: schedule.plan_id
                          })
                          setShowModal(true)
                        }} className="p-1.5 rounded-button hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"><Edit size={15} /></button>
                        <button onClick={() => setConfirmDelete(schedule.id)}
                          className="p-1.5 rounded-button hover:bg-red-50 text-[var(--text-tertiary)] hover:text-danger"><Trash size={15} /></button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {(selectedDate
              ? monthSchedules.filter(s => {
                  const startStr = s.start_time.slice(0, 10)
                  const endStr = s.end_time && s.end_time.length >= 10 ? s.end_time.slice(0, 10) : startStr
                  return selectedDate >= startStr && selectedDate <= endStr
                })
              : monthSchedules
            ).length === 0 && (
              <div className="empty-state">
                <CalendarIcon size={48} className="text-[var(--text-tertiary)] mb-3" />
                <p className="text-[var(--text-secondary)]">暂无日程</p>
              </div>
            )}
          </div>
        </div></>
        )}

        {/* 日视图 */}
        {viewMode === 'day' && (
          <div className="flex gap-4">
            {/* 左侧：时间线 */}
            <div className="flex-[2] card p-4 min-w-0 flex flex-col">
              {/* 日视图头部 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedDayDate(new Date(selectedDayDate.getTime() - 86400000))}
                    className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-md"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-lg font-semibold text-[var(--text-primary)]">
                    {selectedDayDate.getFullYear()}年{selectedDayDate.getMonth() + 1}月{selectedDayDate.getDate()}日
                  </span>
                  <button
                    onClick={() => setSelectedDayDate(new Date(selectedDayDate.getTime() + 86400000))}
                    className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-md"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <button
                  onClick={() => setSelectedDayDate(new Date())}
                  className="text-sm text-primary-600 hover:underline"
                >
                  今天
                </button>
              </div>

              {/* 24小时时间线 - 绝对定位布局，每小时48px，默认显示工作时间范围 */}
              {(() => {
                const HOUR_HEIGHT = 48
                const TOTAL_HEIGHT = 24 * HOUR_HEIGHT
                const now = new Date()
                const isToday = selectedDayDate.getFullYear() === now.getFullYear() && selectedDayDate.getMonth() === now.getMonth() && selectedDayDate.getDate() === now.getDate()
                // 默认滚动到8:00的位置
                const defaultScroll = 8 * HOUR_HEIGHT
                return (
                <div
                  className="flex-1 overflow-y-auto border-t border-[var(--border-color)] relative"
                  style={{ maxHeight: 560 }}
                  ref={(el) => {
                    if (el && !el.dataset.scrolled) {
                      el.scrollTop = isToday ? Math.max(0, now.getHours() * HOUR_HEIGHT - 100) : defaultScroll
                      el.dataset.scrolled = '1'
                    }
                  }}
                >
                <div
                  className="relative"
                  style={{ height: TOTAL_HEIGHT }}
                  onClick={(e) => {
                    const target = e.currentTarget
                    const rect = target.getBoundingClientRect()
                    const container = target.parentElement
                    const scrollTop = container ? container.scrollTop : 0
                    const y = e.clientY - rect.top + scrollTop
                    const clickedMinutes = Math.floor(y / HOUR_HEIGHT * 60)
                    const hour = Math.floor(clickedMinutes / 60)
                    if (hour < 0 || hour > 23) return
                    const date = new Date(selectedDayDate)
                    const dateStr = toLocalDateStr(date)
                    const startH = String(hour).padStart(2, '0') + ':00'
                    const endH = String(Math.min(hour + 1, 23)).padStart(2, '0') + ':00'
                    setSelectedDate(dateStr)
                    setForm(prev => ({
                      ...prev,
                      start_time: dateStr,
                      end_time: dateStr,
                      start_time_value: startH,
                      end_time_value: endH,
                      is_all_day: false,
                    }))
                    setShowModal(true)
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const data = e.dataTransfer.getData('application/json')
                    if (!data) return
                    try {
                      const parsed = JSON.parse(data)
                      const target = e.currentTarget
                      const rect = target.getBoundingClientRect()
                      const container = target.parentElement
                      const scrollTop = container ? container.scrollTop : 0
                      const y = e.clientY - rect.top + scrollTop
                      const dropMinutes = Math.max(0, Math.min(1439, Math.floor(y / HOUR_HEIGHT * 60)))
                      const dropHour = Math.floor(dropMinutes / 60)
                      const dropMin = dropMinutes % 60
                      const date = new Date(selectedDayDate)
                      const dateStr = toLocalDateStr(date)
                      const pad = (n: number) => String(n).padStart(2, '0')
                      const startTime = `${pad(dropHour)}:${pad(dropMin)}`
                      const endHour = Math.min(dropHour + 1, 23)
                      const endTime = `${pad(endHour)}:${pad(dropMin)}`
                      setSelectedDate(dateStr)
                      if (parsed.type === 'task') {
                        setForm(prev => ({
                          ...prev,
                          title: parsed.item.title,
                          content: parsed.item.description || '',
                          start_time: dateStr,
                          end_time: dateStr,
                          start_time_value: startTime,
                          end_time_value: endTime,
                          is_all_day: false,
                        }))
                      } else if (parsed.type === 'schedule') {
                        const s = parsed.item
                        const sStartMin = (parseInt(s.start_time.slice(11, 13)) || 0) * 60 + (parseInt(s.start_time.slice(14, 16)) || 0)
                        const sEndMin = s.end_time ? (parseInt(s.end_time.slice(11, 13)) || 0) * 60 + (parseInt(s.end_time.slice(14, 16)) || 0) : sStartMin + 60
                        const duration = sEndMin - sStartMin
                        const endDropMin = Math.min(dropMinutes + Math.max(duration, 60), 1439)
                        const endH = Math.floor(endDropMin / 60)
                        const endM = endDropMin % 60
                        setForm(prev => ({
                          ...prev,
                          title: s.title,
                          content: s.content || '',
                          start_time: dateStr,
                          end_time: dateStr,
                          start_time_value: startTime,
                          end_time_value: `${pad(endH)}:${pad(endM)}`,
                          is_all_day: s.is_all_day || false,
                        }))
                      }
                      setShowModal(true)
                    } catch {
                      // ignore invalid drop data
                    }
                  }}
                >
                  {/* 左侧时间标签 + 每小时网格背景 */}
                  {Array.from({ length: 24 }).map((_, hour) => (
                    <div key={hour} className="flex border-b border-[var(--border-color)]" style={{ height: HOUR_HEIGHT }}>
                      <div className="w-14 flex-shrink-0 py-1 px-2 text-xs text-[var(--text-tertiary)] text-right border-r border-[var(--border-color)] bg-[var(--bg-secondary)]/50">
                        {String(hour).padStart(2, '0')}:00
                      </div>
                      <div className="flex-1 relative" />
                    </div>
                  ))}

                  {/* 绝对定位的日程条 */}
                  {(() => {
                    const pad = (n: number) => String(n).padStart(2, '0')
                    const dayStr = `${selectedDayDate.getFullYear()}-${pad(selectedDayDate.getMonth() + 1)}-${pad(selectedDayDate.getDate())}`
                    const daySchedules = monthSchedules.filter(s => {
                      const startStr = s.start_time.slice(0, 10)
                      const endStr = s.end_time && s.end_time.length >= 10 ? s.end_time.slice(0, 10) : startStr
                      const inDayRange = dayStr >= startStr && dayStr <= endStr
                      if (!inDayRange) return false
                      const isAllDay = s.is_all_day || (s.start_time.slice(11, 16) === '00:00' && (!s.end_time || s.end_time.slice(11, 16) === '00:00'))
                      return !isAllDay
                    })

                    type LayoutSchedule = Schedule & {
                      startMinutes: number
                      endMinutes: number
                      duration: number
                      col: number
                      totalCols: number
                    }

                    function computeScheduleLayout(schedules: Schedule[]): LayoutSchedule[] {
                      const computed = schedules.map(s => {
                        const startH = parseInt(s.start_time.slice(11, 13)) || 0
                        const startM = parseInt(s.start_time.slice(14, 16)) || 0
                        const endH = s.end_time ? (parseInt(s.end_time.slice(11, 13)) || 0) : startH
                        const endM = s.end_time ? (parseInt(s.end_time.slice(14, 16)) || 0) : startM
                        const startMinutes = startH * 60 + startM
                        const endMinutes = endH * 60 + endM
                        const duration = Math.max(endMinutes - startMinutes, 15)
                        return { ...s, startMinutes, endMinutes, duration, col: 0, totalCols: 1 }
                      })
                      computed.sort((a, b) => a.startMinutes - b.startMinutes)
                      const columns: LayoutSchedule[] = []
                      for (const item of computed) {
                        let placed = false
                        for (let i = 0; i < columns.length; i++) {
                          if (columns[i].endMinutes <= item.startMinutes) {
                            item.col = i
                            columns[i] = item
                            placed = true
                            break
                          }
                        }
                        if (!placed) {
                          item.col = columns.length
                          columns.push(item)
                        }
                      }
                      for (const item of computed) {
                        let maxCol = item.col
                        for (const other of computed) {
                          if (other.id === item.id) continue
                          if (other.startMinutes < item.endMinutes && other.endMinutes > item.startMinutes) {
                            maxCol = Math.max(maxCol, other.col)
                          }
                        }
                        item.totalCols = maxCol + 1
                      }
                      return computed
                    }

                    const layout = computeScheduleLayout(daySchedules)

                    return layout.map(s => {
                      const colorIdx = scheduleColorMap[s.id] ?? 0
                      const color = scheduleColors[colorIdx]
                      const top = s.startMinutes / 60 * HOUR_HEIGHT
                      const height = s.duration / 60 * HOUR_HEIGHT
                      const left = `calc(56px + ${s.col} * (100% - 56px) / ${s.totalCols})`
                      const width = `calc((100% - 56px) / ${s.totalCols})`
                      const startStr = `${pad(Math.floor(s.startMinutes / 60))}:${pad(s.startMinutes % 60)}`
                      const endStr = `${pad(Math.floor(s.endMinutes / 60))}:${pad(s.endMinutes % 60)}`
                      return (
                        <div
                          key={s.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingSchedule(s)
                            setForm({
                              title: s.title,
                              content: s.content,
                              start_time: s.start_time.slice(0, 10),
                              end_time: s.end_time ? s.end_time.slice(0, 10) : s.start_time.slice(0, 10),
                              start_time_value: s.start_time.slice(11, 16) || '00:00',
                              end_time_value: s.end_time ? s.end_time.slice(11, 16) : s.start_time.slice(11, 16) || '00:00',
                              is_all_day: s.is_all_day || (s.start_time.slice(11, 16) === '00:00' && (!s.end_time || s.end_time.slice(11, 16) === '00:00')),
                              is_reminder: s.is_reminder,
                              reminder_type: s.reminder_type,
                              repeat_rule: s.repeat_rule,
                              plan_id: s.plan_id
                            })
                            setShowModal(true)
                          }}
                          className={`absolute rounded-md cursor-pointer hover:brightness-95 overflow-hidden px-2 py-1 text-xs font-medium ${color.light} ${color.text}`}
                          style={{
                            top,
                            height,
                            left,
                            width,
                            borderLeft: `3px solid ${color.hex}`,
                            minHeight: 20,
                          }}
                          title={`${s.title} (${startStr} - ${endStr})`}
                        >
                          <div className="truncate leading-tight">{s.title}</div>
                          <div className="text-[10px] text-[var(--text-tertiary)] leading-tight mt-0.5">
                            {startStr} - {endStr}
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
                )
                })()}
            </div>

            {/* 右侧：全天日程 + 任务待办 */}
            <div className="flex-1 flex flex-col gap-4 min-w-[260px] max-w-[320px]">
              {/* 全天日程 */}
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary-600" />
                  全天日程
                </h3>
                {(() => {
                  const pad = (n: number) => String(n).padStart(2, '0')
                  const dayStr = `${selectedDayDate.getFullYear()}-${pad(selectedDayDate.getMonth() + 1)}-${pad(selectedDayDate.getDate())}`
                  const allDaySchedules = monthSchedules.filter(s => {
                    const startStr = s.start_time.slice(0, 10)
                    const endStr = s.end_time && s.end_time.length >= 10 ? s.end_time.slice(0, 10) : startStr
                    const inDayRange = dayStr >= startStr && dayStr <= endStr
                    if (!inDayRange) return false
                    const isAllDay = s.is_all_day || (s.start_time.slice(11, 16) === '00:00' && (!s.end_time || s.end_time.slice(11, 16) === '00:00'))
                    return isAllDay
                  })
                  if (allDaySchedules.length === 0) {
                    return <p className="text-xs text-[var(--text-tertiary)] text-center py-3">无全天日程</p>
                  }
                  return (
                    <div className="space-y-2">
                      {allDaySchedules.map(s => {
                        const colorIdx = scheduleColorMap[s.id] ?? 0
                        const color = scheduleColors[colorIdx]
                        return (
                          <div
                            key={s.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/json', JSON.stringify({ type: 'schedule', item: s }))
                            }}
                            onClick={() => {
                              setEditingSchedule(s)
                              setForm({
                                title: s.title, content: s.content,
                                start_time: s.start_time.slice(0, 10),
                                end_time: s.end_time ? s.end_time.slice(0, 10) : s.start_time.slice(0, 10),
                                start_time_value: s.start_time.slice(11, 16) || '00:00',
                                end_time_value: s.end_time ? s.end_time.slice(11, 16) : s.start_time.slice(11, 16) || '00:00',
                                is_all_day: s.is_all_day || (s.start_time.slice(11, 16) === '00:00' && (!s.end_time || s.end_time.slice(11, 16) === '00:00')),
                                is_reminder: s.is_reminder, reminder_type: s.reminder_type,
                                repeat_rule: s.repeat_rule, plan_id: s.plan_id
                              })
                              setShowModal(true)
                            }}
                            className="flex items-center gap-2 p-2.5 rounded-md cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
                            style={{ borderLeft: `3px solid ${color.hex}` }}
                          >
                            <span className="text-sm text-[var(--text-primary)] truncate flex-1">{s.title}</span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>

              {/* 任务待办 */}
              <div className="card p-4 flex-1">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent" />
                  任务待办
                </h3>
                <div className="space-y-1.5">
                  {tasks.filter(t => !t.is_completed && !t.deleted_at).length === 0 ? (
                    <p className="text-xs text-[var(--text-tertiary)] text-center py-3">暂无待办</p>
                  ) : (
                    tasks.filter(t => !t.is_completed && !t.deleted_at).map(task => (
                      <div key={task.id}>
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'task', item: task }))
                          }}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors group"
                          onClick={() => {
                            const date = new Date(selectedDayDate)
                            const dateStr = toLocalDateStr(date)
                            setSelectedDate(dateStr)
                            setForm(prev => ({
                              ...prev,
                              title: task.title,
                              content: task.description || '',
                              start_time: dateStr,
                              end_time: dateStr,
                              start_time_value: '09:00',
                              end_time_value: '10:00',
                              is_all_day: false,
                            }))
                            setShowModal(true)
                          }}
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); updateTask(task.id, { is_completed: true }) }}
                            className="w-4 h-4 rounded border border-[var(--border-color)] flex-shrink-0 hover:border-primary-600 flex items-center justify-center"
                          />
                          <span className="text-sm text-[var(--text-primary)] truncate flex-1">{task.title}</span>
                        </div>
                        {task.subtasks && task.subtasks.length > 0 && (
                          <div className="ml-6 mt-0.5 space-y-0.5">
                            {task.subtasks.map(sub => (
                              <div
                                key={sub.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('application/json', JSON.stringify({
                                    type: 'task',
                                    item: {
                                      ...task,
                                      title: `${task.title} - ${sub.title}`,
                                      description: task.description,
                                    }
                                  }))
                                }}
                                className="flex items-center gap-2 p-1.5 rounded-md hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors group"
                                onClick={() => {
                                  const date = new Date(selectedDayDate)
                                  const dateStr = toLocalDateStr(date)
                                  setSelectedDate(dateStr)
                                  setForm(prev => ({
                                    ...prev,
                                    title: `${task.title} - ${sub.title}`,
                                    content: task.description || '',
                                    start_time: dateStr,
                                    end_time: dateStr,
                                    start_time_value: '09:00',
                                    end_time_value: '10:00',
                                    is_all_day: false,
                                  }))
                                  setShowModal(true)
                                }}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const updatedSubtasks = task.subtasks.map(s =>
                                      s.id === sub.id ? { ...s, is_completed: !s.is_completed } : s
                                    )
                                    updateTask(task.id, { subtasks: updatedSubtasks })
                                  }}
                                  className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${sub.is_completed ? 'bg-primary-600 border-primary-600' : 'border-[var(--border-color)] hover:border-primary-600'}`}
                                >
                                  {sub.is_completed && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                </button>
                                <span className={`text-xs truncate flex-1 ${sub.is_completed ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-secondary)]'}`}>{sub.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 新建/编辑弹窗 */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm() }}
        title={editingSchedule ? '编辑日程' : '新建日程'}
        footer={<>
          <button onClick={() => { setShowModal(false); resetForm() }} className="btn-secondary">取消</button>
          <button onClick={handleSave} className="btn-primary">{editingSchedule ? '保存' : '创建'}</button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">标题</label>
            <input type="text" value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} placeholder="日程标题" className="input-dark" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">详情</label>
            <textarea value={form.content} onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))} placeholder="详情（可选）" rows={2} className="input-dark resize-none" />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <input
              type="checkbox"
              id="is_all_day"
              checked={form.is_all_day}
              onChange={e => setForm(prev => ({ ...prev, is_all_day: e.target.checked }))}
              className="w-4 h-4 rounded text-primary-600"
            />
            <label htmlFor="is_all_day" className="text-sm text-[var(--text-secondary)]">全天日程</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">开始日期</label>
              <input type="date" value={form.start_time} onChange={e => setForm(prev => ({ ...prev, start_time: e.target.value }))} className="input-dark" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">结束日期</label>
              <input type="date" value={form.end_time} onChange={e => setForm(prev => ({ ...prev, end_time: e.target.value }))} className="input-dark" />
            </div>
          </div>
          {!form.is_all_day && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">开始时间</label>
                <input type="time" value={form.start_time_value} onChange={e => setForm(prev => ({ ...prev, start_time_value: e.target.value }))} className="input-dark" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">结束时间</label>
                <input type="time" value={form.end_time_value} onChange={e => setForm(prev => ({ ...prev, end_time_value: e.target.value }))} className="input-dark" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5">关联规划</label>
            <select value={form.plan_id || ''} onChange={e => setForm(prev => ({ ...prev, plan_id: e.target.value || null }))} className="input-dark">
              <option value="">不关联</option>
              {plans.filter(p => !p.deleted_at).map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input type="checkbox" checked={form.is_reminder}
                onChange={e => setForm(prev => ({ ...prev, is_reminder: e.target.checked }))}
                className="w-4 h-4 rounded text-primary-600" />
              开启提醒
            </label>
            {form.is_reminder && (
              <select value={form.reminder_type || 'popup'}
                onChange={e => setForm(prev => ({ ...prev, reminder_type: e.target.value as Schedule['reminder_type'] }))}
                className="input-dark text-sm py-1.5">
                <option value="popup">弹窗提醒</option>
                <option value="system">系统通知</option>
                <option value="both">双重提醒</option>
              </select>
            )}
          </div>
        </div>
      </Modal>

      {/* 删除确认 */}
      {confirmDelete && (
        <ConfirmDialog isOpen={true} onClose={() => setConfirmDelete(null)}
          onConfirm={() => { const s = schedules.find(sch => sch.id === confirmDelete); if (s) handleDelete(s) }}
          title="确认删除" message="删除后日程将进入回收站。" type="danger" />
      )}
    </div>
  )
}

export default CalendarPage
