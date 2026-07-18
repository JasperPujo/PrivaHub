import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/store'
import { useTodoStore } from '@/store'
import {
  Play, Pause, RotateCcw, Square, Check, Volume2, VolumeX,
  SkipForward, SkipBack, Settings, X, Headphones, Upload,
  Repeat, Shuffle, ListMusic, BarChart2, Clock, ChevronRight, Zap, Target
} from '@/utils/icons'
import { generateUUID } from '@/lib/utils'

/* ================================================================
   Types & Constants
   ================================================================ */

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
  { id: 'builtin-1', name: '水滴滴落', src: '/audio/water-drops.mp3', isBuiltin: true },
  { id: 'builtin-2', name: '大雨', src: '/audio/heavy-rain.aac', isBuiltin: true },
  { id: 'builtin-3', name: '雷阵雨', src: '/audio/thunder-rain.aac', isBuiltin: true },
  { id: 'builtin-4', name: '翻书声', src: '', isBuiltin: true },
  { id: 'builtin-5', name: '篝火燃烧', src: '/audio/campfire.mp3', isBuiltin: true },
  { id: 'builtin-6', name: '海浪声', src: '/audio/ocean-waves.mp3', isBuiltin: true },
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

/* ================================================================
   Flip Clock Styles (injected once via DOM)
   ================================================================ */

const flipClockStyleId = 'flip-clock-styles'
if (typeof document !== 'undefined' && !document.getElementById(flipClockStyleId)) {
  const styleEl = document.createElement('style')
  styleEl.id = flipClockStyleId
  styleEl.textContent = `
    /* === Flip Clock Container === */
    .flip-clock-wrapper {
      display: flex;
      align-items: center;
      gap: 12px;
      user-select: none;
    }
    .flip-clock-wrapper .flip-clock-separator {
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding: 0 2px;
    }
    .flip-clock-wrapper .flip-clock-separator span {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: rgba(107, 76, 154, 0.7);
      box-shadow: 0 0 10px rgba(107, 76, 154, 0.5);
    }

    /* === Flip Card === */
    .flip-card {
      position: relative;
      width: 100px;
      height: 130px;
      perspective: 400px;
      border-radius: 12px;
      box-shadow:
        0 4px 20px rgba(0, 0, 0, 0.4),
        0 0 30px rgba(107, 76, 154, 0.1);
    }
    .flip-card .card-face {
      position: absolute;
      inset: 0;
      overflow: hidden;
      border-radius: 12px;
      background: linear-gradient(145deg, #2a2040, #1a1230);
    }
    .flip-card .card-face::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 2px;
      background: rgba(0, 0, 0, 0.6);
      z-index: 5;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }

    /* Upper half clips bottom, lower half clips top */
    .flip-card .card-upper {
      clip-path: inset(0 0 50% 0);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      background: linear-gradient(180deg, #2e2448 0%, #251e3c 100%);
      border-radius: 12px 12px 0 0;
      border-bottom: 1px solid rgba(0,0,0,0.5);
    }
    .flip-card .card-upper .digit-text {
      transform: translateY(50%);
    }
    .flip-card .card-lower {
      clip-path: inset(50% 0 0 0);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      background: linear-gradient(180deg, #1e1835 0%, #1a1230 100%);
      border-radius: 0 0 12px 12px;
    }
    .flip-card .card-lower .digit-text {
      transform: translateY(-50%);
    }

    .flip-card .digit-text {
      font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
      font-size: 72px;
      font-weight: 700;
      line-height: 1;
      color: #e8e0f0;
      text-shadow: 0 2px 8px rgba(107, 76, 154, 0.3);
    }

    /* === Flip Animation === */
    .flip-card .flip-upper {
      position: absolute;
      inset: 0;
      clip-path: inset(0 0 50% 0);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      background: linear-gradient(180deg, #2e2448 0%, #251e3c 100%);
      border-radius: 12px 12px 0 0;
      border-bottom: 1px solid rgba(0,0,0,0.5);
      z-index: 10;
      transform-origin: bottom center;
    }
    .flip-card .flip-upper .digit-text {
      transform: translateY(50%);
    }
    .flip-card .flip-upper.flipping {
      animation: flipUpper 0.6s ease-in forwards;
    }
    @keyframes flipUpper {
      0%   { transform: rotateX(0deg); }
      100% { transform: rotateX(-90deg); }
    }

    .flip-card .flip-lower {
      position: absolute;
      inset: 0;
      clip-path: inset(50% 0 0 0);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      background: linear-gradient(180deg, #1e1835 0%, #1a1230 100%);
      border-radius: 0 0 12px 12px;
      z-index: 10;
      transform-origin: top center;
      transform: rotateX(90deg);
    }
    .flip-card .flip-lower .digit-text {
      transform: translateY(-50%);
    }
    .flip-card .flip-lower.flipping {
      animation: flipLower 0.6s 0.3s ease-out forwards;
    }
    @keyframes flipLower {
      0%   { transform: rotateX(90deg); }
      100% { transform: rotateX(0deg); }
    }

    /* === Dark theme page overrides === */
    .focus-dark-bg {
      background: linear-gradient(135deg, #0f0a1a 0%, #1a0f2e 40%, #0d0618 100%);
      color: #e8e0f0;
    }

    /* === Glassmorphism Cards === */
    .glass-card {
      background: rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      transition: all 0.3s ease;
      cursor: pointer;
    }
    .glass-card:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(107, 76, 154, 0.4);
      transform: translateY(-4px);
      box-shadow: 0 12px 40px rgba(107, 76, 154, 0.2);
    }

    /* === Sound Panel === */
    .sound-panel {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 40;
    }
    .sound-panel-toggle {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(107, 76, 154, 0.8);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s ease;
      color: #e8e0f0;
    }
    .sound-panel-toggle:hover {
      background: rgba(107, 76, 154, 1);
      box-shadow: 0 4px 20px rgba(107, 76, 154, 0.5);
    }
    .sound-panel-content {
      position: absolute;
      bottom: 64px;
      right: 0;
      width: 320px;
      background: rgba(20, 14, 35, 0.95);
      backdrop-filter: blur(24px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
  `
  document.head.appendChild(styleEl)
}

