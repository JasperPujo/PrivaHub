import React, { useState } from 'react'
import { useAppStore } from '@/store'
import { motion } from 'framer-motion'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useNavigate } from 'react-router-dom'
import {
  Moon, Lock, Unlock, Bell, Volume2, VolumeX,
  ChevronRight, LogOut, User, Clock, Info
} from '@/utils/icons'

const SettingsPage: React.FC = () => {
  const navigate = useNavigate()
  const {
    user,
    settings,
    updateSettings,
    theme,
    toggleTheme,
    logout,
    setLockScreen,
    addNotification
  } = useAppStore()

  const [showLockPassword, setShowLockPassword] = useState(false)
  const [lockPassword, setLockPassword] = useState('')
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [checking, setChecking] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<{ hasUpdate: boolean; version?: string; notes?: string } | null>(null)

  const handleSetLockPassword = () => {
    if (!lockPassword.trim()) return
    const hashed = btoa(lockPassword)
    setLockScreen({
      passwordHash: hashed,
      isLocked: false,
      failedAttempts: 0,
      lockUntil: null
    })
    updateSettings({ lockScreenEnabled: true })
    setShowLockPassword(false)
    setLockPassword('')
    addNotification({ message: '锁屏密码已设置', type: 'success' })
  }

  const handleRemoveLock = () => {
    setLockScreen({
      passwordHash: '',
      isLocked: false,
      failedAttempts: 0,
      lockUntil: null
    })
    updateSettings({ lockScreenEnabled: false })
    addNotification({ message: '锁屏密码已移除', type: 'success' })
  }

  const checkForUpdate = async () => {
    setChecking(true)
    setUpdateInfo(null)
    try {
      // 从 GitHub API 检查最新版本（需替换为实际的仓库地址）
      const response = await fetch('https://api.github.com/repos/JasperPujo/PrivaHub/releases/latest')
      const data = await response.json()
      const latestVersion = data.tag_name.replace('v', '')
      const currentVersion = '1.0.1' // 从 package.json 读取

      // 版本号比较（按点分段数值比较，避免字符串比较的缺陷）
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
        setUpdateInfo({
          hasUpdate: true,
          version: latestVersion,
          notes: data.body
        })
      } else {
        setUpdateInfo({ hasUpdate: false })
      }
    } catch (err) {
      setUpdateInfo({ hasUpdate: false })
    }
    setChecking(false)
  }

  const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary-600' : 'bg-[var(--border-color)]'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )

  const settingsGroups = [
    {
      title: '外观',
      items: [
        {
          icon: Moon,
          label: '暗色模式',
          action: toggleTheme,
          toggle: true,
          toggleValue: theme === 'dark'
        }
      ]
    },
    {
      title: '安全',
      items: [
        {
          icon: settings.lockScreenEnabled ? Lock : Unlock,
          label: '锁屏密码',
          value: settings.lockScreenEnabled ? '已启用' : '未启用',
          action: () => {
            if (settings.lockScreenEnabled) handleRemoveLock()
            else setShowLockPassword(true)
          },
          toggle: false
        },
        {
          icon: Clock,
          label: '自动锁定',
          value: settings.autoLockEnabled ? `${settings.autoLockTimeout}分钟后锁定` : '已关闭',
          action: () => updateSettings({ autoLockEnabled: !settings.autoLockEnabled }),
          toggle: true,
          toggleValue: settings.autoLockEnabled
        }
      ]
    },
    {
      title: '通知',
      items: [
        {
          icon: settings.soundEnabled ? Volume2 : VolumeX,
          label: '提醒音效',
          value: settings.soundEnabled ? '已开启' : '已关闭',
          action: () => updateSettings({ soundEnabled: !settings.soundEnabled }),
          toggle: true,
          toggleValue: settings.soundEnabled
        },
        {
          icon: Bell,
          label: '日程提醒',
          value: settings.scheduleReminderEnabled ? '已开启' : '已关闭',
          action: () => updateSettings({ scheduleReminderEnabled: !settings.scheduleReminderEnabled }),
          toggle: true,
          toggleValue: settings.scheduleReminderEnabled
        }
      ]
    },
    {
      title: '登录',
      items: [
        {
          icon: User,
          label: '自动登录',
          value: settings.autoLogin ? '已开启' : '已关闭',
          action: () => updateSettings({ autoLogin: !settings.autoLogin }),
          toggle: true,
          toggleValue: settings.autoLogin
        },
        {
          icon: User,
          label: '记住密码',
          value: settings.rememberPassword ? '已开启' : '已关闭',
          action: () => updateSettings({ rememberPassword: !settings.rememberPassword }),
          toggle: true,
          toggleValue: settings.rememberPassword
        }
      ]
    }
  ]

  return (
    <div className="page-container">
      <div className="max-w-2xl mx-auto">
        <h1 className="page-title">设置</h1>

        {/* 用户信息卡片 */}
        <div className="card mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-card bg-primary-600/10 flex items-center justify-center">
              <User size={24} className="text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-[var(--text-primary)]">{user?.username || '用户'}</h2>
              <p className="text-sm text-[var(--text-secondary)]">{user?.email || ''}</p>
            </div>
          </div>
        </div>

        {/* 设置列表 */}
        <div className="space-y-6">
          {settingsGroups.map((group, idx) => (
            <motion.div
              key={group.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <h2 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2 px-1">
                {group.title}
              </h2>
              <div className="card divide-y divide-[var(--border-color)]">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={item.label}
                      className="flex items-center justify-between py-3.5 px-1"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} className="text-[var(--text-secondary)]" />
                        <span className="text-sm text-[var(--text-primary)]">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {item.toggle ? (
                          <div className="flex items-center gap-2">
                            {item.label === '自动锁定' && item.toggleValue && (
                              <select
                                value={settings.autoLockTimeout}
                                onChange={e => updateSettings({ autoLockTimeout: Number(e.target.value) })}
                                onClick={e => e.stopPropagation()}
                                className="text-xs bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1 text-[var(--text-primary)]"
                              >
                                <option value={5}>5分钟</option>
                                <option value={10}>10分钟</option>
                                <option value={15}>15分钟</option>
                                <option value={30}>30分钟</option>
                                <option value={60}>1小时</option>
                              </select>
                            )}
                            <ToggleSwitch checked={item.toggleValue!} onChange={item.action} />
                          </div>
                        ) : (
                          <>
                            <span className="text-sm text-[var(--text-tertiary)]">{item.value}</span>
                            <button onClick={item.action} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
                              <ChevronRight size={16} className="text-[var(--text-tertiary)]" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          ))}
        </div>

        {/* 关于 PrivaHub */}
        <div className="mt-2">
          <div className="card">
            <button
              onClick={() => navigate('/about')}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-left"
            >
              <Info size={18} className="text-[var(--text-secondary)]" />
              <span>关于 PrivaHub</span>
            </button>

            {/* 版本号 */}
            <div className="px-3 pb-1">
              <p className="text-xs text-[var(--text-tertiary)]">当前版本 v1.0.1</p>
            </div>

            {/* 检查更新 */}
            <div className="border-t border-[var(--border-color)] pt-4 mt-2 px-3 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">检查更新</span>
                <button
                  onClick={checkForUpdate}
                  disabled={checking}
                  className="px-4 py-1.5 text-xs bg-[#6B4C9A] text-white rounded-lg hover:bg-[#5a3f85] disabled:opacity-50 transition-colors"
                >
                  {checking ? '检查中...' : '检查更新'}
                </button>
              </div>
              {updateInfo?.hasUpdate && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">发现新版本 v{updateInfo.version}</p>
                  {updateInfo.notes && (
                    <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{updateInfo.notes}</pre>
                  )}
                  <a
                    href="https://github.com/JasperPujo/PrivaHub/releases/latest"
                    target="_blank"
                    className="text-xs text-[#6B4C9A] underline mt-2 inline-block"
                  >
                    前往下载
                  </a>
                </div>
              )}
              {updateInfo && !updateInfo.hasUpdate && (
                <p className="text-xs text-gray-500 mt-2">当前已是最新版本</p>
              )}
            </div>
          </div>
        </div>

        {/* 退出登录 */}
        <button
          onClick={() => setConfirmLogout(true)}
          className="w-full mt-6 py-3 rounded-button bg-danger/10 text-danger font-medium text-sm hover:bg-danger/20 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={16} />
          退出登录
        </button>
      </div>

      {/* 锁屏密码弹窗 */}
      {showLockPassword && (
        <div className="modal-overlay" onClick={() => setShowLockPassword(false)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">设置锁屏密码</h3>
              <input
                type="password"
                value={lockPassword}
                onChange={e => setLockPassword(e.target.value)}
                placeholder="输入4位以上密码"
                className="input-dark mb-4"
                autoFocus
              />
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => { setShowLockPassword(false); setLockPassword('') }} className="btn-secondary">
                  取消
                </button>
                <button onClick={handleSetLockPassword} className="btn-primary">
                  确认
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 退出确认 */}
      <ConfirmDialog
        isOpen={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => {
          logout()
          setConfirmLogout(false)
        }}
        title="确认退出登录"
        message="退出后需要重新登录才能使用工作台。"
        type="warning"
      />
    </div>
  )
}

export default SettingsPage
