import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAppStore, useTodoStore, useScheduleStore, usePlanStore, useHabitStore } from '@/store'
import {
  CheckSquare, Calendar, Target, TrendingUp, StickyNote, Activity,
  ArrowRight, Clock, Edit, X
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
  const [editShortcuts, setEditShortcuts] = useState(false)
  const [now, setNow] = useState(new Date())

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
  const todayHabits = habits.filter(h => {
    if (h.deleted_at) return false
    const today = new Date().toISOString().split('T')[0]
    return !h.checkins.find(c => c.date === today)
  }).slice(0, 3)

  const statCards = [
    { title: '待办任务', count: tasks.filter(t => !t.is_completed && !t.deleted_at).length, icon: CheckSquare, path: '/todo', color: 'bg-primary-600' },
    { title: '今日日程', count: todaySchedules.length, icon: Calendar, path: '/calendar', color: 'bg-accent' },
    { title: '未落地规划', count: unscheduledPlans.length, icon: Target, path: '/plan', color: 'bg-warning' },
    { title: '待打卡习惯', count: todayHabits.length, icon: TrendingUp, path: '/habit', color: 'bg-success' },
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
    </div>
  )
}

export default Home
