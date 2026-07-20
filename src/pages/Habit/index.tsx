import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHabitStore, useAppStore } from '@/store'
import { motion, AnimatePresence } from 'framer-motion'
import Modal from '@/components/Modal/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import {
  Plus, TrendingUp, Check, Trash, Edit, BarChart2,
  Download, X
} from '@/utils/icons'
import type { Habit } from '@/types'
import { generateUUID } from '@/lib/utils'

const HabitPage: React.FC = () => {
  const navigate = useNavigate()
  const { habits, addHabit, updateHabit, deleteHabit, checkin, uncheckin } = useHabitStore()
  const { user } = useAppStore()
  const [showModal, setShowModal] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showChart, setShowChart] = useState<string | null>(null)
  const [checkinNote, setCheckinNote] = useState('')
  const [checkinHabitId, setCheckinHabitId] = useState<string | null>(null)
  const [checkinDate, setCheckinDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const chartRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({ name: '', type: 'positive' as Habit['type'] })

  const activeHabits = habits.filter(h => !h.deleted_at)
  const today = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const resetForm = () => {
    setForm({ name: '', type: 'positive' })
    setEditingHabit(null)
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    if (editingHabit) {
      updateHabit(editingHabit.id, { name: form.name, type: form.type })
    } else {
      addHabit({
        id: generateUUID(),
        user_id: user?.id || 'current-user',
        name: form.name,
        type: form.type,
        checkins: [],
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
    setShowModal(false)
    resetForm()
  }

  const handleCheckin = () => {
    if (!checkinHabitId || !checkinDate) return
    checkin(checkinHabitId, checkinDate, checkinNote)
    setCheckinHabitId(null)
    setCheckinNote('')
    const d = new Date()
    setCheckinDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }

  const openCheckin = (habitId: string, date?: string) => {
    setCheckinHabitId(habitId)
    const d = date ? new Date(date + 'T00:00:00') : new Date()
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setCheckinDate(ds)
    const habit = habits.find(h => h.id === habitId)
    const existing = habit?.checkins.find(c => c.date === ds)
    setCheckinNote(existing?.note || '')
  }

  // ===== 数据统计计算 =====
  const getStats = (habit: Habit) => {
    const checkinMap = new Map(habit.checkins.map(c => [c.date, c]))
    const dates = habit.checkins.map(c => c.date).sort()

    // 最长连续天数
    let maxStreak = 0
    let currentStreak = 0
    let prevDate: Date | null = null
    for (const dateStr of dates) {
      const d = new Date(dateStr + 'T00:00:00')
      if (prevDate) {
        const diff = (d.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000)
        if (diff === 1) currentStreak++
        else currentStreak = 1
      } else {
        currentStreak = 1
      }
      prevDate = d
      maxStreak = Math.max(maxStreak, currentStreak)
    }

    // 当前连续天数
    let nowStreak = 0
    for (let i = 0; i < 365; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (checkinMap.has(ds)) nowStreak++
      else if (i > 0) break
    }

    // 距离上次（天数）
    let daysSinceLast = -1
    if (dates.length > 0) {
      const last = new Date(dates[dates.length - 1] + 'T00:00:00')
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      daysSinceLast = Math.floor((now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000))
    }

    // 平均间隔
    let avgInterval = 0
    if (dates.length >= 2) {
      const first = new Date(dates[0] + 'T00:00:00').getTime()
      const last = new Date(dates[dates.length - 1] + 'T00:00:00').getTime()
      const daysSpan = (last - first) / (24 * 60 * 60 * 1000)
      avgInterval = Math.round((daysSpan / (dates.length - 1)) * 10) / 10
    }

    // 本周/本月/本年统计
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const yearStart = new Date(now.getFullYear(), 0, 1)

    const weekCount = dates.filter(d => new Date(d + 'T00:00:00') >= weekStart).length
    const monthCount = dates.filter(d => new Date(d + 'T00:00:00') >= monthStart).length
    const yearCount = dates.filter(d => new Date(d + 'T00:00:00') >= yearStart).length

    // 近 N 天完成率（仅积极习惯有意义）
    const getRate = (days: number) => {
      let count = 0
      for (let i = 0; i < days; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        if (checkinMap.has(ds)) count++
      }
      return Math.round((count / days) * 100)
    }

    // 星期分布
    const weekDays = [0, 0, 0, 0, 0, 0, 0]
    for (const c of habit.checkins) {
      const day = new Date(c.date + 'T00:00:00').getDay()
      weekDays[day]++
    }
    const weekDayMax = Math.max(...weekDays, 1)

    // 近12个月趋势
    const monthlyTrend: { label: string; count: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const count = dates.filter(dateStr => {
        const dd = new Date(dateStr + 'T00:00:00')
        return dd.getFullYear() === d.getFullYear() && dd.getMonth() === d.getMonth()
      }).length
      monthlyTrend.push({ label, count })
    }
    const monthMax = Math.max(...monthlyTrend.map(m => m.count), 1)

    // 近90天每日状态（用于热力图）
    const last90Days = Array.from({ length: 90 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (89 - i))
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })

    return {
      maxStreak, nowStreak, daysSinceLast, avgInterval,
      weekCount, monthCount, yearCount,
      rate7: getRate(7), rate30: getRate(30), rate90: getRate(90),
      weekDays, weekDayMax, monthlyTrend, monthMax,
      last90Days, checkinMap
    }
  }

  const exportChart = async () => {
    if (!chartRef.current) return
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(chartRef.current)
    const link = document.createElement('a')
    link.download = `习惯记录总结_${today}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  return (
    <div className="page-container">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title mb-1">习惯记录</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {activeHabits.length} 个记录项 · 今日已记录 {activeHabits.filter(h => h.checkins.find(c => c.date === today)).length} 个
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/habit/stats')} className="text-sm text-[#6B4C9A] hover:text-[#5a3f85] flex items-center gap-1">
              <BarChart2 size={16} />
              <span>数据统计</span>
            </button>
            <button onClick={() => { resetForm(); setShowModal(true) }} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> 新建记录项
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <AnimatePresence>
            {activeHabits.map((habit) => {
              const todayCheckin = habit.checkins.find(c => c.date === today)
              const streak = (() => {
                let s = 0
                for (let i = 0; i < 365; i++) {
                  const d = new Date()
                  d.setDate(d.getDate() - i)
                  const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                  if (habit.checkins.find(c => c.date === ds)) s++
                  else if (i > 0) break
                }
                return s
              })()

              // 距离上次
              let daysSinceLast = -1
              const sorted = habit.checkins.map(c => c.date).sort()
              if (sorted.length > 0) {
                const last = new Date(sorted[sorted.length - 1] + 'T00:00:00')
                const now = new Date()
                now.setHours(0, 0, 0, 0)
                daysSinceLast = Math.floor((now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000))
              }

              return (
                <motion.div key={habit.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="card-hover">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-[var(--text-primary)]">{habit.name}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          habit.type === 'positive' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                        }`}>
                          {habit.type === 'positive' ? '积极' : '消极'}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {habit.type === 'positive'
                          ? `连续 ${streak} 天 · 总计 ${habit.checkins.length} 次`
                          : daysSinceLast >= 0
                            ? `距离上次 ${daysSinceLast} 天 · 总计 ${habit.checkins.length} 次`
                            : `总计 ${habit.checkins.length} 次`
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setShowChart(habit.id)}
                        className="p-1.5 rounded-button hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
                        <BarChart2 size={15} />
                      </button>
                      <button onClick={() => {
                        setEditingHabit(habit)
                        setForm({ name: habit.name, type: habit.type })
                        setShowModal(true)
                      }} className="p-1.5 rounded-button hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
                        <Edit size={15} />
                      </button>
                      <button onClick={() => setConfirmDelete(habit.id)}
                        className="p-1.5 rounded-button hover:bg-red-50 text-[var(--text-tertiary)] hover:text-danger">
                        <Trash size={15} />
                      </button>
                    </div>
                  </div>

                  {/* 最近7天记录状态 - 可点击补录/取消 */}
                  <div className="flex items-center gap-1.5 mb-3">
                    {Array.from({ length: 7 }, (_, i) => {
                      const d = new Date()
                      d.setDate(d.getDate() - (6 - i))
                      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                      const checked = habit.checkins.find(c => c.date === ds)
                      const isToday = i === 6
                      return (
                        <div key={i} className="flex-1 text-center relative">
                          <button
                            onClick={() => checked ? uncheckin(habit.id, ds) : openCheckin(habit.id, ds)}
                            className={`w-8 h-8 mx-auto rounded-button flex items-center justify-center text-xs font-medium transition-all hover:scale-105 ${
                              checked
                                ? habit.type === 'positive' ? 'bg-success text-white' : 'bg-warning text-white'
                                : isToday
                                  ? 'border-2 border-dashed border-primary-600 text-primary-600'
                                  : 'bg-[var(--bg-primary)] text-[var(--text-tertiary)]'
                            }`}
                            title={checked ? '点击取消记录' : '点击补录'}
                          >
                            {checked ? <Check size={14} /> : d.getDate()}
                          </button>
                          <span className="text-[10px] text-[var(--text-tertiary)] mt-0.5 block">
                            {['日', '一', '二', '三', '四', '五', '六'][d.getDay()]}
                          </span>
                          {checked && (
                            <button
                              onClick={() => uncheckin(habit.id, ds)}
                              className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-danger rounded-full text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                              title="取消记录"
                            >
                              <X size={8} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* 今日备注预览 */}
                  {todayCheckin && todayCheckin.note && (
                    <div className="bg-[var(--bg-secondary)] rounded-button p-2 mb-2">
                      <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-all leading-relaxed">{todayCheckin.note}</p>
                    </div>
                  )}

                  {!todayCheckin ? (
                    <button onClick={() => openCheckin(habit.id)}
                      className="w-full btn-primary py-2 text-sm flex items-center justify-center gap-1.5">
                      <Check size={16} /> 今日记录
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => openCheckin(habit.id)}
                        className="flex-1 py-2 text-sm text-center text-success bg-success/10 rounded-button hover:bg-success/20 transition-colors">
                        今日已记录
                      </button>
                      <button onClick={() => uncheckin(habit.id, today)}
                        className="px-3 py-2 text-sm text-danger bg-danger/10 rounded-button hover:bg-danger/20 transition-colors"
                        title="取消今日记录">
                        取消
                      </button>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {activeHabits.length === 0 && (
          <div className="empty-state">
            <TrendingUp size={48} className="text-[var(--text-tertiary)] mb-3" />
            <p className="text-[var(--text-secondary)]">还没有记录项，开始创建一个吧</p>
            <button onClick={() => { resetForm(); setShowModal(true) }} className="btn-primary mt-4">新建记录项</button>
          </div>
        )}

      </div>

      {/* 新建/编辑弹窗 */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm() }}
        title={editingHabit ? '编辑记录项' : '新建记录项'}
        footer={<>
          <button onClick={() => { setShowModal(false); resetForm() }} className="btn-secondary">取消</button>
          <button onClick={handleSave} className="btn-primary">{editingHabit ? '保存' : '创建'}</button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">名称</label>
            <input type="text" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="例如：每天阅读30分钟 / 抽烟" className="input-dark" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">类型</label>
            <div className="flex gap-3">
              <button onClick={() => setForm(prev => ({ ...prev, type: 'positive' }))}
                className={`flex-1 py-2.5 rounded-button text-sm font-medium border-2 transition-all ${
                  form.type === 'positive' ? 'border-success bg-success/10 text-success' : 'border-[var(--border-color)] text-[var(--text-secondary)]'
                }`}>
                积极（想要坚持）
              </button>
              <button onClick={() => setForm(prev => ({ ...prev, type: 'negative' }))}
                className={`flex-1 py-2.5 rounded-button text-sm font-medium border-2 transition-all ${
                  form.type === 'negative' ? 'border-warning bg-warning/10 text-warning' : 'border-[var(--border-color)] text-[var(--text-secondary)]'
                }`}>
                消极（想要减少）
              </button>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
              {form.type === 'positive'
                ? '积极记录：关注连续天数和完成率，帮助你建立好习惯'
                : '消极记录：关注间隔天数，帮助你减少坏习惯的发生频率'}
            </p>
          </div>
        </div>
      </Modal>

      {/* 记录弹窗 - 支持选择日期 */}
      <Modal isOpen={!!checkinHabitId}
        onClose={() => { setCheckinHabitId(null); setCheckinNote(''); const d = new Date(); setCheckinDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`) }}
        title="记录"
        footer={<>
          <button onClick={() => { setCheckinHabitId(null); setCheckinNote(''); const d = new Date(); setCheckinDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`) }} className="btn-secondary">取消</button>
          <button onClick={handleCheckin} className="btn-primary">确认记录</button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">日期</label>
            <input type="date" value={checkinDate} max={today}
              onChange={e => {
                setCheckinDate(e.target.value)
                const habit = habits.find(h => h.id === checkinHabitId)
                const existing = habit?.checkins.find(c => c.date === e.target.value)
                setCheckinNote(existing?.note || '')
              }}
              className="input-dark" />
            <p className="text-xs text-[var(--text-tertiary)] mt-1">可以选择过去的日期进行补录</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">备注（可选）</label>
            <textarea value={checkinNote} onChange={e => setCheckinNote(e.target.value)}
              placeholder="今天的感受或记录..." rows={3} className="input-dark resize-none" />
          </div>
        </div>
      </Modal>

      {/* 图表弹窗 - 增强数据可视化 */}
      <Modal isOpen={!!showChart} onClose={() => setShowChart(null)} title="记录数据分析" size="lg"
        footer={<>
          <button onClick={() => setShowChart(null)} className="btn-secondary">关闭</button>
          <button onClick={exportChart} className="btn-primary flex items-center gap-2"><Download size={16} /> 导出图片</button>
        </>}>
        {showChart && (() => {
          const habit = activeHabits.find(h => h.id === showChart)
          if (!habit) return null
          const stats = getStats(habit)
          const isPositive = habit.type === 'positive'

          return (
            <div ref={chartRef} className="space-y-6">
              {/* 核心指标卡片 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {isPositive ? (
                  <>
                    <div className="bg-[var(--bg-secondary)] rounded-card p-3 text-center">
                      <div className="text-xl font-bold text-primary-600">{stats.nowStreak}</div>
                      <div className="text-xs text-[var(--text-secondary)]">当前连续</div>
                    </div>
                    <div className="bg-[var(--bg-secondary)] rounded-card p-3 text-center">
                      <div className="text-xl font-bold text-primary-600">{stats.maxStreak}</div>
                      <div className="text-xs text-[var(--text-secondary)]">最长连续</div>
                    </div>
                    <div className="bg-[var(--bg-secondary)] rounded-card p-3 text-center">
                      <div className="text-xl font-bold text-accent">{stats.avgInterval || '-'}</div>
                      <div className="text-xs text-[var(--text-secondary)]">平均间隔(天)</div>
                    </div>
                    <div className="bg-[var(--bg-secondary)] rounded-card p-3 text-center">
                      <div className="text-xl font-bold text-success">{habit.checkins.length}</div>
                      <div className="text-xs text-[var(--text-secondary)]">累计记录</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-[var(--bg-secondary)] rounded-card p-3 text-center">
                      <div className="text-xl font-bold text-primary-600">{stats.daysSinceLast >= 0 ? stats.daysSinceLast : '-'}</div>
                      <div className="text-xs text-[var(--text-secondary)]">距离上次(天)</div>
                    </div>
                    <div className="bg-[var(--bg-secondary)] rounded-card p-3 text-center">
                      <div className="text-xl font-bold text-accent">{stats.avgInterval || '-'}</div>
                      <div className="text-xs text-[var(--text-secondary)]">平均间隔(天)</div>
                    </div>
                    <div className="bg-[var(--bg-secondary)] rounded-card p-3 text-center">
                      <div className="text-xl font-bold text-warning">{stats.maxStreak}</div>
                      <div className="text-xs text-[var(--text-secondary)]">最长连续(天)</div>
                    </div>
                    <div className="bg-[var(--bg-secondary)] rounded-card p-3 text-center">
                      <div className="text-xl font-bold text-success">{habit.checkins.length}</div>
                      <div className="text-xs text-[var(--text-secondary)]">累计记录</div>
                    </div>
                  </>
                )}
              </div>

              {/* 周期频率统计 */}
              <div className="bg-[var(--bg-secondary)] rounded-card p-4">
                <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">记录频率</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.weekCount}</div>
                    <div className="text-xs text-[var(--text-secondary)]">本周</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.monthCount}</div>
                    <div className="text-xs text-[var(--text-secondary)]">本月</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.yearCount}</div>
                    <div className="text-xs text-[var(--text-secondary)]">本年</div>
                  </div>
                </div>
              </div>

              {/* 近N天完成率（仅积极习惯） */}
              {isPositive && (
                <div className="bg-[var(--bg-secondary)] rounded-card p-4">
                  <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">近期完成率</h4>
                  <div className="space-y-3">
                    {[
                      { label: '近7天', rate: stats.rate7 },
                      { label: '近30天', rate: stats.rate30 },
                      { label: '近90天', rate: stats.rate90 }
                    ].map(item => (
                      <div key={item.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[var(--text-secondary)]">{item.label}</span>
                          <span className="font-medium text-[var(--text-primary)]">{item.rate}%</span>
                        </div>
                        <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${item.rate}%`, backgroundColor: item.rate >= 80 ? '#22c55e' : item.rate >= 50 ? '#f59e0b' : '#ef4444' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 消极习惯：间隔趋势 */}
              {!isPositive && stats.avgInterval > 0 && (
                <div className="bg-[var(--bg-secondary)] rounded-card p-4">
                  <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">间隔分析</h4>
                  <p className="text-sm text-[var(--text-secondary)]">
                    平均每隔 <span className="font-bold text-[var(--text-primary)]">{stats.avgInterval}</span> 天记录一次。
                    {stats.daysSinceLast >= 0 && (
                      <>
                        {' '}目前已维持 <span className="font-bold text-success">{stats.daysSinceLast}</span> 天未记录。
                        {stats.daysSinceLast > stats.avgInterval
                          ? ' 已经超过平均间隔，继续保持！'
                          : ' 还在平均间隔范围内，继续努力！'}
                      </>
                    )}
                  </p>
                </div>
              )}

              {/* 星期分布条形图 */}
              <div className="bg-[var(--bg-secondary)] rounded-card p-4">
                <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">星期分布</h4>
                <div className="flex items-end gap-2 h-32">
                  {stats.weekDays.map((count, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-xs text-[var(--text-secondary)]">{count}</div>
                      <div className="w-full bg-[var(--bg-primary)] rounded-t-sm relative" style={{ height: '100px' }}>
                        <div className={`absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-500 ${isPositive ? 'bg-primary-600' : 'bg-warning'}`}
                          style={{ height: `${(count / stats.weekDayMax) * 100}px` }} />
                      </div>
                      <span className="text-[10px] text-[var(--text-tertiary)]">{['日', '一', '二', '三', '四', '五', '六'][i]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 月度趋势 */}
              <div className="bg-[var(--bg-secondary)] rounded-card p-4">
                <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">月度趋势（近12个月）</h4>
                <div className="flex items-end gap-1 h-28">
                  {stats.monthlyTrend.map((m, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-[var(--bg-primary)] rounded-t-sm relative" style={{ height: '80px' }}>
                        <div className={`absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-500 ${isPositive ? 'bg-accent' : 'bg-warning'}`}
                          style={{ height: `${(m.count / stats.monthMax) * 80}px` }} title={`${m.label}: ${m.count}次`} />
                      </div>
                      <span className="text-[9px] text-[var(--text-tertiary)] whitespace-nowrap">{m.label.slice(5)}月</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 90天热力图 */}
              <div className="bg-[var(--bg-secondary)] rounded-card p-4">
                <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">近90天记录热力图</h4>
                <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}>
                  {stats.last90Days.map((date, i) => {
                    const checked = stats.checkinMap.has(date)
                    return (
                      <div key={i} className={`aspect-square rounded-sm ${checked ? (isPositive ? 'bg-success' : 'bg-warning') : 'bg-[var(--bg-primary)]'}`} title={date} />
                    )
                  })}
                </div>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--text-tertiary)]">
                  <span>少</span>
                  <div className="w-3 h-3 bg-[var(--bg-primary)] rounded-sm" />
                  {isPositive ? (
                    <>
                      <div className="w-3 h-3 bg-success/40 rounded-sm" />
                      <div className="w-3 h-3 bg-success/70 rounded-sm" />
                      <div className="w-3 h-3 bg-success rounded-sm" />
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 bg-warning/40 rounded-sm" />
                      <div className="w-3 h-3 bg-warning/70 rounded-sm" />
                      <div className="w-3 h-3 bg-warning rounded-sm" />
                    </>
                  )}
                  <span>多</span>
                </div>
              </div>

              {/* 记录历史 */}
              <div className="bg-[var(--bg-secondary)] rounded-card p-4">
                <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">记录历史</h4>
                <div className="space-y-1 max-h-96 overflow-auto">
                  {habit.checkins.slice().reverse().map(c => (
                    <div key={c.date} className="flex items-start justify-between text-sm py-1.5 px-2 rounded hover:bg-[var(--bg-primary)]">
                      <div className="flex-1 min-w-0">
                        <span className="text-[var(--text-secondary)]">{c.date}</span>
                        {c.note && (
                          <p className="text-xs text-[var(--text-tertiary)] whitespace-pre-wrap break-all leading-relaxed mt-0.5">{c.note}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        {!c.note && <span className="text-success text-xs">已记录</span>}
                        <button onClick={() => uncheckin(habit.id, c.date)}
                          className="p-0.5 text-danger hover:bg-danger/10 rounded" title="删除这条记录">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 半年归档提醒 */}
              {habit.checkins.length > 180 && (
                <div className="bg-warning/10 text-warning text-xs p-3 rounded-button mt-4">
                  您已有 {habit.checkins.length} 条记录，建议归档半年前的记录以保持应用流畅。超过 365 天的记录将无法继续记录。
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      {confirmDelete && (
        <ConfirmDialog isOpen={true} onClose={() => setConfirmDelete(null)}
          onConfirm={() => {
            const habit = habits.find(h => h.id === confirmDelete)
            if (habit) deleteHabit(habit.id)
            setConfirmDelete(null)
          }}
          title="确认删除" message="删除后记录项及所有历史将进入回收站。" type="danger" />
      )}
    </div>
  )
}

export default HabitPage