/* ================================================================
   FlipDigit Component
   ================================================================ */

const FlipDigit: React.FC<{ digit: string; prevDigit: string }> = ({ digit, prevDigit }) => {
  const isFlipping = digit !== prevDigit

  return (
    <div className="flip-card">
      {/* Static lower: shows PREVIOUS digit (revealed after flip) */}
      <div className="card-face card-lower">
        <span className="digit-text">{prevDigit}</span>
      </div>

      {/* Static upper: shows CURRENT digit (always visible on top) */}
      <div className="card-face card-upper">
        <span className="digit-text">{digit}</span>
      </div>

      {/* Animated upper flap: starts showing PREVIOUS, flips down to reveal CURRENT */}
      <div className={`flip-upper${isFlipping ? ' flipping' : ''}`}>
        <span className="digit-text">{prevDigit}</span>
      </div>

      {/* Animated lower flap: starts hidden, flips down showing CURRENT */}
      <div className={`flip-lower${isFlipping ? ' flipping' : ''}`}>
        <span className="digit-text">{digit}</span>
      </div>
    </div>
  )
}

/* ================================================================
   FlipClock Component
   ================================================================ */

const FlipClock: React.FC = () => {
  const [now, setNow] = useState(new Date())
  const [prevDigits, setPrevDigits] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const currentDigits = hours + minutes + seconds

  const prevArr = prevDigits.length === 6
    ? prevDigits.split('')
    : hours.split('').concat(minutes.split(''), seconds.split(''))
  const currArr = currentDigits.split('')

  useEffect(() => {
    setPrevDigits(currentDigits)
  }, [currentDigits])

  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
  const dayStr = weekDays[now.getDay()]

  return (
    <div className="flex flex-col items-center">
      <div className="flip-clock-wrapper">
        <FlipDigit digit={currArr[0]} prevDigit={prevArr[0]} />
        <FlipDigit digit={currArr[1]} prevDigit={prevArr[1]} />

        <div className="flip-clock-separator">
          <span />
          <span />
        </div>

        <FlipDigit digit={currArr[2]} prevDigit={prevArr[2]} />
        <FlipDigit digit={currArr[3]} prevDigit={prevArr[3]} />

        <div className="flip-clock-separator">
          <span />
          <span />
        </div>

        <FlipDigit digit={currArr[4]} prevDigit={prevArr[4]} />
        <FlipDigit digit={currArr[5]} prevDigit={prevArr[5]} />
      </div>

      <div className="mt-6 text-lg tracking-widest" style={{ color: 'rgba(232, 224, 240, 0.5)' }}>
        {dateStr} {dayStr}
      </div>
    </div>
  )
}

