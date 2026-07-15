import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/store'
import { useTodoStore } from '@/store'
import {
  Play, Pause, RotateCcw, Square, Check, Volume2, VolumeX,
  SkipForward, SkipBack, Settings, X, Headphones, Upload,
  Repeat, Shuffle, ListMusic, BarChart2
} from '@/utils/icons'

interface SoundEffect {
  id: string
  name: string
  src: string
  isBuiltin: boolean
}

interface FocusSession {
  id: string
  mode: 'countUp' | 'countDown' | 'pomodoro'
  theme: string
  taskId: string | null
  startTime: string
  endTime: string | null
  duration: number
  completedTasks: string[]
  isRest: boolean
}

const BUILTIN_SOUNDS: SoundEffect[] = [
  { id: 'builtin-1', name: '水滴滴落', src: '/audio/water-drops.aac', isBuiltin: true },
  { id: 'builtin-2', name: '大雨', src: '/audio/heavy-rain.aac', isBuiltin: true },
  { id: 'builtin-3', name: '雷阵雨', src: '/audio/thunder-rain.aac', isBuiltin: true },
  { id: 'builtin-4', name: '翻书声', src: '', isBuiltin: true },
  { id: 'builtin-5', name: '篝火燃烧', src: '/audio/campfire.aac', isBuiltin: true },
  { id: 'builtin-6', name: '海浪声', src: '/audio/ocean-waves.aac', isBuiltin: true },
]

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const FocusPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAppStore()
  const { tasks, updateTask, addTask } = useTodoStore()
  const addNotification = useAppStore((state) => state.addNotification)

  // 计时状态
  const [mode, setMode] = useState<'countUp' | 'countDown' | 'pomodoro'>('pomodoro')
  const [isRunning, setIsRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [targetDuration, setTargetDuration] = useState(25 * 60)
  const [isRest, setIsRest] = useState(false)
  const [pomodoroCount, setPomodoroCount] = useState(0)
  const [focusTheme, setFocusTheme] = useState('无主题专注')
  const [linkedTaskId, setLinkedTaskId] = useState<string | null>(null)
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 结算弹窗
  const [showSummary, setShowSummary] = useState(false)
  const [summaryData, setSummaryData] = useState<FocusSession | null>(null)

  // 专注记录历史（持久化到 localStorage）
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>(() => {
    const saved = localStorage.getItem('focus_sessions')
    return saved ? JSON.parse(saved) : []
  })

  const saveSession = useCallback((session: FocusSession) => {
    setFocusSessions(prev => {
      const updated = [session, ...prev]
      localStorage.setItem('focus_sessions', JSON.stringify(updated))
      return updated
    })
  }, [])

  // 白噪音
  const [soundList, setSoundList] = useState<SoundEffect[]>(() => {
    const saved = localStorage.getItem('focus_custom_sounds')
    const customSounds = saved ? JSON.parse(saved) : []
    return [...BUILTIN_SOUNDS, ...customSounds]
  })
  const [soundIndex, setSoundIndex] = useState(() => {
    const saved = localStorage.getItem('focus_sound_index')
    return saved ? parseInt(saved) : 0
  })
  const [soundPlaying, setSoundPlaying] = useState(false)
  const [soundVolume, setSoundVolume] = useState(() => {
    const saved = localStorage.getItem('focus_sound_volume')
    return saved ? parseInt(saved) : 50
  })
  const [playMode, setPlayMode] = useState<'single' | 'list' | 'shuffle'>(() => {
    return (localStorage.getItem('focus_play_mode') as 'single' | 'list' | 'shuffle') || 'single'
  })
  const [showSoundUpload, setShowSoundUpload] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // 设置
  const [pomodoroFocusMin, setPomodoroFocusMin] = useState(25)
  const [pomodoroRestMin, setPomodoroRestMin] = useState(5)
  const [countdownOptions] = useState([15, 25, 45, 60, 90])

  // 保存白噪音设置到 localStorage
  useEffect(() => {
    localStorage.setItem('focus_sound_index', String(soundIndex))
    localStorage.setItem('focus_sound_volume', String(soundVolume))
    localStorage.setItem('focus_play_mode', playMode)
  }, [soundIndex, soundVolume, playMode])

  // 自动播放下一首
  const playNext = useCallback(() => {
    if (playMode === 'single') {
      // 单曲循环：保持当前
      return
    } else if (playMode === 'list') {
      setSoundIndex((i) => (i + 1) % soundList.length)
    } else if (playMode === 'shuffle') {
      setSoundIndex((i) => {
        let next = Math.floor(Math.random() * soundList.length)
        while (next === i && soundList.length > 1) {
          next = Math.floor(Math.random() * soundList.length)
        }
        return next
      })
    }
  }, [playMode, soundList.length])

  // 开始计时
  const startTimer = useCallback(() => {
    if (isRunning) return
    setIsRunning(true)
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1
        if (mode === 'countDown' && !isRest) {
          if (next >= targetDuration) {
            // 倒计时结束，自动结算
            clearInterval(timerRef.current!)
            setIsRunning(false)
            return targetDuration
          }
        }
        return next
      })
    }, 1000)
  }, [isRunning, mode, isRest, targetDuration])

  // 暂停
  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsRunning(false)
  }, [])

  // 重置
  const resetTimer = useCallback(() => {
    pauseTimer()
    setElapsed(0)
  }, [pauseTimer])

  // 提前结束 / 结算
  const endSession = useCallback(() => {
    pauseTimer()
    const session: FocusSession = {
      id: 'focus-' + Date.now(),
      mode,
      theme: focusTheme,
      taskId: linkedTaskId,
      startTime: new Date(Date.now() - elapsed * 1000).toISOString(),
      endTime: new Date().toISOString(),
      duration: elapsed,
      completedTasks: completedTaskIds,
      isRest,
    }
    if (elapsed > 0) {
      saveSession(session)
    }
    setSummaryData(session)
    setShowSummary(true)
  }, [pauseTimer, mode, focusTheme, linkedTaskId, elapsed, completedTaskIds, isRest, saveSession])

  // 番茄钟自动循环：专注结束 -> 休息 -> 下一轮
  const handlePomodoroComplete = useCallback(() => {
    pauseTimer()
    if (!isRest) {
      // 专注阶段结束，进入休息
      setIsRest(true)
      setElapsed(0)
      setTargetDuration(pomodoroRestMin * 60)
      setIsRunning(false)
      addNotification({ message: `专注完成！休息 ${pomodoroRestMin} 分钟`, type: 'success' })
    } else {
      // 休息结束，回到专注
      setIsRest(false)
      setElapsed(0)
      setTargetDuration(pomodoroFocusMin * 60)
      setIsRunning(false)
      setPomodoroCount((c) => c + 1)
      addNotification({ message: '休息结束，开始下一轮专注', type: 'success' })
    }
  }, [pauseTimer, isRest, pomodoroRestMin, pomodoroFocusMin, addNotification])

  // 监听番茄钟/倒计时结束
  useEffect(() => {
    if (mode === 'pomodoro' && isRunning && elapsed >= targetDuration && targetDuration > 0) {
      // 保存番茄钟完成的专注/休息会话
      if (elapsed > 0) {
        const session: FocusSession = {
          id: 'focus-' + Date.now(),
          mode,
          theme: focusTheme,
          taskId: linkedTaskId,
          startTime: new Date(Date.now() - elapsed * 1000).toISOString(),
          endTime: new Date().toISOString(),
          duration: elapsed,
          completedTasks: completedTaskIds,
          isRest,
        }
        saveSession(session)
      }
      handlePomodoroComplete()
    }
    if (mode === 'countDown' && isRunning && elapsed >= targetDuration && targetDuration > 0) {
      pauseTimer()
      addNotification({ message: '倒计时结束', type: 'success' })
      // 倒计时结束后自动弹出结算
      const session: FocusSession = {
        id: 'focus-' + Date.now(),
        mode,
        theme: focusTheme,
        taskId: linkedTaskId,
        startTime: new Date(Date.now() - elapsed * 1000).toISOString(),
        endTime: new Date().toISOString(),
        duration: elapsed,
        completedTasks: completedTaskIds,
        isRest,
      }
      if (elapsed > 0) {
        saveSession(session)
      }
      setSummaryData(session)
      setShowSummary(true)
    }
  }, [mode, isRunning, elapsed, targetDuration, isRest, handlePomodoroComplete, pauseTimer, addNotification, focusTheme, linkedTaskId, completedTaskIds, saveSession])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  // 模式切换时重置
  useEffect(() => {
    pauseTimer()
    setElapsed(0)
    setIsRest(false)
    if (mode === 'pomodoro') {
      setTargetDuration(pomodoroFocusMin * 60)
    } else if (mode === 'countDown') {
      setTargetDuration(25 * 60)
    }
  }, [mode, pomodoroFocusMin])

  // 当前显示时间：倒计时/番茄钟显示剩余时间，正计时显示已用时间
  const displayTime = (mode === 'countDown' || mode === 'pomodoro')
    ? Math.max(targetDuration - elapsed, 0)
    : elapsed

  // 进度条
  const progress = targetDuration > 0 ? (elapsed / targetDuration) * 100 : 0

  // 关联任务
  const linkedTask = tasks.find((t) => t.id === linkedTaskId)
  const incompleteTasks = tasks.filter((t) => !t.is_completed && !t.deleted_at).slice(0, 10)

  // 任务勾选
  const toggleTaskComplete = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const newCompleted = !task.is_completed
    updateTask(taskId, { is_completed: newCompleted })
    if (newCompleted) {
      setCompletedTaskIds((prev) => [...prev, taskId])
    } else {
      setCompletedTaskIds((prev) => prev.filter((id) => id !== taskId))
    }
  }

  // 白噪音控制
  const toggleSound = () => {
    const currentSound = soundList[soundIndex]
    if (!currentSound?.src) {
      addNotification({ message: '该音效暂无音频文件', type: 'warning' })
      return
    }

    if (soundPlaying && audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setSoundPlaying(false)
    } else {
      const audio = new Audio(currentSound.src)
      audio.volume = soundVolume / 100
      audio.loop = true
      audio.play().catch(() => {
        addNotification({ message: '音频播放失败', type: 'error' })
      })
      audioRef.current = audio
      setSoundPlaying(true)
    }
  }
  // 白噪音选择处理（下拉 + 上一首/下一首共用）
  const handleSoundSelect = (index: number) => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setSoundIndex(index)
    const sound = soundList[index]
    if (sound?.src) {
      const audio = new Audio(sound.src)
      audio.volume = soundVolume / 100
      audio.loop = true
      audio.play().catch(() => {
        addNotification({ message: '音频播放失败', type: 'error' })
      })
      audioRef.current = audio
      setSoundPlaying(true)
    }
  }
  const nextSound = () => {
    let newIndex: number
    if (playMode === 'shuffle') {
      newIndex = Math.floor(Math.random() * soundList.length)
      while (newIndex === soundIndex && soundList.length > 1) {
        newIndex = Math.floor(Math.random() * soundList.length)
      }
    } else {
      newIndex = (soundIndex + 1) % soundList.length
    }
    handleSoundSelect(newIndex)
  }
  const prevSound = () => {
    const newIndex = (soundIndex - 1 + soundList.length) % soundList.length
    handleSoundSelect(newIndex)
  }

  // 自定义音效上传
  const handleSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp3'].includes(file.type)) {
      addNotification({ message: '仅支持 mp3/wav/flac 格式', type: 'error' })
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      const newSound: SoundEffect = {
        id: 'custom-' + Date.now(),
        name: file.name.replace(/\.[^/.]+$/, ''),
        src: dataUrl,
        isBuiltin: false,
      }
      const updated = [...soundList, newSound]
      setSoundList(updated)
      const customSounds = updated.filter((s) => !s.isBuiltin)
      localStorage.setItem('focus_custom_sounds', JSON.stringify(customSounds))
      setSoundIndex(updated.length - 1)
      addNotification({ message: `已添加音效：${newSound.name}`, type: 'success' })
    }
    reader.readAsDataURL(file)
  }

  // 删除自定义音效
  const deleteCustomSound = (id: string) => {
    const updated = soundList.filter((s) => s.id !== id)
    setSoundList(updated)
    const customSounds = updated.filter((s) => !s.isBuiltin)
    localStorage.setItem('focus_custom_sounds', JSON.stringify(customSounds))
    if (soundIndex >= updated.length) setSoundIndex(0)
    addNotification({ message: '音效已删除', type: 'success' })
  }

  // 设置弹窗内容根据模式变化
  const renderSettingsContent = () => {
    if (mode === 'pomodoro') {
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-[var(--text-secondary)] block mb-1">番茄钟专注时长（分钟）</label>
            <input
              type="number" value={pomodoroFocusMin}
              onChange={(e) => setPomodoroFocusMin(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm"
              min={1} max={120}
            />
          </div>
          <div>
            <label className="text-sm text-[var(--text-secondary)] block mb-1">番茄钟休息时长（分钟）</label>
            <input
              type="number" value={pomodoroRestMin}
              onChange={(e) => setPomodoroRestMin(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm"
              min={1} max={60}
            />
          </div>
        </div>
      )
    }
    if (mode === 'countDown') {
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-[var(--text-secondary)] block mb-1">默认倒计时时长（分钟）</label>
            <input
              type="number" value={Math.floor(targetDuration / 60)}
              onChange={(e) => setTargetDuration(Number(e.target.value) * 60)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] text-sm"
              min={1} max={300}
            />
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">
            也可在主页直接选择 15/25/45/60/90 分钟快捷选项
          </p>
        </div>
      )
    }
    // 正计时模式无设置
    return (
      <div className="text-center py-4">
        <p className="text-sm text-[var(--text-secondary)]">正计时模式无需额外设置</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">点击开始后即可自由计时</p>
      </div>
    )
  }

  return (
    <div className="page-container h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto min-h-full flex flex-col">
        {/* 顶部模式切换 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-button p-1">
            {([
              { key: 'countUp', label: '正计时' },
              { key: 'countDown', label: '倒计时' },
              { key: 'pomodoro', label: '番茄钟' },
            ] as const).map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  mode === m.key
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/focus/stats')}
              className="text-sm text-[#6B4C9A] hover:text-[#5a3f85] flex items-center gap-1"
            >
              <BarChart2 size={16} />
              <span>数据统计</span>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-button hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors"
              title="设置"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 flex gap-6 min-h-0">
          {/* 左侧核心计时区 */}
          <div className="flex-[2] flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode + isRest}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="text-center w-full"
              >
                {/* 计时数字 */}
                <div className={`text-7xl md:text-8xl font-bold tracking-tight font-mono mb-4 ${
                  isRest ? 'text-teal-500' : 'text-[#6B4C9A]'
                }`}>
                  {formatTime(displayTime)}
                </div>

                {/* 番茄钟计数 */}
                {mode === 'pomodoro' && !isRest && (
                  <div className="text-sm text-[var(--text-secondary)] mb-3">
                    第 {pomodoroCount + 1} 个番茄 · 已完成 {pomodoroCount} 个
                  </div>
                )}
                {isRest && (
                  <div className="text-sm text-teal-600 mb-3 font-medium">
                    休息时间
                  </div>
                )}

                {/* 主题/任务行 */}
                <div className="mb-8">
                  <button
                    onClick={() => {
                      const newTheme = prompt('请输入专注主题：', focusTheme)
                      if (newTheme) setFocusTheme(newTheme)
                    }}
                    className="text-base text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {linkedTask ? `📋 ${linkedTask.title}` : focusTheme}
                  </button>
                  {linkedTask && (
                    <button
                      onClick={() => setLinkedTaskId(null)}
                      className="ml-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                    >
                      解除关联
                    </button>
                  )}
                </div>

                {/* 倒计时进度条 */}
                {(mode === 'countDown' || mode === 'pomodoro') && targetDuration > 0 && (
                  <div className="w-full max-w-md mx-auto h-2 bg-[var(--bg-secondary)] rounded-full mb-8 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${isRest ? 'bg-teal-400' : 'bg-[#6B4C9A]'}`}
                      animate={{ width: `${Math.min(progress, 100)}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                )}

                {/* 快捷时长（倒计时模式） */}
                {mode === 'countDown' && !isRunning && elapsed === 0 && (
                  <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
                    {countdownOptions.map((min) => (
                      <button
                        key={min}
                        onClick={() => setTargetDuration(min * 60)}
                        className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                          targetDuration === min * 60
                            ? 'bg-[#6B4C9A] text-white'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                      >
                        {min} 分钟
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        const input = prompt('输入分钟数：', '25')
                        if (input) setTargetDuration(parseInt(input) * 60)
                      }}
                      className="px-3 py-1.5 text-xs rounded-md bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                    >
                      自定义
                    </button>
                  </div>
                )}

                {/* 番茄钟休息提示 */}
                {mode === 'pomodoro' && isRest && !isRunning && elapsed === 0 && (
                  <div className="mb-6">
                    <p className="text-sm text-[var(--text-secondary)] mb-3">
                      专注 {pomodoroFocusMin} 分钟完成！开始 {pomodoroRestMin} 分钟休息
                    </p>
                  </div>
                )}

                {/* 控制按钮 */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={resetTimer}
                    className="p-3 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-all"
                    title="重置"
                  >
                    <RotateCcw size={20} />
                  </button>

                  <button
                    onClick={isRunning ? pauseTimer : startTimer}
                    className={`p-5 rounded-full transition-all shadow-lg ${
                      isRunning
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-[#6B4C9A] text-white hover:bg-[#5a3f85]'
                    }`}
                  >
                    {isRunning ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
                  </button>

                  <button
                    onClick={endSession}
                    className="p-3 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-red-50 hover:text-red-500 transition-all"
                    title="结束"
                  >
                    <Square size={20} />
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* 右侧任务与控制面板 */}
          <div className="flex-1 flex flex-col gap-4 min-w-[280px] max-w-[360px]">
            {/* 任务代办面板 */}
            <div className="card flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">关联任务</h3>
                <button
                  onClick={() => {
                    const title = prompt('新建任务标题：')
                    if (title) {
                      addTask({
                        id: 'todo-' + Date.now(),
                        user_id: user?.id || 'current-user',
                        title,
                        description: '',
                        priority: 'medium',
                        category: '',
                        due_date: null,
                        is_completed: false,
                        subtasks: [],
                        attachments: [],
                        deleted_at: null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      })
                      addNotification({ message: '任务已创建', type: 'success' })
                    }
                  }}
                  className="text-xs text-[#6B4C9A] hover:underline"
                >
                  + 新建任务
                </button>
              </div>

              <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
                {incompleteTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
                      linkedTaskId === task.id ? 'bg-[#6B4C9A]/10' : 'hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <button
                      onClick={() => toggleTaskComplete(task.id)}
                      className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                        task.is_completed ? 'bg-[#6B4C9A] border-[#6B4C9A]' : 'border-[var(--border-color)]'
                      }`}
                    >
                      {task.is_completed && <Check size={10} className="text-white" />}
                    </button>
                    <span
                      className={`text-sm flex-1 truncate cursor-pointer ${
                        linkedTaskId === task.id ? 'text-[#6B4C9A] font-medium' : 'text-[var(--text-primary)]'
                      }`}
                      onClick={() => setLinkedTaskId(task.id === linkedTaskId ? null : task.id)}
                    >
                      {task.title}
                    </span>
                  </div>
                ))}
                {incompleteTasks.length === 0 && (
                  <p className="text-xs text-[var(--text-tertiary)] text-center py-4">暂无待办任务</p>
                )}
              </div>
            </div>

            {/* 白噪音控制区 */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">白噪音</h3>
              </div>

              {/* 音效选择下拉列表 */}
              <div className="mb-3">
                <select
                  value={soundIndex}
                  onChange={(e) => handleSoundSelect(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
                >
                  {soundList.map((sound, idx) => (
                    <option key={sound.id} value={idx}>
                      {sound.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 播放控制 */}
              <div className="flex items-center justify-center gap-4 mb-3">
                <button onClick={prevSound} className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                  <SkipBack size={16} />
                </button>
                <button
                  onClick={toggleSound}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    soundPlaying
                      ? 'bg-[#6B4C9A] text-white hover:bg-[#5a3f85]'
                      : 'bg-[#6B4C9A] text-white hover:bg-[#5a3f85]'
                  }`}
                >
                  {soundPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button onClick={nextSound} className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                  <SkipForward size={16} />
                </button>
              </div>

              {/* 播放模式 */}
              <div className="flex items-center gap-1 mb-3">
                {([
                  { key: 'single', icon: Repeat, label: '单曲循环' },
                  { key: 'list', icon: ListMusic, label: '列表循环' },
                  { key: 'shuffle', icon: Shuffle, label: '随机播放' },
                ] as const).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setPlayMode(m.key)}
                    title={m.label}
                    className={`flex-1 py-1.5 rounded-md text-xs flex items-center justify-center gap-1 transition-colors ${
                      playMode === m.key
                        ? 'bg-[#6B4C9A]/10 text-[#6B4C9A]'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    <m.icon size={14} />
                    <span className="hidden sm:inline">{m.label}</span>
                  </button>
                ))}
              </div>

              {/* 音量调节 - 改进UI */}
              <div className="flex items-center gap-3">
                <VolumeX size={14} className="text-[var(--text-tertiary)] flex-shrink-0" />
                <div className="flex-1 relative h-5 flex items-center">
                  <div className="absolute left-0 right-0 h-1.5 bg-[var(--bg-secondary)] rounded-full" />
                  <div
                    className="absolute left-0 h-1.5 bg-[#6B4C9A] rounded-full"
                    style={{ width: `${soundVolume}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={soundVolume}
                    onChange={(e) => {
                      const newVolume = Number(e.target.value)
                      setSoundVolume(newVolume)
                      if (audioRef.current) {
                        audioRef.current.volume = newVolume / 100
                      }
                    }}
                    className="absolute left-0 right-0 w-full h-5 opacity-0 cursor-pointer z-10"
                  />
                  <div
                    className="absolute w-3.5 h-3.5 bg-[#6B4C9A] rounded-full shadow border-2 border-white"
                    style={{ left: `calc(${soundVolume}% - 7px)` }}
                  />
                </div>
                <Volume2 size={14} className="text-[var(--text-tertiary)] flex-shrink-0" />
                <span className="text-xs text-[var(--text-secondary)] w-8 text-right">{soundVolume}%</span>
              </div>

              {/* 自定义上传 */}
              <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                <button
                  onClick={() => setShowSoundUpload(true)}
                  className="flex items-center gap-1.5 text-xs text-[#6B4C9A] hover:underline"
                >
                  <Upload size={12} />
                  上传自定义音效
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 结算弹窗 */}
      <AnimatePresence>
        {showSummary && summaryData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setShowSummary(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-xl p-6 w-96 mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 text-center">
                {isRest ? '休息结束' : '专注完成'}
              </h3>

              <div className="space-y-3 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">时长</span>
                  <span className="font-medium text-[var(--text-primary)]">{formatTime(summaryData.duration)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">模式</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {summaryData.mode === 'countUp' ? '正计时' : summaryData.mode === 'countDown' ? '倒计时' : '番茄钟'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">主题</span>
                  <span className="font-medium text-[var(--text-primary)] truncate max-w-[180px]">{summaryData.theme}</span>
                </div>
                {linkedTask && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">关联任务</span>
                    <span className="font-medium text-[var(--text-primary)] truncate max-w-[180px]">{linkedTask.title}</span>
                  </div>
                )}
              </div>

              {completedTaskIds.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs text-[var(--text-secondary)] mb-2">本次完成的任务</p>
                  <div className="space-y-1">
                    {completedTaskIds.map((id) => {
                      const t = tasks.find((task) => task.id === id)
                      return t ? (
                        <div key={id} className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                          <Check size={12} className="text-green-500" />
                          <span className="truncate">{t.title}</span>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {mode === 'pomodoro' && !isRest && (
                  <button
                    onClick={() => {
                      setShowSummary(false)
                      setIsRest(true)
                      setElapsed(0)
                      setTargetDuration(pomodoroRestMin * 60)
                      setIsRunning(false)
                    }}
                    className="flex-1 py-2.5 rounded-button bg-teal-50 text-teal-700 text-sm font-medium hover:bg-teal-100 transition-colors"
                  >
                    开始休息
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowSummary(false)
                    setElapsed(0)
                    setIsRunning(false)
                    if (isRest) {
                      setIsRest(false)
                      setTargetDuration(pomodoroFocusMin * 60)
                      setPomodoroCount((c) => c + 1)
                    }
                  }}
                  className="flex-1 py-2.5 rounded-button bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  {isRest ? '开始专注' : '再来一轮'}
                </button>
                <button
                  onClick={() => setShowSummary(false)}
                  className="flex-1 py-2.5 rounded-button bg-[#6B4C9A] text-white text-sm font-medium hover:bg-[#5a3f85] transition-colors"
                >
                  保存并退出
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 设置弹窗 */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-2xl shadow-xl p-6 w-80 mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  {mode === 'pomodoro' ? '番茄钟设置' : mode === 'countDown' ? '倒计时设置' : '正计时'}
                </h3>
                <button onClick={() => setShowSettings(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                  <X size={18} />
                </button>
              </div>

              {renderSettingsContent()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 自定义音效上传弹窗 */}
      <AnimatePresence>
        {showSoundUpload && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setShowSoundUpload(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-2xl shadow-xl p-6 w-96 mx-4 max-h-[70vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">我的音效</h3>
                <button onClick={() => setShowSoundUpload(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                  <X size={18} />
                </button>
              </div>

              {/* 上传按钮 */}
              <label className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-[var(--border-color)] rounded-xl cursor-pointer hover:border-[#6B4C9A] hover:bg-[#6B4C9A]/5 transition-colors mb-4">
                <Upload size={18} className="text-[#6B4C9A]" />
                <span className="text-sm text-[#6B4C9A]">上传音效（mp3/wav/flac）</span>
                <input type="file" accept="audio/mp3,audio/wav,audio/flac,audio/mpeg" className="hidden" onChange={handleSoundUpload} />
              </label>

              {/* 自定义音效列表 */}
              <div className="space-y-2">
                {soundList.filter((s) => !s.isBuiltin).length === 0 && (
                  <p className="text-sm text-[var(--text-tertiary)] text-center py-4">暂无自定义音效</p>
                )}
                {soundList.filter((s) => !s.isBuiltin).map((sound) => (
                  <div key={sound.id} className="flex items-center justify-between p-2 rounded-md bg-[var(--bg-secondary)]">
                    <span className="text-sm text-[var(--text-primary)] truncate">{sound.name}</span>
                    <button
                      onClick={() => deleteCustomSound(sound.id)}
                      className="p-1 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default FocusPage
