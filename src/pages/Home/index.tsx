import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, useTodoStore, useScheduleStore, usePlanStore, useNoteStore, useTrackerStore } from '@/store'
import {
  CheckSquare, Calendar, Target, TrendingUp, StickyNote, Activity,
  ArrowRight, Clock, Edit, X, Settings, ChevronDown, Zap
} from '@/utils/icons'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
}

const shortcutOptions = [
  { id: 'todo', icon: CheckSquare, label: '新建待办', path: '/todo' },
  { id: 'calendar', icon: Calendar, label: '新建日程', path: '/calendar' },
  { id: 'plan', icon: Target, label: '新建规划', path: '/plan' },
  { id: 'notes', icon: StickyNote, label: '新建随心贴', path: '/notes' },
  { id: 'habit', icon: TrendingUp, label: '新建习惯', path: '/habit' },
  { id: 'tracker', icon: Activity, label: '快速记录', path: '/tracker' },
]

const Home: React.FC = () => {
  const navigate = useNavigate()
  const { settings, updateSettings, user } = useAppStore()
  const { tasks } = useTodoStore()
  const { schedules } = useScheduleStore()
  const { plans } = usePlanStore()
  const { notes, walls } = useNoteStore()
  const { categories: trackerCategories, entries: trackerEntries } = useTrackerStore()
  const [editShortcuts, setEditShortcuts] = useState(false)
  const [now, setNow] = useState(new Date())
  const [noteDisplayIdx, setNoteDisplayIdx] = useState(0)
  const [showNoteSettings, setShowNoteSettings] = useState(false)
  const [wallDropdownOpen, setWallDropdownOpen] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  const homeShortcuts = settings.homeShortcuts || ['todo', 'calendar', 'plan', 'notes']

  const pendingTasks = tasks.filter(t => !t.is_completed && !t.deleted_at).slice(0, 5)
  const todaySchedules = schedules.filter(s => {
    if (s.deleted_at) return false
    const start = new Date(s.start_time)
    const today = new Date()
    return start.toDateString() === today.toDateString()
  }).slice(0, 5)

  const unscheduledPlans = plans.filter(p => !p.is_scheduled && !p.deleted_at).slice(0, 3)

  // 随心贴轮播配置
  const selectedWallIds: string[] = settings.homeNoteWallIds || []
  const noteRotationInterval = settings.noteRotationInterval || 8
  const activeWalls = walls.filter(w => !w.deleted_at)
  const activeNotes = notes.filter(n => {
    if (n.deleted_at) return false
    if (selectedWallIds.length === 0) return false
    return selectedWallIds.includes(n.wall_id)
  })
  const noteWallMap = new Map(activeWalls.map(w => [w.id, w.name]))

  useEffect(() => {
    if (activeNotes.length <= 1) return
    const timer = setInterval(() => {
      setNoteDisplayIdx(prev => (prev + 1) % activeNotes.length)
    }, noteRotationInterval * 1000)
    return () => clearInterval(timer)
  }, [activeNotes.length, noteRotationInterval])

  // 今日专注时长
  const todayFocusStr = new Date().toISOString().split('T')[0]
  let todayFocusMinutes = 0
  try {
    const savedSessions = localStorage.getItem('focus_sessions')
    if (savedSessions) {
      const sessions: Array<{ duration: number; created_at: string }> = JSON.parse(savedSessions)
      const todaySessions = sessions.filter(s => s.created_at && s.created_at.startsWith(todayFocusStr))
      todayFocusMinutes = Math.round(todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60)
    }
  } catch {}

  // 最近2条实时记录
  const recentTrackerEntries = trackerEntries
    .filter(e => !e.deleted_at)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 2)
  const categoryMap = new Map(trackerCategories.filter(c => !c.deleted_at).map(c => [c.id, c]))
  const todayStrShort = new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })

  return (
    <div className="page-container">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-6xl mx-auto space-y-6"
      >
        {/* 欢迎语 + 日期时间 */}
        <motion.div variants={item} className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">
              欢迎回来，{user?.username || settings.username || '用户'}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-[var(--text-primary)]">
              {now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
          </div>
        </motion.div>

        {/* 三栏：待办 + 日程 + 随心贴 */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* 待办任务预览 */}
          <motion.div variants={item} className="card shadow-card min-h-[280px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-0">待办任务</h2>
              <button onClick={() => navigate('/todo')} className="text-sm text-primary-600 hover:underline">
                查看全部
              </button>
            </div>
            {pendingTasks.length > 0 ? (
              <div className="space-y-2.5 flex-1">
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-4 rounded-xl shadow-sm border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:shadow-md hover:border-primary-600/30 transition-all"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      task.priority === 'high' ? 'bg-danger' :
                      task.priority === 'medium' ? 'bg-warning' : 'bg-success'
                    }`} />
                    <span className="flex-1 text-sm font-medium text-[var(--text-primary)] truncate">{task.title}</span>
                    {task.subtasks.length > 0 && (
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {task.subtasks.filter(s => s.is_completed).length}/{task.subtasks.length}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state py-8 flex-1 flex flex-col items-center justify-center">
                <CheckSquare size={40} className="text-[var(--text-tertiary)] mb-2" />
                <p className="text-sm">暂无待办任务</p>
              </div>
            )}
          </motion.div>

          {/* 今日日程 */}
          <motion.div variants={item} className="card shadow-card min-h-[280px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-0">今日日程</h2>
              <button onClick={() => navigate('/calendar')} className="text-sm text-primary-600 hover:underline">
                查看全部
              </button>
            </div>
            {todaySchedules.length > 0 ? (
              <div className="space-y-2.5 flex-1">
                {todaySchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center gap-3 p-4 rounded-xl shadow-sm border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:shadow-md hover:border-primary-600/30 transition-all"
                  >
                    <Clock size={16} className="text-[var(--text-tertiary)] flex-shrink-0" />
                    <span className="text-xs text-[var(--text-secondary)] w-14 flex-shrink-0">
                      {(schedule as any).is_all_day ? '全天' : new Date(schedule.start_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="flex-1 text-sm text-[var(--text-primary)] truncate">{schedule.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state py-8 flex-1 flex flex-col items-center justify-center">
                <Calendar size={40} className="text-[var(--text-tertiary)] mb-2" />
                <p className="text-sm">今日暂无日程</p>
              </div>
            )}
          </motion.div>

          {/* 随心贴轮播（大卡片，无图标） */}
          <motion.div variants={item} className="lg:col-span-1">
            <div className="card-hover text-left group relative overflow-hidden h-full min-h-[280px] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-0">随心贴</h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowNoteSettings(true)}
                    className="p-1 rounded-md hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-primary-600 transition-colors"
                    title="轮播设置"
                  >
                    <Settings size={14} />
                  </button>
                  <button onClick={() => navigate('/notes')} className="p-1 rounded-md hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-primary-600 transition-colors">
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
              {activeNotes.length > 0 ? (
                <div className="flex-1 flex flex-col">
                  <motion.div
                    key={activeNotes[noteDisplayIdx]?.id || 'empty'}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex-1 flex flex-col justify-center"
                  >
                    <p className="text-sm font-medium text-[var(--text-primary)] whitespace-pre-wrap break-all leading-relaxed">
                      {(() => {
                        const c = activeNotes[noteDisplayIdx].content
                        const noteContent = typeof c === 'string' ? c : c?.text || ''
                        return noteContent || '空白贴纸'
                      })()}
                    </p>
                  </motion.div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-color)]">
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {noteWallMap.get(activeNotes[noteDisplayIdx].wall_id) || '未分类'}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {new Date(activeNotes[noteDisplayIdx].created_at).toLocaleDateString('zh-CN')}
                      {activeNotes.length > 1 && ` · ${noteDisplayIdx + 1}/${activeNotes.length}`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <p className="text-sm text-[var(--text-tertiary)]">暂无随心贴</p>
                  <button onClick={() => navigate('/notes')} className="text-xs text-primary-600 mt-2 hover:underline">
                    去创建 →
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* 下方信息卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 未落地规划 */}
          <button onClick={() => navigate('/plan')} className="card-hover text-left group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-button bg-warning flex items-center justify-center">
                <Target size={20} className="text-white" />
              </div>
              <ArrowRight size={16} className="text-[var(--text-tertiary)] group-hover:text-primary-600 transition-colors" />
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{unscheduledPlans.length}</p>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">未落地规划</p>
          </button>

          {/* 今日专注时长 */}
          <button onClick={() => navigate('/focus')} className="card-hover text-left group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-button bg-success flex items-center justify-center">
                <Zap size={20} className="text-white" />
              </div>
              <ArrowRight size={16} className="text-[var(--text-tertiary)] group-hover:text-primary-600 transition-colors" />
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{todayFocusMinutes}分钟</p>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">今日专注时长</p>
          </button>

          {/* 已完成任务 */}
          <button onClick={() => navigate('/todo')} className="card-hover text-left group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-button bg-accent flex items-center justify-center">
                <Zap size={20} className="text-white" />
              </div>
              <ArrowRight size={16} className="text-[var(--text-tertiary)] group-hover:text-primary-600 transition-colors" />
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
              {tasks.filter(t => t.is_completed && !t.deleted_at && new Date(t.updated_at || t.created_at).toDateString() === new Date().toDateString()).length}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">今日已完成</p>
          </button>

          {/* 最近记录（实时数据，非链接） */}
          <div className="card-hover text-left">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-button bg-primary-600 flex items-center justify-center">
                <Activity size={20} className="text-white" />
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">实时记录</p>
            {recentTrackerEntries.length > 0 ? (
              <div className="space-y-1.5">
                {recentTrackerEntries.map(entry => {
                  const cat = categoryMap.get(entry.category_id)
                  const entryDate = new Date(entry.timestamp)
                  const isToday = entryDate.toDateString() === new Date().toDateString()
                  const dateStr = isToday ? '' : entryDate.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
                  const timeStr = entryDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={entry.id} className="flex items-center gap-2 text-sm">
                      <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0 w-16">
                        {dateStr && <span>{dateStr} </span>}{timeStr}
                      </span>
                      <span className="text-xs text-primary-600 font-medium truncate">{cat?.name || '未分类'}</span>
                      {entry.note && <span className="text-xs text-[var(--text-tertiary)] truncate">{entry.note}</span>}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">暂无记录</p>
            )}
          </div>
        </div>

        {/* 快捷操作 */}
        <motion.div variants={item} className="card shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-0">快捷操作</h2>
            <button
              onClick={() => setEditShortcuts(!editShortcuts)}
              className="text-xs text-[var(--text-tertiary)] hover:text-primary-600 flex items-center gap-1"
            >
              {editShortcuts ? <><X size={12} /> 完成</> : <><Edit size={12} /> 编辑</>}
            </button>
          </div>
          {editShortcuts ? (
            <div className="flex flex-wrap gap-2">
              {shortcutOptions.map(opt => {
                const Icon = opt.icon
                const selected = homeShortcuts.includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      const next = selected
                        ? homeShortcuts.filter(id => id !== opt.id)
                        : [...homeShortcuts, opt.id]
                      updateSettings({ homeShortcuts: next })
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-button text-sm font-medium transition-all border ${
                      selected
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-primary-600'
                    }`}
                  >
                    <Icon size={14} />
                    {opt.label}
                    {selected && <span className="ml-1">✓</span>}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {shortcutOptions
                .filter(opt => homeShortcuts.includes(opt.id))
                .map(opt => {
                  const Icon = opt.icon
                  return (
                    <button key={opt.id} onClick={() => navigate(opt.path)} className="btn-primary flex items-center gap-2">
                      <Icon size={16} />
                      {opt.label}
                    </button>
                  )
                })}
              {homeShortcuts.length === 0 && (
                <p className="text-sm text-[var(--text-secondary)]">点击编辑选择快捷操作</p>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* 随心贴轮播设置弹窗 */}
      <AnimatePresence>
        {showNoteSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setShowNoteSettings(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-[var(--bg-primary)] rounded-2xl shadow-xl w-full max-w-md mx-4 p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">随心贴轮播设置</h3>
                <button onClick={() => setShowNoteSettings(false)} className="p-1 rounded-md hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">
                  <X size={18} />
                </button>
              </div>

              {/* 轮播间隔 */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">轮播间隔（秒）</label>
                <input
                  type="number"
                  min={3}
                  max={300}
                  value={settings.noteRotationInterval || 8}
                  onChange={e => updateSettings({ noteRotationInterval: Math.max(3, Math.min(300, parseInt(e.target.value) || 8)) })}
                  className="input w-24"
                />
                <p className="text-xs text-[var(--text-tertiary)] mt-1">范围 3 ~ 300 秒</p>
              </div>

              {/* 主题墙选择 - 下拉多选 */}
              <div className="mb-2">
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">选择轮换的主题墙</label>
                {activeWalls.length === 0 ? (
                  <p className="text-sm text-[var(--text-tertiary)]">暂无主题墙，请先在随心贴中创建</p>
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => setWallDropdownOpen(!wallDropdownOpen)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-primary-600/50 transition-colors text-sm text-left"
                    >
                      <span className={selectedWallIds.length === 0 ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}>
                        {selectedWallIds.length === 0 ? '未选择' : selectedWallIds.length === activeWalls.length ? '全部主题墙' : `已选 ${selectedWallIds.length} 个主题墙`}
                      </span>
                      <ChevronDown size={14} className={`text-[var(--text-tertiary)] transition-transform ${wallDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {wallDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setWallDropdownOpen(false)} />
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          <label className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors border-b border-[var(--border-color)]">
                            <input
                              type="checkbox"
                              checked={selectedWallIds.length === activeWalls.length}
                              onChange={e => {
                                updateSettings({ homeNoteWallIds: e.target.checked ? activeWalls.map(w => w.id) : [] })
                              }}
                              className="w-4 h-4 rounded border-[var(--border-color)] text-primary-600 focus:ring-primary-600"
                            />
                            <span className="text-sm text-[var(--text-primary)]">全部主题墙</span>
                          </label>
                          {activeWalls.map(wall => (
                            <label key={wall.id} className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={selectedWallIds.includes(wall.id)}
                                onChange={e => {
                                  const next = e.target.checked
                                    ? [...selectedWallIds, wall.id]
                                    : selectedWallIds.filter(id => id !== wall.id)
                                  updateSettings({ homeNoteWallIds: next })
                                }}
                                className="w-4 h-4 rounded border-[var(--border-color)] text-primary-600 focus:ring-primary-600"
                              />
                              <span className="text-sm text-[var(--text-primary)]">{wall.name}</span>
                              <span className="text-xs text-[var(--text-tertiary)] ml-auto">
                                {notes.filter(n => n.wall_id === wall.id && !n.deleted_at).length} 张
                              </span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <p className="text-xs text-[var(--text-tertiary)] mt-1">不选则不显示轮播卡片</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Home
