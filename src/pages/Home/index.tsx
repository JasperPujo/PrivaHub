import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, useTodoStore, useScheduleStore, usePlanStore, useHabitStore, useNoteStore } from '@/store'
import {
  CheckSquare, Calendar, Target, TrendingUp, StickyNote, Activity,
  ArrowRight, Clock, Edit, X, Settings, ChevronDown, Check
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
  const { habits } = useHabitStore()
  const { notes, walls } = useNoteStore()
  const [editShortcuts, setEditShortcuts] = useState(false)
  const [now, setNow] = useState(new Date())
  const [noteDisplayIdx, setNoteDisplayIdx] = useState(0)
  const [showNoteSettings, setShowNoteSettings] = useState(false)
  const [wallDropdownOpen, setWallDropdownOpen] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  // 兼容旧版数据：homeShortcuts 可能不存在
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
    if (selectedWallIds.length === 0) return true
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

  const statCards = [
    { title: '待办任务', count: tasks.filter(t => !t.is_completed && !t.deleted_at).length, icon: CheckSquare, path: '/todo', color: 'bg-primary-600' },
    { title: '今日日程', count: todaySchedules.length, icon: Calendar, path: '/calendar', color: 'bg-accent' },
    { title: '未落地规划', count: unscheduledPlans.length, icon: Target, path: '/plan', color: 'bg-warning' },
  ]

  return (
    <div className="page-container">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-6xl mx-auto space-y-6"
      >
        {/* 日期和实时时间 */}
        <motion.div variants={item}>
          <div className="mb-6">
            <p className="text-3xl font-bold text-[var(--text-primary)]">
              {now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
          </div>
        </motion.div>

        {/* 欢迎语 */}
        <motion.div variants={item}>
          <h1 className="page-title">
            欢迎回来，{user?.username || settings.username || '用户'}
          </h1>
        </motion.div>

        {/* 统计卡片 */}
        <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon
            return (
              <button
                key={card.title}
                onClick={() => navigate(card.path)}
                className="card-hover text-left group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-button ${card.color} flex items-center justify-center`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <ArrowRight size={16} className="text-[var(--text-tertiary)] group-hover:text-primary-600 transition-colors" />
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{card.count}</p>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">{card.title}</p>
              </button>
            )
          })}
          {/* 随心贴轮播卡片 */}
          <div className="card-hover text-left group relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-button bg-primary-100 flex items-center justify-center">
                <StickyNote size={20} className="text-primary-600" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowNoteSettings(true) }}
                  className="p-1 rounded-md hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-primary-600 transition-colors"
                  title="随心贴轮播设置"
                >
                  <Settings size={14} />
                </button>
                <button onClick={() => navigate('/notes')} className="p-1 rounded-md hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-primary-600 transition-colors">
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
            {activeNotes.length > 0 ? (
              <motion.div
                key={activeNotes[noteDisplayIdx]?.id || 'empty'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-1"
              >
                <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-4 whitespace-pre-wrap min-h-[3.5rem]">
                  {activeNotes[noteDisplayIdx].content || '空白贴纸'}
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {noteWallMap.get(activeNotes[noteDisplayIdx].wall_id) || '未分类'}
                  {' · '}
                  {new Date(activeNotes[noteDisplayIdx].created_at).toLocaleDateString('zh-CN')}
                  {activeNotes.length > 1 && ` · ${noteDisplayIdx + 1}/${activeNotes.length}`}
                </p>
              </motion.div>
            ) : (
              <div>
                <p className="text-sm text-[var(--text-tertiary)]">暂无随心贴</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">点击创建第一张</p>
              </div>
            )}
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* 待办预览 */}
          <motion.div variants={item} className="card shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-0">待办任务</h2>
              <button onClick={() => navigate('/todo')} className="text-sm text-primary-600 hover:underline">
                查看全部
              </button>
            </div>
            {pendingTasks.length > 0 ? (
              <div className="space-y-2.5">
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
              <div className="empty-state py-8">
                <CheckSquare size={40} className="text-[var(--text-tertiary)] mb-2" />
                <p className="text-sm">暂无待办任务</p>
              </div>
            )}
          </motion.div>

          {/* 今日日程 */}
          <motion.div variants={item} className="card shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-0">今日日程</h2>
              <button onClick={() => navigate('/calendar')} className="text-sm text-primary-600 hover:underline">
                查看全部
              </button>
            </div>
            {todaySchedules.length > 0 ? (
              <div className="space-y-2.5">
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
              <div className="empty-state py-8">
                <Calendar size={40} className="text-[var(--text-tertiary)] mb-2" />
                <p className="text-sm">今日暂无日程</p>
              </div>
            )}
          </motion.div>
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
                        {selectedWallIds.length === 0 ? '全部主题墙' : `已选 ${selectedWallIds.length} 个主题墙`}
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
                              checked={selectedWallIds.length === 0}
                              onChange={() => { updateSettings({ homeNoteWallIds: [] }); }}
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
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Home
