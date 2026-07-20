import React, { useState } from 'react'
import { useAppStore } from '@/store'
import { motion } from 'framer-motion'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  Moon, Lock, Unlock, Bell, Volume2, VolumeX,
  ChevronRight, LogOut, User, Clock, Info, Edit
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
    addNotification,
    setUser
  } = useAppStore()

  const [showLockPassword, setShowLockPassword] = useState(false)
  const [lockPassword, setLockPassword] = useState('')
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [showEditName, setShowEditName] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

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

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) return
    if (!user) return
    try {
      // 更新 supabase users 表
      const { error } = await supabase
        .from('users')
        .update({ username: newUsername.trim() })
        .eq('id', user.id)
      if (error) throw error
      // 更新本地 store
      setUser({ ...user, username: newUsername.trim() })
      addNotification({ message: '昵称修改成功', type: 'success' })
      setShowEditName(false)
    } catch {
      addNotification({ message: '昵称修改失败，请重试', type: 'error' })
    }
  }

  const handleChangePassword = async () => {
    setPasswordError('')
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('请填写所有密码字段')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('新密码至少需要6个字符')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致')
      return
    }
    try {
      // 先用旧密码验证用户身份
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: oldPassword,
      })
      if (signInError) {
        setPasswordError('旧密码不正确')
        return
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      addNotification({ message: '密码修改成功', type: 'success' })
      setShowChangePassword(false)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setPasswordError('密码修改失败，请重试')
    }
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
            {user?.avatar ? (
              <img src={user.avatar} alt="头像" className="w-14 h-14 rounded-card object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-card bg-primary-600/10 flex items-center justify-center">
                <User size={24} className="text-primary-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-medium text-[var(--text-primary)]">{user?.username || '用户'}</h2>
              <p className="text-sm text-[var(--text-secondary)]">{user?.email || ''}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => { setNewUsername(user?.username || ''); setShowEditName(true) }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm rounded-button border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <Edit size={14} />
              修改昵称
            </button>
            <button
              onClick={() => { setOldPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordError(''); setShowChangePassword(true) }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm rounded-button border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <Lock size={14} />
              修改密码
            </button>
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
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Info size={18} className="text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-primary)]">关于 PrivaHub</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-tertiary)]">v1.2.0</span>
                <ChevronRight size={16} className="text-[var(--text-tertiary)]" />
              </div>
            </button>
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

      {/* 修改昵称弹窗 */}
      {showEditName && (
        <div className="modal-overlay" onClick={() => setShowEditName(false)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">修改昵称</h3>
              <input
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="输入新昵称"
                className="input-dark mb-4"
                autoFocus
              />
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setShowEditName(false)} className="btn-secondary">
                  取消
                </button>
                <button onClick={handleSaveUsername} className="btn-primary">
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 修改密码弹窗 */}
      {showChangePassword && (
        <div className="modal-overlay" onClick={() => setShowChangePassword(false)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-medium text-[var(--text-primary)]">修改密码</h3>
              <div>
                <label className="block text-sm font-medium mb-1.5">旧密码</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  placeholder="输入当前密码"
                  className="input-dark"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">新密码</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="输入新密码（至少6位）"
                  className="input-dark"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">确认新密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="再次输入新密码"
                  className="input-dark"
                />
              </div>
              {passwordError && (
                <p className="text-xs text-danger">{passwordError}</p>
              )}
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setShowChangePassword(false)} className="btn-secondary">
                  取消
                </button>
                <button onClick={handleChangePassword} className="btn-primary">
                  确认修改
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
