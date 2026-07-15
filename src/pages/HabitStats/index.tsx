import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHabitStore } from '@/store'
import { SummaryCard, AreaChart, PieChart, StatsCard, RadarChart } from '@/components/Statistics'
import { ChevronLeft } from '@/utils/icons'

const HabitStatsPage: React.FC = () => {
  const navigate = useNavigate()
  const { habits } = useHabitStore()
  const activeHabits = habits.filter(h => !h.deleted_at)
  const [selectedHabit, setSelectedHabit] = useState<string>('all')

  // 根据 selectedHabit 过滤数据
  const filteredHabits = useMemo(() => {
    if (selectedHabit === 'all') return activeHabits
    return activeHabits.filter(h => h.id === selectedHabit)
  }, [activeHabits, selectedHabit])

  const stats = useMemo(() => {
    const positiveHabits = filteredHabits.filter(h => h.type === 'positive')

    // 总打卡次数
    const totalCheckIns = filteredHabits.reduce((sum, h) => sum + h.checkins.length, 0)

    // 当前连续天数（取所有积极习惯中最大的当前连续值）
    let currentStreak = 0
    for (const habit of positiveHabits) {
      const checkinSet = new Set(habit.checkins.map(c => c.date))
      let s = 0
      for (let i = 0; i < 365; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        if (checkinSet.has(ds)) s++
        else if (i > 0) break
      }
      currentStreak = Math.max(currentStreak, s)
    }

    // 最长连续天数（取所有习惯中最长的连续值）
    let maxStreak = 0
    for (const habit of filteredHabits) {
      const dates = habit.checkins.map(c => c.date).sort()
      let streak = 0
      let prevDate: Date | null = null
      for (const dateStr of dates) {
        const d = new Date(dateStr + 'T00:00:00')
        if (prevDate) {
          const diff = (d.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000)
          if (diff === 1) streak++
          else streak = 1
        } else {
          streak = 1
        }
        prevDate = d
        maxStreak = Math.max(maxStreak, streak)
      }
    }

    // 完成率（积极习惯近30天平均完成率）
    let completionRate = 0
    if (positiveHabits.length > 0) {
      let totalRate = 0
      for (const habit of positiveHabits) {
        const checkinSet = new Set(habit.checkins.map(c => c.date))
        let count = 0
        for (let i = 0; i < 30; i++) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          if (checkinSet.has(ds)) count++
        }
        totalRate += (count / 30) * 100
      }
      completionRate = Math.round(totalRate / positiveHabits.length)
    }

    // 近30天每日打卡总数趋势
    const last30DaysData: { date: string; value: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const count = filteredHabits.reduce((sum, h) => sum + h.checkins.filter(c => c.date === ds).length, 0)
      last30DaysData.push({ date: `${d.getMonth() + 1}/${d.getDate()}`, value: count })
    }

    // 各习惯打卡占比（环形饼图）
    const habitPieData = filteredHabits
      .map(h => ({ name: h.name, value: h.checkins.length }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)

    // 每周打卡次数对比（BarChart - 使用 StatsCard type='bar'）
    // 取最近8周的数据
    const weeklyData: { date: string; value: number }[] = []
    for (let i = 7; i >= 0; i--) {
      const weekEnd = new Date()
      weekEnd.setDate(weekEnd.getDate() - i * 7)
      const weekStart = new Date(weekEnd)
      weekStart.setDate(weekStart.getDate() - 6)
      const startStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
      const endStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`
      const count = filteredHabits.reduce((sum, h) => {
        return sum + h.checkins.filter(c => c.date >= startStr && c.date <= endStr).length
      }, 0)
      weeklyData.push({ date: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`, value: count })
    }

    // 雷达图：各习惯完成情况（近7天完成率、近30天完成率、总完成率、当前连续天数、最长连续天数）
    const radarIndicators = [
      { name: '近7天完成率', max: 100 },
      { name: '近30天完成率', max: 100 },
      { name: '总完成率', max: 100 },
      { name: '当前连续天数', max: 7 },
      { name: '最长连续天数', max: 30 },
    ]

    const radarData = filteredHabits.map(habit => {
      const checkinSet = new Set(habit.checkins.map(c => c.date))

      // 近7天完成率
      let count7 = 0
      for (let i = 0; i < 7; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        if (checkinSet.has(ds)) count7++
      }
      const rate7 = Math.round((count7 / 7) * 100)

      // 近30天完成率
      let count30 = 0
      for (let i = 0; i < 30; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        if (checkinSet.has(ds)) count30++
      }
      const rate30 = Math.round((count30 / 30) * 100)

      // 总完成率（从创建日起算）
      const createdDate = new Date(habit.created_at)
      const now = new Date()
      const totalDays = Math.max(1, Math.ceil((now.getTime() - createdDate.getTime()) / (24 * 60 * 60 * 1000)))
      const rateAll = Math.min(100, Math.round((habit.checkins.length / totalDays) * 100))

      // 当前连续天数
      let curStreak = 0
      for (let i = 0; i < 365; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        if (checkinSet.has(ds)) curStreak++
        else if (i > 0) break
      }

      // 最长连续天数
      let bestStreak = 0
      const sortedDates = habit.checkins.map(c => c.date).sort()
      let streak = 0
      let prevDate: Date | null = null
      for (const dateStr of sortedDates) {
        const d = new Date(dateStr + 'T00:00:00')
        if (prevDate) {
          const diff = (d.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000)
          if (diff === 1) streak++
          else streak = 1
        } else {
          streak = 1
        }
        prevDate = d
        bestStreak = Math.max(bestStreak, streak)
      }

      return { name: habit.name, value: [rate7, rate30, rateAll, curStreak, bestStreak] }
    })

    // 动态调整连续天数维度的 max，保证图表比例合理
    const maxCurStreak = Math.max(7, ...radarData.map(d => d.value[3]))
    const maxBestStreak = Math.max(30, ...radarData.map(d => d.value[4]))
    radarIndicators[3].max = maxCurStreak
    radarIndicators[4].max = maxBestStreak

    return { totalCheckIns, currentStreak, maxStreak, completionRate, last30DaysData, habitPieData, weeklyData, radarIndicators, radarData }
  }, [filteredHabits])

  return (
    <div className="page-container">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-[#6B4C9A] mb-4">
          <ChevronLeft size={16} />
          <span>返回</span>
        </button>

        <h1 className="page-title mb-6">习惯数据统计</h1>

        {activeHabits.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">暂无习惯数据</div>
        ) : (
          <div className="space-y-4">
            {/* 习惯选择器 */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <button
                onClick={() => setSelectedHabit('all')}
                className={`px-3 py-1.5 rounded-full text-xs ${selectedHabit === 'all' ? 'bg-[#6B4C9A] text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                全部
              </button>
              {activeHabits.map(h => (
                <button
                  key={h.id}
                  onClick={() => setSelectedHabit(h.id)}
                  className={`px-3 py-1.5 rounded-full text-xs ${selectedHabit === h.id ? 'bg-[#6B4C9A] text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  {h.name}
                </button>
              ))}
            </div>

            {/* 4个汇总卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label="总打卡次数" value={stats.totalCheckIns} />
              <SummaryCard label="当前连续天数" value={stats.currentStreak} sub="当前连续" />
              <SummaryCard label="最长连续天数" value={stats.maxStreak} />
              <SummaryCard label="平均完成率" value={`${stats.completionRate}%`} />
            </div>

            {/* 近30天打卡趋势（面积图） */}
            <AreaChart title="近30天打卡趋势" data={stats.last30DaysData} />

            {/* 各习惯打卡占比（环形饼图） */}
            <PieChart title="各习惯打卡占比" data={stats.habitPieData} />

            {/* 每周打卡次数对比（BarChart） */}
            <StatsCard title="每周打卡次数对比" data={stats.weeklyData} type="bar" />

            {/* 各习惯完成情况（雷达图） */}
            <RadarChart
              title="各习惯完成情况"
              indicators={stats.radarIndicators}
              data={stats.radarData}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default HabitStatsPage