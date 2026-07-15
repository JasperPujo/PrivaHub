import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SummaryCard, AreaChart, PieChart, StatsCard, ScatterChart } from '@/components/Statistics'
import { ChevronLeft } from '@/utils/icons'

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

const FocusStatsPage: React.FC = () => {
  const navigate = useNavigate()
  const [dateRange, setDateRange] = useState<7 | 30 | 90>(30)

  const focusSessions: FocusSession[] = useMemo(() => {
    const saved = localStorage.getItem('focus_sessions')
    return saved ? JSON.parse(saved) : []
  }, [])

  // 仅统计专注会话（排除休息）
  const focusOnly = focusSessions.filter(s => !s.isRest)

  // 根据 dateRange 过滤数据
  const filteredSessions = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - dateRange)
    cutoff.setHours(0, 0, 0, 0)
    return focusOnly.filter(s => new Date(s.startTime) >= cutoff)
  }, [focusOnly, dateRange])

  const stats = useMemo(() => {
    const totalSessions = filteredSessions.length
    const totalSeconds = filteredSessions.reduce((sum, s) => sum + s.duration, 0)
    const totalHours = (totalSeconds / 3600).toFixed(1)
    const avgMinutes = totalSessions > 0 ? Math.round(totalSeconds / totalSessions / 60) : 0

    // 近N天专注时长趋势（分钟）
    const daysData: { date: string; value: number }[] = []
    for (let i = dateRange - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const nextDay = new Date(d)
      nextDay.setDate(nextDay.getDate() + 1)

      const daySeconds = filteredSessions
        .filter(s => {
          const sessionDate = new Date(s.startTime)
          return sessionDate >= d && sessionDate < nextDay
        })
        .reduce((sum, s) => sum + s.duration, 0)

      daysData.push({
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        value: Math.round(daySeconds / 60),
      })
    }

    // 各时段专注占比（早晨/上午/下午/晚上）
    const periodMap: Record<string, number> = {
      '早晨(6-9)': 0,
      '上午(9-12)': 0,
      '下午(12-18)': 0,
      '晚上(18-24)': 0,
      '深夜(0-6)': 0
    }
    filteredSessions.forEach(s => {
      const hour = new Date(s.startTime).getHours()
      if (hour >= 6 && hour < 9) periodMap['早晨(6-9)'] += s.duration
      else if (hour >= 9 && hour < 12) periodMap['上午(9-12)'] += s.duration
      else if (hour >= 12 && hour < 18) periodMap['下午(12-18)'] += s.duration
      else if (hour >= 18 && hour < 24) periodMap['晚上(18-24)'] += s.duration
      else periodMap['深夜(0-6)'] += s.duration
    })
    const periodPieData = Object.entries(periodMap)
      .map(([name, value]) => ({ name, value: Math.round(value / 60) }))
      .filter(d => d.value > 0)

    // 每日专注次数（BarChart）
    const dailyCountData: { date: string; value: number }[] = []
    for (let i = dateRange - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const nextDay = new Date(d)
      nextDay.setDate(nextDay.getDate() + 1)

      const count = filteredSessions.filter(s => {
        const sessionDate = new Date(s.startTime)
        return sessionDate >= d && sessionDate < nextDay
      }).length

      dailyCountData.push({
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        value: count,
      })
    }

    // 散点图：专注时长(min) vs 开始时间(小时)
    const scatterData = filteredSessions.map(s => ({
      x: new Date(s.startTime).getHours(),
      y: Math.round(s.duration / 60),
      name: s.theme
    }))

    return { totalSessions, totalHours, avgMinutes, daysData, periodPieData, dailyCountData, scatterData }
  }, [filteredSessions, dateRange])

  return (
    <div className="page-container">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-[#6B4C9A] mb-4">
          <ChevronLeft size={16} />
          <span>返回</span>
        </button>

        <h1 className="page-title mb-6">专注数据统计</h1>

        {focusOnly.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">暂无专注数据</div>
        ) : (
          <div className="space-y-4">
            {/* 日期范围选择器 */}
            <div className="flex gap-2 mb-4">
              {[7, 30, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setDateRange(d as 7 | 30 | 90)}
                  className={`px-3 py-1.5 rounded-full text-xs ${dateRange === d ? 'bg-[#6B4C9A] text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  近{d}天
                </button>
              ))}
            </div>

            {/* 3个汇总卡片 */}
            <div className="grid grid-cols-3 gap-3">
              <SummaryCard label="总专注次数" value={stats.totalSessions} />
              <SummaryCard label="总专注时长" value={`${stats.totalHours}h`} />
              <SummaryCard label="平均时长" value={`${stats.avgMinutes}min`} />
            </div>

            {/* 专注时长趋势（面积图） */}
            <AreaChart title={`近${dateRange}天专注时长趋势（分钟）`} data={stats.daysData} color="#6B4C9A" />

            {/* 各时段专注占比（饼图） */}
            <PieChart title="各时段专注占比" data={stats.periodPieData} />

            {/* 每日专注次数（BarChart） */}
            <StatsCard title={`每日专注次数（近${dateRange}天）`} data={stats.dailyCountData} type="bar" color="#6B4C9A" />

            {/* 散点图：专注时长 vs 开始时间 */}
            <ScatterChart title="专注时长 vs 开始时间" data={stats.scatterData} xName="开始时间（小时）" yName="专注时长（分钟）" />
          </div>
        )}
      </div>
    </div>
  )
}

export default FocusStatsPage