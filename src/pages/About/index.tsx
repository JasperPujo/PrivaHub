import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Download, Check, AlertCircle, RefreshCw
} from '@/utils/icons'

declare global {
  interface Window {
    electronAPI?: {
      checkForUpdate: () => Promise<void>
      downloadUpdate: () => Promise<void>
      quitAndInstall: () => Promise<void>
      onUpdateAvailable: (cb: (info: { version: string; releaseNotes: string }) => void) => void
      onDownloadProgress: (cb: (progress: { percent: number; transferred: number; total: number; speed: number }) => void) => void
      onUpdateDownloaded: (cb: (info: { version: string }) => void) => void
      onUpdateError: (cb: (err: { message: string }) => void) => void
    }
  }
}

interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

const changelog: ChangelogEntry[] = [
  {
    version: 'V1.5.5',
    date: '2026-07-22',
    changes: [
      '修复：删除操作立即同步 deleted_at 到 Supabase，不再等全量同步',
      '修复：合并时本地已删除记录不会被远程未删除状态覆盖',
      '优化：实时记录日期改为两行显示（日期+时间分开），更清晰',
    ]
  },
  {
    version: 'V1.5.4',
    date: '2026-07-22',
    changes: [
      '修复：随心贴 content 渲染崩溃（兼容 string 和对象格式）',
      '修复：用户名不显示（Login setUser 字段名 name→username）',
      '修复：设置页版本号未同步更新',
      '优化：首页时间日期移到右侧，减少滚动',
      '优化：习惯卡片改为今日专注时长',
      '优化：实时记录卡片添加标题',
      '优化：登录页标题改为 PrivaHub 渐变动画',
    ]
  },
  {
    version: 'V1.5.2',
    date: '2026-07-20',
    changes: [
      '修复：删除数据显式二次推送 deleted_at，确保删除状态写入数据库',
      '修复：mergeRecords 删除状态优先，防止已删除记录被复活',
      '新增：settings 同步到 Supabase，换设备登录自动恢复设置',
      '优化：随心贴轮播主题墙选择改为下拉多选',
      '优化：修复自动登录分支，用户名正确显示',
    ]
  },
  {
    version: 'V1.4.4',
    date: '2026-07-20',
    changes: [
      '优化：主页新增随心贴轮播卡片，替代原习惯统计卡片',
      '新增：随心贴轮播支持齿轮按钮设置（秒数输入 + 主题墙多选）',
      '优化：轮播卡片显示4行内容、记录时间、主题墙名称',
    ]
  },
  {
    version: 'V1.4.3',
    date: '2026-07-20',
    changes: [
      '修复：mergeRecords 增加删除状态优先逻辑，防止已删除记录被复活',
      '修复：同步增加并发锁，防止多线程同步导致数据冲突',
      '优化：登录背景图更新',
    ]
  },
  {
    version: 'V1.4.2',
    date: '2026-07-20',
    changes: [
      '修复：改回先 pull 再 push 的同步策略，配合 mergeRecords >= 确保删除数据正确同步到云端',
      '修复：任务栏和托盘图标正确替换为 PrivaHub 新 logo',
      '修复：登录页 logo 同步更新',
    ]
  },
  {
    version: 'V1.4.1',
    date: '2026-07-20',
    changes: [
      '优化：彻底移除顶部栏重复标题，只保留侧边栏 logo',
      '优化：替换全新应用图标',
      '优化：替换登录页背景图',
      '优化：消极习惯独立统计图表，积极/消极并排对比展示',
      '优化：主题墙删除按钮移至编辑弹窗内',
    ]
  },
  {
    version: 'V1.4.0',
    date: '2026-07-20',
    changes: [
      '修复：删除数据被同步回来的问题（syncPull 过滤已删除记录）',
      '优化：习惯打卡备注支持全文展示，记录历史改为全量',
      '优化：习惯统计区分积极/消极习惯',
      '新增：设置页支持修改昵称和密码',
      '新增：设置页显示头像和完整个人信息',
      '优化：替换应用图标，隐藏重复的顶部标题',
      '优化：主题墙删除按钮改为低调样式',
    ]
  },
  {
    version: 'V1.3.3',
    date: '2026-07-20',
    changes: [
      '修复：同步时本地修改被远程旧数据覆盖的问题（改为先 push 再 pull）',
      '修复：mergeRecords 冲突解决策略，相等时优先保留本地',
    ]
  },
  {
    version: 'V1.3.2',
    date: '2026-07-20',
    changes: [
      '修复：彻底修复多账号数据交叉污染问题（清除内存状态 + 使用真实 user_id）',
      '修复：Tracker deleteEntry 改为软删除，避免同步后复活',
      '修复：trackerEntryToDb 补充 updated_at 字段',
      '修复：syncDelete 增加 user_id 过滤',
    ]
  },
  {
    version: 'V1.3.1',
    date: '2026-07-20',
    changes: [
      '新增：主题墙支持删除功能',
    ]
  },
  {
    version: 'V1.3.0',
    date: '2026-07-20',
    changes: [
      '修复：切换账号后旧账号数据泄漏到新账号的问题',
      '优化：注册成功提示由原生 alert 改为内嵌通知',
    ]
  },
  {
    version: 'V1.2.9',
    date: '2026-07-20',
    changes: [
      '修复：新设备首次登录同步无法拉取云端已有数据的问题',
    ]
  },
  {
    version: 'V1.2.8',
    date: '2026-07-20',
    changes: [
      '修复：数据同步失败的关键 Bug（syncPull 缺少查询执行导致所有表拉取异常）',
    ]
  },
  {
    version: 'V1.2.7',
    date: '2026-07-19',
    changes: [
      '优化：专注计时全屏模式下显示任务待办、白噪音控制',
      '新增：全屏模式支持按 Esc 退出全屏',
      '优化：全屏时返回按钮靠左、全屏按钮靠右布局',
    ]
  },
  {
    version: 'V1.2.6',
    date: '2026-07-19',
    changes: [
      '优化：版本号更新至 V1.2.6',
    ]
  },
  {
    version: 'V1.2.0',
    date: '2026-07-16',
    changes: [
      '新增：习惯统计完成率折线图、专注统计折线图/箱型图/时段趋势面积图',
      '优化：随心贴卡片高度自适应、纯图片支持',
      '优化：留言展示优化（默认3条+查看更多Modal）',
      '优化：文字换行和日期溢出处理',
      '优化：设置页精简，关于页整合检查更新功能',
      '修复：版本号更新至 V1.2.0',
    ]
  },
  {
    version: 'V1.1.1',
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
      alert('邮箱已复制到剪贴板')
    })
  }

  // ===== 检查更新相关状态和逻辑 =====
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'up-to-date'>('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updateProgress, setUpdateProgress] = useState(0)
  const [updateTransferred, setUpdateTransferred] = useState(0)
  const [updateTotal, setUpdateTotal] = useState(0)
  const [updateSpeed, setUpdateSpeed] = useState(0)
  const [updateErrorMsg, setUpdateErrorMsg] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const checkForUpdate = async () => {
    if (!window.electronAPI) {
      setUpdateStatus('checking')
      try {
        const response = await fetch('https://api.github.com/repos/JasperPujo/PrivaHub/releases/latest')
        const data = await response.json()
        const latestVersion = data.tag_name.replace('v', '')
        const currentVersion = '1.5.1'
        const compareVersions = (a: string, b: string) => {
          const partsA = a.split('.').map(Number)
          const partsB = b.split('.').map(Number)
          for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const va = partsA[i] || 0
            const vb = partsB[i] || 0
            if (va > vb) return 1
            if (va < vb) return -1
          }
          return 0
        }
        if (compareVersions(latestVersion, currentVersion) > 0) {
          setUpdateVersion(latestVersion)
          setReleaseNotes(data.body || '')
          setUpdateStatus('available')
        } else {
          setUpdateStatus('up-to-date')
        }
      } catch {
        setUpdateStatus('error')
        setUpdateErrorMsg('无法连接到服务器，请检查网络')
      }
      return
    }

    setUpdateStatus('checking')
    setUpdateErrorMsg('')
    window.electronAPI.checkForUpdate()
  }

  const startDownloadAndInstall = () => {
    if (!window.electronAPI) return
    setUpdateStatus('downloading')
    setUpdateProgress(0)
    window.electronAPI.downloadUpdate()
  }

  const handleQuitAndInstall = () => {
    if (!window.electronAPI) return
    window.electronAPI.quitAndInstall()
  }

  useEffect(() => {
    if (!window.electronAPI) return

    window.electronAPI.onUpdateAvailable((info) => {
      setUpdateVersion(info.version)
      setReleaseNotes(typeof info.releaseNotes === 'string' ? info.releaseNotes : '')
      setUpdateStatus('available')
    })

    window.electronAPI.onDownloadProgress((progress) => {
      setUpdateProgress(progress.percent)
      setUpdateTransferred(progress.transferred)
      setUpdateTotal(progress.total)
      setUpdateSpeed(progress.speed)
      setUpdateStatus('downloading')
    })

    window.electronAPI.onUpdateDownloaded((info) => {
      setUpdateVersion(info.version)
      setUpdateStatus('downloaded')
    })

    window.electronAPI.onUpdateError((err) => {
      setUpdateErrorMsg(err.message)
      setUpdateStatus('error')
    })
  }, [])

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
            <span className="text-[#222] font-medium">V1.5.4</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#777]">构建日期</span>
            <span className="text-[#222]">2026-07-19</span>
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
                <span className="text-xs text-[#6B4C9A] group-open:rotate-180 transition-transform">&#9660;</span>
              </summary>
              <ul className="space-y-1.5 pb-2 pl-2">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[#555]">
                    <span className="text-[#6B4C9A] mt-0.5 flex-shrink-0">&#8226;</span>
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
            <span className="text-[#6B4C9A] mt-0.5">&#8226;</span>
            <span>所有云端数据启用行级安全 RLS，仅本人账号可读写专属内容；</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[#6B4C9A] mt-0.5">&#8226;</span>
            <span>删除内容自动进入回收站，保留 7 天支持恢复，到期永久清除；</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[#6B4C9A] mt-0.5">&#8226;</span>
            <span>本地缓存仅本机存储，无自动本地备份，重装仅通过登录云端恢复；</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[#6B4C9A] mt-0.5">&#8226;</span>
            <span>不收集任何无关用户行为数据，无第三方数据共享。</span>
          </li>
        </ul>
        <button className="mt-3 text-sm text-[#6B4C9A] hover:underline">
          《完整隐私政策》
        </button>
      </div>

      {/* 检查更新卡片 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-base font-semibold text-[#222] mb-3">检查更新</h2>

        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-[#555]">当前版本 V1.5.1</span>
          <button
            onClick={checkForUpdate}
            disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
            className="px-4 py-1.5 text-xs bg-[#6B4C9A] text-white rounded-lg hover:bg-[#5a3f85] disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={12} />
            {updateStatus === 'checking' ? '检查中...' : updateStatus === 'downloading' ? '下载中...' : '检查更新'}
          </button>
        </div>

        {/* 检查中 */}
        {updateStatus === 'checking' && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-[#6B4C9A] rounded-full" />
            正在检查更新...
          </div>
        )}

        {/* 已是最新 */}
        {updateStatus === 'up-to-date' && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check size={16} />
            当前已是最新版本
          </div>
        )}

        {/* 发现新版本 */}
        {updateStatus === 'available' && (
          <div className="mt-2 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Download size={16} className="text-blue-600" />
              <p className="text-sm font-medium text-blue-700">发现新版本 v{updateVersion}</p>
            </div>
            {releaseNotes && (
              <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap max-h-24 overflow-y-auto">{releaseNotes}</pre>
            )}
            <button
              onClick={startDownloadAndInstall}
              className="mt-2 px-4 py-1.5 text-xs bg-[#6B4C9A] text-white rounded-lg hover:bg-[#5a3f85] transition-colors"
            >
              立即更新
            </button>
          </div>
        )}

        {/* 下载中 - 进度条 */}
        {updateStatus === 'downloading' && (
          <div className="mt-2 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full" />
                <span className="text-sm text-blue-700">正在下载更新...</span>
              </div>
              <span className="text-sm font-medium text-blue-700">{updateProgress}%</span>
            </div>
            <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#6B4C9A] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${updateProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-xs text-gray-500">
              <span>{formatBytes(updateTransferred)} / {formatBytes(updateTotal)}</span>
              {updateSpeed > 0 && <span>{formatBytes(updateSpeed)}/s</span>}
            </div>
          </div>
        )}

        {/* 下载完成 */}
        {updateStatus === 'downloaded' && (
          <div className="mt-2 p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Check size={16} className="text-green-600" />
              <p className="text-sm font-medium text-green-700">更新已下载完成 (v{updateVersion})</p>
            </div>
            <button
              onClick={handleQuitAndInstall}
              className="px-4 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              立即重启安装
            </button>
          </div>
        )}

        {/* 错误 */}
        {updateStatus === 'error' && (
          <div className="mt-2 p-3 bg-red-50 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              <p className="text-sm text-red-600">检查更新失败</p>
            </div>
            <p className="text-xs text-red-500 mt-1">{updateErrorMsg || '请稍后重试'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default About
