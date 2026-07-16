import React, { useState } from 'react'
import { useTodoStore, useRecycleBinStore } from '@/store'
import { motion, AnimatePresence } from 'framer-motion'
import Modal from '@/components/Modal/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import {
  Plus, Check, Edit, Trash, Archive,
  ChevronDown, ChevronRight, CheckSquare,
  RotateCcw, Download
} from '@/utils/icons'
import type { Task, Subtask } from '@/types'
import { generateUUID } from '@/lib/utils'

const Todo: React.FC = () => {
  const {
    tasks, archivedTasks, addTask, updateTask, deleteTask,
    archiveTask, unarchiveTask, exportArchived, clearOldArchived
  } = useTodoStore()
  const { addItem } = useRecycleBinStore()
  const [showAddModal, setShowAddModal] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [showCompleted, setShowCompleted] = useState(true)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [expandedArchivedMonths, setExpandedArchivedMonths] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  const [form, setForm] = useState({
    title: '',
    content: '',
    priority: 'medium' as Task['priority'],
    tags: [] as string[],
    tagInput: '',
    subtasks: [] as Subtask[]
  })

  const activeTasks = tasks.filter(t => !t.is_completed && !t.deleted_at)
  const completedTasks = tasks.filter(t => t.is_completed && !t.deleted_at)

  const filteredTasks = activeTasks.filter(t => filter === 'all' || t.priority === filter)

  const groupedArchived = archivedTasks.reduce((acc, task) => {
    const month = task.archived_at ? task.archived_at.slice(0, 7) : '未知'
    if (!acc[month]) acc[month] = []
    acc[month].push(task)
    return acc
  }, {} as Record<string, Task[]>)

  const formatMonth = (m: string) => {
    if (m === '未知') return m
    const [y, mon] = m.split('-')
    return `${y}年${Number(mon)}月`
  }

  const resetForm = () => {
    setForm({ title: '', content: '', priority: 'medium', tags: [], tagInput: '', subtasks: [] })
    setEditingTask(null)
  }

  const handleSave = () => {
    if (!form.title.trim()) return

    if (editingTask) {
      updateTask(editingTask.id, {
        title: form.title,
        content: form.content,
        priority: form.priority,
        tags: form.tags,
        subtasks: form.subtasks
      })
    } else {
      addTask({
        id: generateUUID(),
        user_id: 'current-user',
        title: form.title,
        content: form.content,
        priority: form.priority,
        tags: form.tags,
        subtasks: form.subtasks,
        is_completed: false,
        completed_at: null,
        is_archived: false,
        archived_at: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
    setShowAddModal(false)
    resetForm()
  }

  const handleDelete = (task: Task) => {
    deleteTask(task.id)
    addItem({ id: task.id, type: 'task', title: task.title, data: task })
    setConfirmDelete(null)
  }

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const updatedSubtasks = task.subtasks.map(s =>
      s.id === subtaskId ? { ...s, is_completed: !s.is_completed } : s
    )
    const allCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every(s => s.is_completed)
    updateTask(taskId, { subtasks: updatedSubtasks, is_completed: allCompleted })
  }

  // 主任务完成时联动所有子任务
  const handleTaskComplete = (task: Task) => {
    if (!task.is_completed) {
      // 标记完成：同时完成所有子任务
      const completedSubtasks = task.subtasks.map(s => ({ ...s, is_completed: true }))
      updateTask(task.id, { is_completed: true, subtasks: completedSubtasks })
    } else {
      // 取消完成：仅取消主任务，子任务不回退
      updateTask(task.id, { is_completed: false })
    }
  }

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const toggleArchivedMonth = (month: string) => {
    setExpandedArchivedMonths(prev => {
      const next = new Set(prev)
      if (next.has(month)) next.delete(month)
      else next.add(month)
      return next
    })
  }

  const handleArchiveAllCompleted = () => {
    completedTasks.forEach(task => archiveTask(task.id))
  }

  const handleExportArchived = () => {
    const json = exportArchived()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `archived-tasks-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const priorityLabel = { high: '高', medium: '中', low: '低' }
  const priorityClass = { high: 'priority-high', medium: 'priority-medium', low: 'priority-low' }

  const renderTaskCard = (task: Task, isCompleted = false) => (
    <motion.div
      key={task.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="card-hover"
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => handleTaskComplete(task)}
          className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            task.is_completed
              ? 'bg-primary-600 border-primary-600'
              : 'border-[var(--border-color)] hover:border-primary-600'
          }`}
        >
          {task.is_completed && <Check size={12} className="text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isCompleted ? 'line-through text-[var(--text-tertiary)] opacity-60' : 'text-[var(--text-primary)]'}`}>
              {task.title}
            </span>
            <span className={`tag-pill ${priorityClass[task.priority]}`}>
              {priorityLabel[task.priority]}
            </span>
          </div>

          {task.content && (
            <p className={`text-xs mt-1 line-clamp-2 ${isCompleted ? 'text-[var(--text-tertiary)] opacity-60' : 'text-[var(--text-secondary)]'}`}>
              {task.content}
            </p>
          )}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {task.tags.map(tag => (
              <span key={tag} className="tag-pill text-xs">{tag}</span>
            ))}
            {task.subtasks.length > 0 && (
              <button
                onClick={() => toggleExpand(task.id)}
                className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-primary-600"
              >
                {expandedTasks.has(task.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {task.subtasks.filter(s => s.is_completed).length}/{task.subtasks.length}
              </button>
            )}
          </div>

          {/* 子任务展开 */}
          <AnimatePresence>
            {expandedTasks.has(task.id) && task.subtasks.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 pl-2 space-y-1 border-l-2 border-[var(--border-color)]">
                  {task.subtasks.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 py-1">
                      <button
                        onClick={() => toggleSubtask(task.id, sub.id)}
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          sub.is_completed ? 'bg-primary-600 border-primary-600' : 'border-[var(--border-color)]'
                        }`}
                      >
                        {sub.is_completed && <Check size={10} className="text-white" />}
                      </button>
                      <span className={`text-xs ${sub.is_completed ? 'line-through opacity-50' : 'text-[var(--text-secondary)]'}`}>
                        {sub.title}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {isCompleted && (
            <button
              onClick={() => updateTask(task.id, { is_completed: false })}
              className="p-1.5 rounded-button hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-primary-600"
              title="恢复"
            >
              <RotateCcw size={15} />
            </button>
          )}
          {!isCompleted && (
            <button
              onClick={() => {
                setEditingTask(task)
                setForm({
                  title: task.title,
                  content: task.content,
                  priority: task.priority,
                  tags: [...task.tags],
                  tagInput: '',
                  subtasks: [...task.subtasks]
                })
                setShowAddModal(true)
              }}
              className="p-1.5 rounded-button hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <Edit size={15} />
            </button>
          )}
          <button
            onClick={() => archiveTask(task.id)}
            className="p-1.5 rounded-button hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            title="归档"
          >
            <Archive size={15} />
          </button>
          <button
            onClick={() => setConfirmDelete(task.id)}
            className="p-1.5 rounded-button hover:bg-red-50 dark:hover:bg-red-950/20 text-[var(--text-tertiary)] hover:text-danger"
          >
            <Trash size={15} />
          </button>
        </div>
      </div>
    </motion.div>
  )

  return (
    <div className="page-container">
      <div className="max-w-4xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title mb-1">任务待办</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {activeTasks.length} 个待完成 · {completedTasks.length} 个已完成
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-[var(--bg-secondary)] rounded-button p-1 border border-[var(--border-color)]">
              {(['all', 'high', 'medium', 'low'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setFilter(p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-button transition-all ${
                    filter === p
                      ? 'bg-primary-600 text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {p === 'all' ? '全部' : priorityLabel[p]}
                </button>
              ))}
            </div>
            <button onClick={() => setShowArchive(!showArchive)} className="btn-secondary text-sm">
              {showArchive ? '隐藏归档' : '查看归档'}
            </button>
            <button onClick={() => { resetForm(); setShowAddModal(true) }} className="btn-primary flex items-center gap-2">
              <Plus size={16} />
              新建
            </button>
          </div>
        </div>

        {/* 任务列表 */}
        <div className="space-y-3">
          <AnimatePresence>
            {filteredTasks.map((task) => renderTaskCard(task))}
          </AnimatePresence>

          {filteredTasks.length === 0 && (
            <div className="empty-state">
              <CheckSquare size={48} className="text-[var(--text-tertiary)] mb-3" />
              <p className="text-[var(--text-secondary)]">暂无待办任务</p>
              <button onClick={() => { resetForm(); setShowAddModal(true) }} className="btn-primary mt-4">
                新建任务
              </button>
            </div>
          )}
        </div>

        {/* 已完成区域 */}
        {completedTasks.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {showCompleted ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                已完成 ({completedTasks.length})
              </button>
              <button
                onClick={handleArchiveAllCompleted}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <Archive size={14} />
                归档已完成
              </button>
            </div>
            <AnimatePresence>
              {showCompleted && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  <AnimatePresence>
                    {completedTasks.map(task => renderTaskCard(task, true))}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* 归档记录 */}
        <AnimatePresence>
          {showArchive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-8"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-title">归档记录</h2>
                <button
                  onClick={handleExportArchived}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  <Download size={14} />
                  导出归档数据
                </button>
              </div>

              <div className="space-y-3">
                {Object.keys(groupedArchived).sort((a, b) => b.localeCompare(a)).map(month => (
                  <div key={month} className="border border-[var(--border-color)] rounded-card overflow-hidden">
                    <button
                      onClick={() => toggleArchivedMonth(month)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                        {expandedArchivedMonths.has(month) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        {formatMonth(month)}
                      </div>
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {groupedArchived[month].length} 个任务
                      </span>
                    </button>
                    <AnimatePresence>
                      {expandedArchivedMonths.has(month) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-3 space-y-2">
                            {groupedArchived[month].map(task => (
                              <div key={task.id} className="flex items-center justify-between px-3 py-2 rounded-button bg-[var(--bg-primary)] border border-[var(--border-color)]">
                                <div className="flex items-center gap-3 min-w-0">
                                  <Check size={16} className="text-success flex-shrink-0" />
                                  <span className="text-sm line-through text-[var(--text-secondary)] truncate">
                                    {task.title}
                                  </span>
                                </div>
                                <button
                                  onClick={() => unarchiveTask(task.id)}
                                  className="ml-2 text-xs text-primary-600 hover:underline flex-shrink-0"
                                >
                                  恢复
                                </button>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
                {archivedTasks.length === 0 && (
                  <p className="text-sm text-[var(--text-tertiary)] text-center py-4">暂无归档任务</p>
                )}
              </div>

              {/* 年度清理提示 */}
              <div className="mt-4 p-4 rounded-card bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                <p className="text-xs text-[var(--text-tertiary)] mb-3">
                  免费版每年自动清理一次超过一年的归档数据
                </p>
                <button
                  onClick={() => clearOldArchived()}
                  className="btn-secondary text-xs"
                >
                  立即清理旧数据
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 新建/编辑弹窗 */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); resetForm() }}
        title={editingTask ? '编辑任务' : '新建任务'}
        footer={
          <>
            <button onClick={() => { setShowAddModal(false); resetForm() }} className="btn-secondary">
              取消
            </button>
            <button onClick={handleSave} className="btn-primary">
              {editingTask ? '保存' : '创建'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">标题</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="任务标题"
              className="input-dark"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">详情</label>
            <textarea
              value={form.content}
              onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
              placeholder="任务详情（可选）"
              rows={3}
              className="input-dark resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">优先级</label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                  className={`px-4 py-2 rounded-button text-sm font-medium transition-all ${
                    form.priority === p
                      ? priorityClass[p] + ' ring-2 ring-offset-1 ring-offset-[var(--bg-secondary)]'
                      : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-color)]'
                  }`}
                >
                  {priorityLabel[p]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">标签</label>
            <div className="flex items-center gap-2 flex-wrap">
              {form.tags.map(tag => (
                <span key={tag} className="tag-pill flex items-center gap-1">
                  {tag}
                  <button onClick={() => setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))}>
                    <Trash size={12} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={form.tagInput}
                onChange={e => setForm(prev => ({ ...prev, tagInput: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && form.tagInput.trim()) {
                    setForm(prev => ({ ...prev, tags: [...prev.tags, prev.tagInput.trim()], tagInput: '' }))
                  }
                }}
                placeholder="输入标签回车添加"
                className="input-dark text-sm py-1.5 px-3 w-40"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">子任务</label>
            <div className="space-y-2">
              {form.subtasks.map((sub, idx) => (
                <div key={sub.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={sub.title}
                    onChange={e => {
                      const updated = [...form.subtasks]
                      updated[idx] = { ...sub, title: e.target.value }
                      setForm(prev => ({ ...prev, subtasks: updated }))
                    }}
                    className="input-dark text-sm flex-1"
                  />
                  <button
                    onClick={() => setForm(prev => ({ ...prev, subtasks: prev.subtasks.filter((_, i) => i !== idx) }))}
                    className="p-1.5 text-[var(--text-tertiary)] hover:text-danger"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setForm(prev => ({
                  ...prev,
                  subtasks: [...prev.subtasks, { id: generateUUID(), title: '', is_completed: false }]
                }))}
                className="text-sm text-primary-600 hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> 添加子任务
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 删除确认 */}
      {confirmDelete && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => {
            const task = tasks.find(t => t.id === confirmDelete)
            if (task) handleDelete(task)
          }}
          title="确认删除"
          message="删除后内容将进入回收站，7天后自动永久清除。"
          type="danger"
        />
      )}
    </div>
  )
}

export default Todo
