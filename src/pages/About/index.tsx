import React, { useState } from 'react'

interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

const changelog: ChangelogEntry[] = [
  {
    version: 'V1.0.1',
    date: '2026-07-10',
    changes: [
      '新增：Priva 专注计时功能模块',
      '新增：注册登录页帮助入口',
      '新增：关于页面更新日志',
      '优化：登录页图标替换为软件正式图标',
      '优化：全天日程在首页显示为「全天」',
      '优化：随心贴默认展示第一个主题墙',
      '优化：主任务完成时自动联动子任务完成',
      '优化：侧边栏导航顺序（首页置顶，设置置底）',
      '优化：实时记录图标库扩充',
      '修复：头像持久化保存问题',
      '修复：自动登录功能',
    ]
  },
  {
    version: 'V1.0.0',
    date: '2025-07-09',
    changes: [
      '初始版本发布',
      '包含任务待办、日历日程、宏观规划、习惯打卡、随心贴、实时记录六大核心模块',
      '支持云端同步与本地加密缓存',
    ]
  }
]

const About: React.FC = () => {
  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email).then(() => {
      // 可以用 alert 或其他方式提示
      alert('邮箱已复制到剪贴板')
    })
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      {/* 品牌视觉区 */}
      <div className="text-center py-6">
        <img src="/icon.png" alt="PrivaHub" className="w-16 h-16 rounded-2xl mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-[#222]">PrivaHub</h1>
        <p className="text-sm text-[#777] mt-1">您的私人工作台</p>
        <div className="border-b border-gray-200 mt-4" />
      </div>

      {/* 软件信息卡片 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-base font-semibold text-[#222] mb-3">软件信息</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[#777]">当前版本</span>
            <span className="text-[#222] font-medium">V0.1.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#777]">构建日期</span>
            <span className="text-[#222]">2025-07-09</span>
          </div>
          <p className="text-xs text-[#aaa] mt-2 pt-2 border-t border-gray-50">
            Electron + Supabase 云端同步 | 本地加密缓存
          </p>
        </div>
      </div>

      {/* 产品简介卡片 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-base font-semibold text-[#222] mb-3">关于 PrivaHub</h2>
        <p className="text-sm text-[#555] leading-relaxed">
          PrivaHub 是专为单人打造的私密个人工作台，整合任务待办、日历日程、长期宏观规划、习惯打卡、随心贴灵感画布五大核心功能。
        </p>
        <p className="text-sm text-[#555] leading-relaxed mt-2">
          全程数据隔离保护，依托行级安全策略（RLS）实现专属数据隔离，本地缓存加密存储，卸载仅靠账号同步恢复数据，兼顾离线使用与多端云端互通。
        </p>
      </div>

      {/* 更新日志 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-base font-semibold text-[#222] mb-3">更新日志</h2>
        <div className="space-y-3">
          {changelog.slice(0, 3).map((entry, idx) => (
            <details key={entry.version} className="group" open={idx === 0}>
              <summary className="flex items-center justify-between cursor-pointer list-none py-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-[#222]">{entry.version}</span>
                  <span className="text-xs text-[#aaa]">{entry.date}</span>
                </div>
                <span className="text-xs text-[#6B4C9A] group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <ul className="space-y-1.5 pb-2 pl-2">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[#555]">
                    <span className="text-[#6B4C9A] mt-0.5 flex-shrink-0">•</span>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </div>

      {/* 联系我卡片 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-base font-semibold text-[#222] mb-3">联系我</h2>
        <p className="text-sm text-[#555] leading-relaxed mb-3">
          如果你有功能建议、BUG 异常、UI 优化想法，欢迎提交反馈，我会持续迭代优化软件体验。
        </p>
        <div
          className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] rounded-lg cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
          onClick={() => handleCopyEmail('pgwoo_228@outlook.com')}
        >
          <span className="text-sm text-[#555]">商务 / 开发 / 反馈专用邮箱：</span>
          <span className="text-sm font-medium text-[#6B4C9A]">pgwoo_228@outlook.com</span>
          <span className="text-xs text-[#aaa]">（点击复制）</span>
        </div>
        <p className="text-xs text-[#aaa] mt-2">邮件建议标注来意，如「PrivaHub 反馈」，我会尽快回复</p>
      </div>

      {/* 数据安全说明卡片 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-base font-semibold text-[#222] mb-3">数据安全说明</h2>
        <ul className="space-y-2 text-sm text-[#555] leading-relaxed">
          <li className="flex gap-2">
            <span className="text-[#6B4C9A] mt-0.5">•</span>
            <span>所有云端数据启用行级安全 RLS，仅本人账号可读写专属内容；</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[#6B4C9A] mt-0.5">•</span>
            <span>删除内容自动进入回收站，保留 7 天支持恢复，到期永久清除；</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[#6B4C9A] mt-0.5">•</span>
            <span>本地缓存仅本机存储，无自动本地备份，重装仅通过登录云端恢复；</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[#6B4C9A] mt-0.5">•</span>
            <span>不收集任何无关用户行为数据，无第三方数据共享。</span>
          </li>
        </ul>
        <button className="mt-3 text-sm text-[#6B4C9A] hover:underline">
          《完整隐私政策》
        </button>
      </div>
    </div>
  )
}

export default About