/* ================================================================
   Mode Entry Cards Config
   ================================================================ */

const modeEntries = [
  {
    key: 'countUp' as const,
    title: '正计时',
    desc: '自由计时，记录你的专注时长',
    icon: Zap,
    gradient: 'linear-gradient(135deg, rgba(107,76,154,0.3) 0%, rgba(107,76,154,0.05) 100%)',
    iconBg: 'rgba(107, 76, 154, 0.2)',
  },
  {
    key: 'countDown' as const,
    title: '倒计时',
    desc: '设定目标时间，高效完成每一段专注',
    icon: Clock,
    gradient: 'linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(59,130,246,0.05) 100%)',
    iconBg: 'rgba(59, 130, 246, 0.2)',
  },
  {
    key: 'pomodoro' as const,
    title: '番茄钟',
    desc: '专注与休息交替，保持最佳状态',
    icon: Target,
    gradient: 'linear-gradient(135deg, rgba(239,68,68,0.3) 0%, rgba(239,68,68,0.05) 100%)',
    iconBg: 'rgba(239, 68, 68, 0.2)',
  },
]

/* ================================================================
   FocusPage Component
   ================================================================ */

const FocusPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAppStore()
  const { tasks, updateTask, addTask } = useTodoStore()
  const addNotification = useAppStore((state) => state.addNotification)

  // ---- Page state: 'home' or 'timer' ----
  const [page, setPage] = useState<'home' | 'timer'>('home')

  // ---- 计时状态 ----
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

  // ---- 白噪音 ----
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
  const [showSoundPanel, setShowSoundPanel] = useState(false)

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
      id: generateUUID(),
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
      setIsRest(true)
      setElapsed(0)
      setTargetDuration(pomodoroRestMin * 60)
      setIsRunning(false)
      addNotification({ message: `专注完成！休息 ${pomodoroRestMin} 分钟`, type: 'success' })
    } else {
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
      if (elapsed > 0) {
        const session: FocusSession = {
          id: generateUUID(),
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
      const session: FocusSession = {
        id: generateUUID(),
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

  // ---- 白噪音控制 ----
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

  // ---- 进入计时模式 ----
  const enterMode = (m: 'countUp' | 'countDown' | 'pomodoro') => {
    setMode(m)
    setPage('timer')
  }

  // ---- 返回首页 ----
  const goHome = () => {
    pauseTimer()
    setElapsed(0)
    setIsRest(false)
    setPage('home')
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
    return (
      <div className="text-center py-4">
        <p className="text-sm text-[var(--text-secondary)]">正计时模式无需额外设置</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">点击开始后即可自由计时</p>
      </div>
    )
  }

  // ---- Render: White Noise Floating Panel (shared between home & timer) ----
  const renderSoundPanel = () => (
    <div className="sound-panel">
      {/* Toggle Button */}
      <button
        className="sound-panel-toggle"
        onClick={() => setShowSoundPanel(!showSoundPanel)}
        title="白噪音"
      >
        <Headphones size={22} />
        {soundPlaying && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#4ade80',
              border: '2px solid rgba(20,14,35,0.9)',
            }}
          />
        )}
      </button>

      {/* Expandable Panel */}
      <AnimatePresence>
        {showSoundPanel && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="sound-panel-content"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Headphones size={16} style={{ color: '#6B4C9A' }} />
                <span className="text-sm font-semibold" style={{ color: '#e8e0f0' }}>白噪音</span>
              </div>
              <button
                onClick={() => setShowSoundPanel(false)}
                style={{ color: 'rgba(232,224,240,0.5)' }}
                className="hover:opacity-80 transition-opacity"
              >
                <X size={16} />
              </button>
            </div>

            {/* Sound select */}
            <div className="mb-3">
              <select
                value={soundIndex}
                onChange={(e) => handleSoundSelect(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border"
                style={{
                  borderColor: 'rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#e8e0f0',
                }}
              >
                {soundList.map((sound, idx) => (
                  <option key={sound.id} value={idx} style={{ background: '#1a1230', color: '#e8e0f0' }}>
                    {sound.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Playback controls */}
            <div className="flex items-center justify-center gap-4 mb-3">
              <button
                onClick={prevSound}
                style={{ color: 'rgba(232,224,240,0.4)' }}
                className="hover:opacity-80 transition-opacity"
              >
                <SkipBack size={16} />
              </button>
              <button
                onClick={toggleSound}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{
                  background: '#6B4C9A',
                  color: '#fff',
                }}
              >
                {soundPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button
                onClick={nextSound}
                style={{ color: 'rgba(232,224,240,0.4)' }}
                className="hover:opacity-80 transition-opacity"
              >
                <SkipForward size={16} />
              </button>
            </div>

            {/* Play mode */}
            <div className="flex items-center gap-1 mb-3">
              {([
                { key: 'single' as const, icon: Repeat, label: '单曲循环' },
                { key: 'list' as const, icon: ListMusic, label: '列表循环' },
                { key: 'shuffle' as const, icon: Shuffle, label: '随机播放' },
              ]).map((m) => (
                <button
                  key={m.key}
                  onClick={() => setPlayMode(m.key)}
                  title={m.label}
                  className="flex-1 py-1.5 rounded-md text-xs flex items-center justify-center gap-1 transition-colors"
                  style={{
                    background: playMode === m.key ? 'rgba(107,76,154,0.2)' : 'transparent',
                    color: playMode === m.key ? '#6B4C9A' : 'rgba(232,224,240,0.35)',
                  }}
                >
                  <m.icon size={14} />
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              ))}
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3">
              <VolumeX size={14} style={{ color: 'rgba(232,224,240,0.35)', flexShrink: 0 }} />
              <div className="flex-1 relative h-5 flex items-center">
                <div className="absolute left-0 right-0 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <div
                  className="absolute left-0 h-1.5 rounded-full"
                  style={{ width: `${soundVolume}%`, background: '#6B4C9A' }}
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
                  className="absolute w-3.5 h-3.5 rounded-full shadow border-2"
                  style={{
                    left: `calc(${soundVolume}% - 7px)`,
                    background: '#6B4C9A',
                    borderColor: 'rgba(20,14,35,0.9)',
                  }}
                />
              </div>
              <Volume2 size={14} style={{ color: 'rgba(232,224,240,0.35)', flexShrink: 0 }} />
              <span className="text-xs w-8 text-right" style={{ color: 'rgba(232,224,240,0.6)' }}>{soundVolume}%</span>
            </div>

            {/* Upload custom sound */}
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setShowSoundUpload(true)}
                className="flex items-center gap-1.5 text-xs hover:underline"
                style={{ color: '#6B4C9A' }}
              >
                <Upload size={12} />
                上传自定义音效
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  /* ================================================================
     RENDER
     ================================================================ */

  return (
    <div className={`page-container h-full overflow-y-auto ${page === 'home' ? 'focus-dark-bg' : ''}`}>
      {/* ==================== HOME VIEW ==================== */}
      {page === 'home' && (
        <div className="h-full flex flex-col items-center justify-center relative">
          {/* Background decorative glowing orbs */}
          <div
            style={{
              position: 'absolute',
              top: '10%',
              left: '15%',
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(107,76,154,0.15) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '15%',
              right: '10%',
              width: 400,
              height: 400,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(107,76,154,0.1) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* Flip Clock */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{ position: 'relative', zIndex: 1 }}
          >
            <FlipClock />
          </motion.div>

          {/* Mode Entry Cards (Glassmorphism) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex gap-6 mt-16"
            style={{ position: 'relative', zIndex: 1 }}
          >
            {modeEntries.map((entry) => {
              const IconComp = entry.icon
              return (
                <div
                  key={entry.key}
                  className="glass-card flex flex-col items-center p-8 w-52"
                  onClick={() => enterMode(entry.key)}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: entry.iconBg }}
                  >
                    <IconComp size={26} style={{ color: '#e8e0f0' }} />
                  </div>
                  <h3 className="text-base font-semibold mb-2" style={{ color: '#e8e0f0' }}>
                    {entry.title}
                  </h3>
                  <p className="text-xs text-center leading-relaxed" style={{ color: 'rgba(232,224,240,0.5)' }}>
                    {entry.desc}
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-xs" style={{ color: 'rgba(107,76,154,0.8)' }}>
                    <span>开始</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              )
            })}
          </motion.div>

          {/* Stats link at bottom */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={() => navigate('/focus/stats')}
            className="mt-12 flex items-center gap-2 text-sm transition-colors"
            style={{ color: 'rgba(232,224,240,0.4)', position: 'relative', zIndex: 1 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(232,224,240,0.7)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(232,224,240,0.4)')}
          >
            <BarChart2 size={16} />
            <span>数据统计</span>
          </motion.button>
        </div>
      )}

      {/* ==================== TIMER VIEW ==================== */}
      {page === 'timer' && (
        <div className="h-full flex flex-col focus-dark-bg">
          <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col min-h-0 px-4">
            {/* Top bar */}
            <div className="flex items-center justify-between py-4">
              <button
                onClick={goHome}
                className="flex items-center gap-1.5 text-sm transition-colors"
                style={{ color: 'rgba(232,224,240,0.5)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(232,224,240,0.8)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(232,224,240,0.5)')}
              >
                <span style={{fontSize: '16px'}}>←</span>
                <span>返回</span>
              </button>

              <div className="flex items-center gap-1 p-1" style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
                {([
                  { key: 'countUp' as const, label: '正计时' },
                  { key: 'countDown' as const, label: '倒计时' },
                  { key: 'pomodoro' as const, label: '番茄钟' },
                ]).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    className="px-4 py-1.5 text-sm font-medium rounded-md transition-all"
                    style={{
                      background: mode === m.key ? '#6B4C9A' : 'transparent',
                      color: mode === m.key ? '#fff' : 'rgba(232,224,240,0.5)',
                      boxShadow: mode === m.key ? '0 2px 8px rgba(107,76,154,0.3)' : 'none',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/focus/stats')}
                  className="text-sm flex items-center gap-1 transition-colors"
                  style={{ color: '#6B4C9A' }}
                >
                  <BarChart2 size={16} />
                  <span>统计</span>
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: 'rgba(232,224,240,0.5)' }}
                  title="设置"
                >
                  <Settings size={18} />
                </button>
              </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 flex gap-6 min-h-0">
              {/* Left: Timer core */}
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
                    {/* Timer digits */}
                    <div
                      className="text-7xl md:text-8xl font-bold tracking-tight font-mono mb-4"
                      style={{ color: isRest ? '#2dd4bf' : '#6B4C9A' }}
                    >
                      {formatTime(displayTime)}
                    </div>

                    {/* Pomodoro count */}
                    {mode === 'pomodoro' && !isRest && (
                      <div className="text-sm mb-3" style={{ color: 'rgba(232,224,240,0.5)' }}>
                        第 {pomodoroCount + 1} 个番茄 · 已完成 {pomodoroCount} 个
                      </div>
                    )}
                    {isRest && (
                      <div className="text-sm mb-3 font-medium" style={{ color: '#2dd4bf' }}>
                        休息时间
                      </div>
                    )}

                    {/* Theme / task line */}
                    <div className="mb-8">
                      <button
                        onClick={() => {
                          const newTheme = prompt('请输入专注主题：', focusTheme)
                          if (newTheme) setFocusTheme(newTheme)
                        }}
                        className="text-base transition-colors"
                        style={{ color: 'rgba(232,224,240,0.6)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#e8e0f0')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(232,224,240,0.6)')}
                      >
                        {linkedTask ? `📋 ${linkedTask.title}` : focusTheme}
                      </button>
                      {linkedTask && (
                        <button
                          onClick={() => setLinkedTaskId(null)}
                          className="ml-2 text-xs transition-colors"
                          style={{ color: 'rgba(232,224,240,0.35)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(232,224,240,0.6)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(232,224,240,0.35)')}
                        >
                          解除关联
                        </button>
                      )}
                    </div>

                    {/* Progress bar */}
                    {(mode === 'countDown' || mode === 'pomodoro') && targetDuration > 0 && (
                      <div
                        className="w-full max-w-md mx-auto h-2 rounded-full mb-8 overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.06)' }}
                      >
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: isRest ? '#2dd4bf' : '#6B4C9A' }}
                          animate={{ width: `${Math.min(progress, 100)}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    )}

                    {/* Quick duration options (countdown) */}
                    {mode === 'countDown' && !isRunning && elapsed === 0 && (
                      <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
                        {countdownOptions.map((min) => (
                          <button
                            key={min}
                            onClick={() => setTargetDuration(min * 60)}
                            className="px-3 py-1.5 text-xs rounded-md transition-colors"
                            style={{
                              background: targetDuration === min * 60 ? '#6B4C9A' : 'rgba(255,255,255,0.06)',
                              color: targetDuration === min * 60 ? '#fff' : 'rgba(232,224,240,0.5)',
                            }}
                          >
                            {min} 分钟
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            const input = prompt('输入分钟数：', '25')
                            if (input) setTargetDuration(parseInt(input) * 60)
                          }}
                          className="px-3 py-1.5 text-xs rounded-md transition-colors"
                          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(232,224,240,0.5)' }}
                        >
                          自定义
                        </button>
                      </div>
                    )}

                    {/* Pomodoro rest hint */}
                    {mode === 'pomodoro' && isRest && !isRunning && elapsed === 0 && (
                      <div className="mb-6">
                        <p className="text-sm" style={{ color: 'rgba(232,224,240,0.5)' }}>
                          专注 {pomodoroFocusMin} 分钟完成！开始 {pomodoroRestMin} 分钟休息
                        </p>
                      </div>
                    )}

                    {/* Control buttons */}
                    <div className="flex items-center justify-center gap-4">
                      <button
                        onClick={resetTimer}
                        className="p-3 rounded-full transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          color: 'rgba(232,224,240,0.5)',
                        }}
                        title="重置"
                      >
                        <RotateCcw size={20} />
                      </button>

                      <button
                        onClick={isRunning ? pauseTimer : startTimer}
                        className="p-5 rounded-full transition-all shadow-lg"
                        style={{
                          background: isRunning ? '#f59e0b' : '#6B4C9A',
                          color: '#fff',
                        }}
                      >
                        {isRunning ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
                      </button>

                      <button
                        onClick={endSession}
                        className="p-3 rounded-full transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          color: 'rgba(232,224,240,0.5)',
                        }}
                        title="结束"
                      >
                        <Square size={20} />
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Right: Task panel */}
              <div className="flex-1 flex flex-col gap-4 min-w-[280px] max-w-[360px]">
                <div
                  className="flex-1 flex flex-col min-h-0 p-4"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold" style={{ color: '#e8e0f0' }}>关联任务</h3>
                    <button
                      onClick={() => {
                        const title = prompt('新建任务标题：')
                        if (title) {
                          addTask({
                            id: generateUUID(),
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
                      className="text-xs hover:underline"
                      style={{ color: '#6B4C9A' }}
                    >
                      + 新建任务
                    </button>
                  </div>

                  <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
                    {incompleteTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 p-2 rounded-md transition-colors"
                        style={{
                          background: linkedTaskId === task.id ? 'rgba(107,76,154,0.15)' : 'transparent',
                        }}
                      >
                        <button
                          onClick={() => toggleTaskComplete(task.id)}
                          className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors"
                          style={{
                            background: task.is_completed ? '#6B4C9A' : 'transparent',
                            borderColor: task.is_completed ? '#6B4C9A' : 'rgba(255,255,255,0.15)',
                          }}
                        >
                          {task.is_completed && <Check size={10} style={{ color: '#fff' }} />}
                        </button>
                        <span
                          className="text-sm flex-1 truncate cursor-pointer"
                          style={{
                            color: linkedTaskId === task.id ? '#6B4C9A' : '#e8e0f0',
                            fontWeight: linkedTaskId === task.id ? 500 : 400,
                          }}
                          onClick={() => setLinkedTaskId(task.id === linkedTaskId ? null : task.id)}
                        >
                          {task.title}
                        </span>
                      </div>
                    ))}
                    {incompleteTasks.length === 0 && (
                      <p className="text-xs text-center py-4" style={{ color: 'rgba(232,224,240,0.3)' }}>暂无待办任务</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== WHITE NOISE FLOATING PANEL (shared) ==================== */}
      {renderSoundPanel()}

      {/* ==================== 结算弹窗 ==================== */}
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
              className="rounded-2xl shadow-xl p-6 w-96 mx-4"
              style={{ background: '#1a1230', border: '1px solid rgba(255,255,255,0.08)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-center mb-4" style={{ color: '#e8e0f0' }}>
                {isRest ? '休息结束' : '专注完成'}
              </h3>

              <div className="space-y-3 mb-5">
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'rgba(232,224,240,0.5)' }}>时长</span>
                  <span className="font-medium" style={{ color: '#e8e0f0' }}>{formatTime(summaryData.duration)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'rgba(232,224,240,0.5)' }}>模式</span>
                  <span className="font-medium" style={{ color: '#e8e0f0' }}>
                    {summaryData.mode === 'countUp' ? '正计时' : summaryData.mode === 'countDown' ? '倒计时' : '番茄钟'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'rgba(232,224,240,0.5)' }}>主题</span>
                  <span className="font-medium truncate max-w-[180px]" style={{ color: '#e8e0f0' }}>{summaryData.theme}</span>
                </div>
                {linkedTask && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'rgba(232,224,240,0.5)' }}>关联任务</span>
                    <span className="font-medium truncate max-w-[180px]" style={{ color: '#e8e0f0' }}>{linkedTask.title}</span>
                  </div>
                )}
              </div>

              {completedTaskIds.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs mb-2" style={{ color: 'rgba(232,224,240,0.5)' }}>本次完成的任务</p>
                  <div className="space-y-1">
                    {completedTaskIds.map((id) => {
                      const t = tasks.find((task) => task.id === id)
                      return t ? (
                        <div key={id} className="flex items-center gap-2 text-sm" style={{ color: '#e8e0f0' }}>
                          <Check size={12} style={{ color: '#4ade80' }} />
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
                    className="flex-1 py-2.5 text-sm font-medium transition-colors"
                    style={{ background: 'rgba(45,212,191,0.15)', color: '#2dd4bf', borderRadius: 8 }}
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
                  className="flex-1 py-2.5 text-sm font-medium transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#e8e0f0', borderRadius: 8 }}
                >
                  {isRest ? '开始专注' : '再来一轮'}
                </button>
                <button
                  onClick={() => setShowSummary(false)}
                  className="flex-1 py-2.5 text-sm font-medium transition-colors"
                  style={{ background: '#6B4C9A', color: '#fff', borderRadius: 8 }}
                >
                  保存并退出
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== 设置弹窗 ==================== */}
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
              className="rounded-2xl shadow-xl p-6 w-80 mx-4"
              style={{ background: '#1a1230', border: '1px solid rgba(255,255,255,0.08)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{ color: '#e8e0f0' }}>
                  {mode === 'pomodoro' ? '番茄钟设置' : mode === 'countDown' ? '倒计时设置' : '正计时'}
                </h3>
                <button
                  onClick={() => setShowSettings(false)}
                  style={{ color: 'rgba(232,224,240,0.5)' }}
                >
                  <X size={18} />
                </button>
              </div>

              {renderSettingsContent()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== 自定义音效上传弹窗 ==================== */}
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
              className="rounded-2xl shadow-xl p-6 w-96 mx-4 max-h-[70vh] overflow-y-auto"
              style={{ background: '#1a1230', border: '1px solid rgba(255,255,255,0.08)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{ color: '#e8e0f0' }}>我的音效</h3>
                <button
                  onClick={() => setShowSoundUpload(false)}
                  style={{ color: 'rgba(232,224,240,0.5)' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Upload button */}
              <label
                className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors mb-4"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(107,76,154,0.5)'
                  e.currentTarget.style.background = 'rgba(107,76,154,0.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <Upload size={18} style={{ color: '#6B4C9A' }} />
                <span className="text-sm" style={{ color: '#6B4C9A' }}>上传音效（mp3/wav/flac）</span>
                <input type="file" accept="audio/mp3,audio/wav,audio/flac,audio/mpeg" className="hidden" onChange={handleSoundUpload} />
              </label>

              {/* Custom sound list */}
              <div className="space-y-2">
                {soundList.filter((s) => !s.isBuiltin).length === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: 'rgba(232,224,240,0.3)' }}>暂无自定义音效</p>
                )}
                {soundList.filter((s) => !s.isBuiltin).map((sound) => (
                  <div
                    key={sound.id}
                    className="flex items-center justify-between p-2 rounded-md"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <span className="text-sm truncate" style={{ color: '#e8e0f0' }}>{sound.name}</span>
                    <button
                      onClick={() => deleteCustomSound(sound.id)}
                      className="p-1 transition-colors"
                      style={{ color: 'rgba(232,224,240,0.4)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(232,224,240,0.4)')}
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