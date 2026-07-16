import React from 'react'
import { X } from '@/utils/icons'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl'
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, size = 'md' }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/50" />
      {/* 模态框主体 */}
      <div
        className={`relative bg-[var(--bg-primary)] rounded-card shadow-xl ${sizeClasses[size]} w-full max-h-[85vh] flex flex-col m-4`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] flex-shrink-0">
          <h3 className="text-lg font-medium text-[var(--text-primary)]">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-button hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {/* 内容区 - 可滚动 */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {children}
        </div>
        {/* 底部按钮区 - 固定 */}
        {footer && (
          <div className="px-6 py-4 border-t border-[var(--border-color)] flex items-center justify-end gap-3 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal
