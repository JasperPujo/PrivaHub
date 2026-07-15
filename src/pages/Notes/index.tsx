import React, { useState, useRef } from 'react'
import { useNoteStore } from '@/store'
import { motion, AnimatePresence } from 'framer-motion'
import Modal from '@/components/Modal/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import {
  Plus, StickyNote, Pin, Trash, Trash2, Edit, Send, ImageIcon, X
} from '@/utils/icons'
import type { NoteWall, Note } from '@/types'

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const canEditNote = (note: Note) => {
  const created = new Date(note.created_at).getTime()
  return Date.now() - created < 2 * 60 * 60 * 1000
}

const NotesPage: React.FC = () => {
  const { walls, notes, addWall, updateWall, deleteWall, reorderWalls, addNote, updateNote, deleteNote, pinNote, reorderNotes, addComment, deleteComment } = useNoteStore()
  // 默认展示第一个主题墙
  const defaultWallId = walls.filter(w => !w.deleted_at).sort((a, b) => a.sort_order - b.sort_order)[0]?.id || null
  const [activeWallId, setActiveWallId] = useState<string | null>(defaultWallId)
  const [showWallModal, setShowWallModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [editingWall, setEditingWall] = useState<NoteWall | null>(null)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [confirmDeleteWall, setConfirmDeleteWall] = useState<string | null>(null)
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [commentNoteId, setCommentNoteId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showAllComments, setShowAllComments] = useState<string | null>(null) // 存 note id
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const [dragWallIdx, setDragWallIdx] = useState<number | null>(null)
  const [dropWallIdx, setDropWallIdx] = useState<number | null>(null)
  const [dragNoteIdx, setDragNoteIdx] = useState<number | null>(null)
  const [dropNoteIdx, setDropNoteIdx] = useState<number | null>(null)

  const [wallForm, setWallForm] = useState({ name: '', description: '' })
  const [noteForm, setNoteForm] = useState({
    content: '',
    color: '#1A1759',
    background: '#F2F7FF',
    images: [] as string[]
  })

  const activeWall = walls.find(w => w.id === activeWallId)
  const wallNotes = notes
    .filter(n => n.wall_id === activeWallId && !n.deleted_at)
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)
      return (a.sort_order || 0) - (b.sort_order || 0)
    })

  const resetWallForm = () => {
    setWallForm({ name: '', description: '' })
    setEditingWall(null)
  }

  const resetNoteForm = () => {
    setNoteForm({ content: '', color: '#1A1759', background: '#F2F7FF', images: [] })
    setEditingNote(null)
  }

  const handleSaveWall = () => {
    if (!wallForm.name.trim()) return
    if (editingWall) {
      updateWall(editingWall.id, { name: wallForm.name, description: wallForm.description })
    } else {
      const newWall: NoteWall = {
        id: 'wall-' + Date.now(),
        user_id: 'current-user',
        name: wallForm.name,
        description: wallForm.description,
        sort_order: walls.filter(w => !w.deleted_at).length,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      addWall(newWall)
      if (!activeWallId) setActiveWallId(newWall.id)
    }
    setShowWallModal(false)
    resetWallForm()
  }

  const handleSaveNote = () => {
    if ((!noteForm.content.trim() && noteForm.images.length === 0) || !activeWallId) return
    if (editingNote) {
      updateNote(editingNote.id, {
        content: { text: noteForm.content },
        color: noteForm.color,
        background: noteForm.background,
        image_ids: noteForm.images
      })
    } else {
      addNote({
        id: 'note-' + Date.now(),
        user_id: 'current-user',
        wall_id: activeWallId,
        content: { text: noteForm.content },
        image_ids: noteForm.images,
        color: noteForm.color,
        background: noteForm.background,
        position: notes.filter(n => n.wall_id === activeWallId).length,
        sort_order: notes.filter(n => n.wall_id === activeWallId).length,
        is_pinned: false,
        comments: [],
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
    setShowNoteModal(false)
    resetNoteForm()
  }

  const handleAddComment = () => {
    if (!commentText.trim() || !commentNoteId) return
    addComment(commentNoteId, {
      id: 'comment-' + Date.now(),
      text: commentText,
      created_at: new Date().toISOString()
    })
    setCommentText('')
    setCommentNoteId(null)
  }

  // 图片上传处理
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return
      if (noteForm.images.length >= 4) return // 最多4张图

      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result as string
        if (result) {
          setNoteForm(prev => ({ ...prev, images: [...prev.images, result] }))
        }
      }
      reader.readAsDataURL(file)
    })

    // 清空 input 以便重复选择同一文件
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (index: number) => {
    setNoteForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
  }

  const colorPresets = [
    { color: '#1A1759', background: '#F2F7FF', name: '紫蓝' },
    { color: '#0F766E', background: '#EAFBF8', name: '青绿' },
    { color: '#92400E', background: '#FEF3C7', name: '暖黄' },
    { color: '#9F1239', background: '#FFE4E6', name: '粉红' },
    { color: '#1E3A5F', background: '#DBEAFE', name: '深蓝' },
    { color: '#3F6212', background: '#ECFCCB', name: '草绿' },
  ]

  return (
    <div className="page-container">
      <div className="max-w-6xl mx-auto h-full flex gap-6">
        {/* 主题墙列表 */}
        <div className="w-56 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">主题墙</h2>
            <button
              onClick={() => { resetWallForm(); setShowWallModal(true) }}
              className="p-1.5 rounded-button hover:bg-[var(--bg-tertiary)] text-primary-600"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="space-y-1">
            {walls
              .filter(w => !w.deleted_at)
              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
              .map((wall, idx) => (
                <div key={wall.id} className="relative">
                  {dropWallIdx === idx && dragWallIdx !== idx && (
                    <div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-primary-600 rounded-full z-10" />
                  )}
                  <button
                    draggable
                    onDragStart={() => setDragWallIdx(idx)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (dragWallIdx !== idx) setDropWallIdx(idx)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (dragWallIdx !== null && dropWallIdx !== null && dragWallIdx !== dropWallIdx) {
                        const sortedWalls = walls
                          .filter(w => !w.deleted_at)
                          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                        const newOrder = sortedWalls.map(w => w.id)
                        const [removed] = newOrder.splice(dragWallIdx, 1)
                        newOrder.splice(dropWallIdx, 0, removed)
                        reorderWalls(newOrder)
                      }
                      setDragWallIdx(null)
                      setDropWallIdx(null)
                    }}
                    onDragEnd={() => {
                      setDragWallIdx(null)
                      setDropWallIdx(null)
                    }}
                    onClick={() => setActiveWallId(wall.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-button text-sm transition-all ${
                      activeWallId === wall.id
                        ? 'bg-primary-600 text-white'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    } ${dragWallIdx === idx ? 'opacity-40' : ''}`}
                  >
                    <span className="truncate">{wall.name}</span>
                    <span className="text-xs opacity-60">
                      {notes.filter(n => n.wall_id === wall.id && !n.deleted_at).length}
                    </span>
                  </button>
                </div>
              ))}
          </div>
        </div>

        {/* 贴纸区域 */}
        <div className="flex-1 min-w-0">
          {activeWall ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="page-title mb-0">{activeWall.name}</h1>
                  {activeWall.description && (
                    <p className="text-sm text-[var(--text-secondary)]">{activeWall.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { resetWallForm(); setEditingWall(activeWall); setWallForm({ name: activeWall.name, description: activeWall.description }); setShowWallModal(true) }}
                    className="btn-secondary text-sm"
                  >
                    编辑墙信息
                  </button>
                  <button
                    onClick={() => { resetNoteForm(); setShowNoteModal(true) }}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Plus size={16} />
                    新建贴纸
                  </button>
                </div>
              </div>

              {/* 贴纸网格 */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <AnimatePresence>
                  {wallNotes.map((note, idx) => (
                    <motion.div
                      key={note.id}
                      draggable
                      onDragStart={() => setDragNoteIdx(idx)}
                      onDragOver={(e) => {
                        e.preventDefault()
                        if (dragNoteIdx !== idx) setDropNoteIdx(idx)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (dragNoteIdx !== null && dropNoteIdx !== null && dragNoteIdx !== dropNoteIdx && activeWallId) {
                          const newOrder = wallNotes.map(n => n.id)
                          const [removed] = newOrder.splice(dragNoteIdx, 1)
                          newOrder.splice(dropNoteIdx, 0, removed)
                          reorderNotes(activeWallId, newOrder)
                        }
                        setDragNoteIdx(null)
                        setDropNoteIdx(null)
                      }}
                      onDragEnd={() => {
                        setDragNoteIdx(null)
                        setDropNoteIdx(null)
                      }}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: dragNoteIdx === idx ? 0.4 : 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={`rounded-card p-4 relative group max-w-md w-full ${note.image_ids.length > 0 ? 'md:col-span-2 lg:col-span-2' : ''} ${dropNoteIdx === idx && dragNoteIdx !== idx ? 'ring-2 ring-primary-600 ring-offset-2' : ''}`}
                      style={{ backgroundColor: note.background, color: note.color }}
                    >
                      {note.is_pinned && (
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                          <Pin size={16} className="text-primary-600" />
                        </div>
                      )}

                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button
                          onClick={() => pinNote(note.id)}
                          className="p-1 rounded bg-white/50 hover:bg-white/80"
                        >
                          <Pin size={12} />
                        </button>
                        {canEditNote(note) && (
                        <button
                          onClick={() => {
                            setEditingNote(note)
                            setNoteForm({
                              content: note.content.text,
                              color: note.color,
                              background: note.background,
                              images: [...note.image_ids]
                            })
                            setShowNoteModal(true)
                          }}
                          className="p-1 rounded bg-white/50 hover:bg-white/80"
                        >
                          <Edit size={12} />
                        </button>
                      )}
                        <button
                          onClick={() => setCommentNoteId(note.id)}
                          className="p-1 rounded bg-white/50 hover:bg-white/80"
                        >
                          <Send size={12} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteNote(note.id)}
                          className="p-1 rounded bg-white/50 hover:bg-white/80 text-danger"
                        >
                          <Trash size={12} />
                        </button>
                      </div>

                      {note.content.text ? (
                        <p className="text-sm whitespace-pre-wrap pt-4">{note.content.text}</p>
                      ) : (
                        <div className="pt-4" />
                      )}
                      <p className="text-[10px] opacity-40 mt-1">{formatTime(note.created_at)}</p>

                      {/* 图片展示 */}
                      {note.image_ids.length > 0 && (
                        <div className={`mt-3 grid gap-1 ${note.image_ids.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                          {note.image_ids.map((img, idx) => (
                            <div key={idx} className="relative rounded overflow-hidden cursor-pointer" onClick={() => setPreviewImage(img)}>
                              <img
                                src={img}
                                alt={`图片${idx + 1}`}
                                className="w-full object-cover rounded"
                                style={{ maxHeight: '180px' }}
                                loading="lazy"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {note.comments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-current/10 space-y-1.5">
                          {[...note.comments]
                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            .slice(0, 3)
                            .map(c => (
                              <div key={c.id} className="text-xs opacity-70 flex items-start justify-between gap-2 group/comment">
                                <span className="flex-1 break-all max-w-[160px]">{c.text}</span>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-[10px] opacity-50 whitespace-nowrap">{formatTime(c.created_at)}</span>
                                  <button
                                    onClick={() => deleteComment(note.id, c.id)}
                                    className="opacity-0 group-hover/comment:opacity-100 transition-opacity p-0.5 hover:bg-white/50 rounded"
                                  >
                                    <Trash size={10} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          {note.comments.length > 3 && (
                            <button
                              onClick={() => setShowAllComments(note.id)}
                              className="text-xs text-primary-600 hover:underline mt-1"
                            >
                              查看更多留言（共{note.comments.length}条）
                            </button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {wallNotes.length === 0 && (
                <div className="empty-state">
                  <StickyNote size={48} className="text-[var(--text-tertiary)] mb-3" />
                  <p className="text-[var(--text-secondary)]">墙上还没有贴纸</p>
                  <button onClick={() => { resetNoteForm(); setShowNoteModal(true) }} className="btn-primary mt-4">
                    创建第一张
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state h-full">
              <StickyNote size={48} className="text-[var(--text-tertiary)] mb-3" />
              <p className="text-[var(--text-secondary)]">选择一个主题墙开始</p>
            </div>
          )}
        </div>
      </div>

      {/* 墙弹窗 */}
      <Modal
        isOpen={showWallModal}
        onClose={() => { setShowWallModal(false); resetWallForm() }}
        title={editingWall ? '编辑主题墙' : '新建主题墙'}
        footer={
          <>
            <button onClick={() => { setShowWallModal(false); resetWallForm() }} className="btn-secondary">取消</button>
            <button onClick={handleSaveWall} className="btn-primary">{editingWall ? '保存' : '创建'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">名称</label>
            <input type="text" value={wallForm.name} onChange={e => setWallForm(prev => ({ ...prev, name: e.target.value }))} placeholder="主题墙名称" className="input-dark" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">描述</label>
            <textarea value={wallForm.description} onChange={e => setWallForm(prev => ({ ...prev, description: e.target.value }))} placeholder="描述（可选）" rows={2} className="input-dark resize-none" />
          </div>
        </div>
      </Modal>

      {/* 贴纸弹窗 - 支持图片上传 */}
      <Modal
        isOpen={showNoteModal}
        onClose={() => { setShowNoteModal(false); resetNoteForm() }}
        title={editingNote ? '编辑贴纸' : '新建贴纸'}
        footer={
          <>
            <button onClick={() => { setShowNoteModal(false); resetNoteForm() }} className="btn-secondary">取消</button>
            <button onClick={handleSaveNote} className="btn-primary">{editingNote ? '保存' : '创建'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">内容</label>
            <textarea
              value={noteForm.content}
              onChange={e => setNoteForm(prev => ({ ...prev, content: e.target.value }))}
              placeholder="写下你的想法..."
              rows={4}
              className="input-dark resize-none"
            />
          </div>

          {/* 图片上传 */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              图片（最多4张）
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
            <div className="flex flex-wrap gap-2">
              {/* 已上传图片预览 */}
              {noteForm.images.map((img, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--border-color)]">
                  <img src={img} alt={`预览${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-0.5 right-0.5 p-0.5 bg-black/50 rounded-full text-white hover:bg-black/70"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              {/* 添加图片按钮 */}
              {noteForm.images.length < 4 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-[var(--border-color)] flex flex-col items-center justify-center gap-1 text-[var(--text-tertiary)] hover:border-primary-600 hover:text-primary-600 transition-colors"
                >
                  <ImageIcon size={20} />
                  <span className="text-[10px]">添加图片</span>
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">颜色主题</label>
            <div className="flex gap-2 flex-wrap">
              {colorPresets.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => setNoteForm(prev => ({ ...prev, color: preset.color, background: preset.background }))}
                  className={`w-10 h-10 rounded-button border-2 transition-all ${
                    noteForm.background === preset.background ? 'border-primary-600 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: preset.background }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* 留言弹窗 */}
      <Modal
        isOpen={!!commentNoteId}
        onClose={() => { setCommentNoteId(null); setCommentText('') }}
        title="添加留言"
        footer={
          <>
            <button onClick={() => { setCommentNoteId(null); setCommentText('') }} className="btn-secondary">取消</button>
            <button onClick={handleAddComment} className="btn-primary">发送</button>
          </>
        }
      >
        <div>
          <textarea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder="写下你的留言..."
            rows={3}
            className="input-dark resize-none"
          />
        </div>
      </Modal>

      {confirmDeleteWall && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setConfirmDeleteWall(null)}
          onConfirm={() => {
            const wall = walls.find(w => w.id === confirmDeleteWall)
            if (wall) {
              deleteWall(wall.id)
              if (activeWallId === wall.id) setActiveWallId(null)
            }
            setConfirmDeleteWall(null)
          }}
          title="确认删除主题墙"
          message="删除后墙及所有贴纸将进入回收站。"
          type="danger"
        />
      )}

      {confirmDeleteNote && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setConfirmDeleteNote(null)}
          onConfirm={() => {
            const note = notes.find(n => n.id === confirmDeleteNote)
            if (note) deleteNote(note.id)
            setConfirmDeleteNote(null)
          }}
          title="确认删除贴纸"
          message="删除后贴纸将进入回收站。"
          type="danger"
        />
      )}

      {/* 留言详情 Modal - 微博风格 */}
      {showAllComments && (() => {
        const note = notes.find(n => n.id === showAllComments)
        if (!note) return null
        const sortedComments = [...note.comments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        return (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50" onClick={() => setShowAllComments(null)}>
            <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-lg max-h-[80vh] mx-4 flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
              {/* 头部 */}
              <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">留言详情</h3>
                <button onClick={() => setShowAllComments(null)} className="p-1.5 rounded-button hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                  <X size={18} />
                </button>
              </div>

              {/* 正文区域 */}
              <div className="p-5 border-b border-[var(--border-color)]">
                {note.content.text ? (
                  <p className="text-base text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{note.content.text}</p>
                ) : null}
                {note.image_ids && note.image_ids.length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {note.image_ids.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        className="w-20 h-20 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewImage(img)}
                      />
                    ))}
                  </div>
                )}
                <p className="text-xs text-[var(--text-tertiary)] mt-3">{formatTime(note.created_at)}</p>
              </div>

              {/* 留言列表 */}
              <div className="flex-1 overflow-y-auto p-5">
                <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">全部留言 ({note.comments.length})</h4>
                <div className="space-y-3">
                  {sortedComments.map(comment => (
                    <div key={comment.id} className="flex gap-3 group/comment">
                      <div className="w-8 h-8 rounded-full bg-[#6B4C9A] flex items-center justify-center text-white text-xs shrink-0 select-none">
                        匿
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-[var(--text-primary)]">匿名</span>
                          <span className="text-xs text-[var(--text-tertiary)]">{formatTime(comment.created_at)}</span>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] mt-1 break-all">{comment.text}</p>
                      </div>
                      <button
                        onClick={() => deleteComment(note.id, comment.id)}
                        className="text-[var(--text-tertiary)] hover:text-danger opacity-0 group-hover/comment:opacity-100 transition-opacity p-1 shrink-0"
                        title="删除留言"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {sortedComments.length === 0 && (
                    <p className="text-sm text-[var(--text-tertiary)] text-center py-8">暂无留言</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 图片预览 Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setPreviewImage(null)}>
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
          >
            <X size={24} />
          </button>
          <img
            src={previewImage}
            alt="图片预览"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

export default NotesPage
