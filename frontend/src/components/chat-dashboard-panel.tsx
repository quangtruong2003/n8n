'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { Header } from '@/components/header'

interface ChatSession {
  id: string
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  channel: 'zalo' | 'web'
  status: 'active' | 'bot_handling' | 'staff_handling' | 'resolved'
  assigned_staff_id: string | null
  last_message_at: string | null
  last_message_preview?: string
  metadata: {
    customer_phone?: string
    zalo_thread_id?: string
  }
}

interface ChatMessage {
  id: string
  sender: 'customer' | 'bot' | 'staff'
  sender_name?: string
  content: string
  channel: 'zalo' | 'web'
  created_at: string
}

export function ChatDashboardPanel() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [statusFilter, setStatusFilter] = useState('active') // Default to active (takeover requests)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)

  // Polling ref to clear interval
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const fetchSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      const res = await api.get(`/api/chat/sessions?${params}`)
      setSessions(res.data || [])
    } catch {
      // Silent fail on background polling
    } finally {
      setLoadingSessions(false)
    }
  }, [statusFilter])

  // Poll sessions and current message thread
  useEffect(() => {
    fetchSessions()
    const interval = setInterval(() => {
      fetchSessions()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchSessions])

  const loadMessages = useCallback(async (sessionId: string) => {
    setLoadingMessages(true)
    try {
      const res = await api.get(`/api/chat/sessions/${sessionId}/messages`)
      setMessages(res.data || [])
    } catch {
      toast.error('Lỗi tải tin nhắn')
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  // Poll current session messages
  useEffect(() => {
    if (!selectedSession) {
      setMessages([])
      if (pollingRef.current) clearInterval(pollingRef.current)
      return
    }

    loadMessages(selectedSession.id)
    pollingRef.current = setInterval(() => {
      loadMessages(selectedSession.id)
    }, 3000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [selectedSession, loadMessages])

  // Scroll to bottom when messages list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendReply = async () => {
    if (!selectedSession || !replyText.trim()) return
    setSendingReply(true)
    try {
      const res = await api.post(`/api/chat/sessions/${selectedSession.id}/reply`, {
        content: replyText
      })
      if (res.success) {
        setReplyText('')
        // Add to active message list immediately
        setMessages([...messages, res.data])
        // Refresh session list to update status
        fetchSessions()
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi gửi tin nhắn')
    } finally {
      setSendingReply(false)
    }
  }

  const handleAssign = async () => {
    if (!selectedSession) return
    try {
      const res = await api.patch(`/api/chat/sessions/${selectedSession.id}/assign`, {
        action: 'assign'
      })
      if (res.success) {
        toast.success('Đã nhận hỗ trợ hội thoại này')
        setSelectedSession({
          ...selectedSession,
          status: 'staff_handling'
        })
        fetchSessions()
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi nhận hỗ trợ')
    }
  }

  const handleResolve = async () => {
    if (!selectedSession) return
    try {
      const res = await api.patch(`/api/chat/sessions/${selectedSession.id}/assign`, {
        action: 'resolve'
      })
      if (res.success) {
        toast.success('Đã hoàn thành hội thoại. Trả lại cho AI Bot.')
        setSelectedSession(null)
        fetchSessions()
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi kết thúc hội thoại')
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Cần người hỗ trợ 🔴'
      case 'staff_handling': return 'Nhân viên đang hỗ trợ 🟢'
      case 'bot_handling': return 'AI Bot đang xử lý 🤖'
      case 'resolved': return 'Đã đóng'
      default: return status
    }
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col space-y-4">
      <Header title="Chat Dashboard" />

      {/* TABS & FILTER BAR */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 shrink-0">
        {[
          { key: 'active', label: 'Cần hỗ trợ ( टेकओवर )' },
          { key: 'staff_handling', label: 'Nhân viên xử lý' },
          { key: 'bot_handling', label: 'Bot xử lý' },
          { key: 'resolved', label: 'Đã hoàn thành' },
          { key: 'all', label: 'Tất cả' }
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setStatusFilter(t.key)
              setLoadingSessions(true)
            }}
            className={`px-4 py-2 text-xs sm:text-sm rounded-lg whitespace-nowrap transition-all active:scale-95 ${
              statusFilter === t.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* THREE COLUMN CHAT LAYOUT */}
      <div className="flex-1 min-h-0 flex border rounded-xl overflow-hidden bg-card shadow-sm">

        {/* COL 1: SESSIONS LIST */}
        <div className="w-80 border-r flex flex-col min-h-0 shrink-0">
          <div className="p-3 border-b bg-muted/20 shrink-0">
            <h3 className="font-semibold text-sm">Hội thoại ({sessions.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {loadingSessions ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Đang tải...</div>
            ) : sessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Không có hội thoại nào</div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedSession(s)}
                  className={`p-3.5 flex flex-col gap-1.5 cursor-pointer hover:bg-accent/40 transition-all duration-150 ${
                    selectedSession?.id === s.id ? 'bg-primary/10 text-primary font-medium' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate">
                      {s.customer_name || 'Khách ẩn danh'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium ${
                      s.channel === 'zalo' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {s.channel === 'zalo' ? 'Zalo' : 'Web'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.last_message_preview || 'Không có tin nhắn'}
                  </p>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-1">
                    <span>{s.last_message_at ? formatDateTime(s.last_message_at) : ''}</span>
                    <span className={s.status === 'active' ? 'text-red-500 font-bold' : ''}>
                      {s.status === 'active' ? 'Cần giúp' : 'Đang xử lý'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COL 2: ACTIVE MESSAGES THREAD */}
        <div className="flex-1 flex flex-col min-h-0 bg-muted/5">
          {selectedSession ? (
            <>
              {/* Header takeover actions */}
              <div className="px-4 py-3 border-b flex justify-between items-center bg-card shrink-0">
                <div>
                  <h4 className="font-semibold text-sm">{selectedSession.customer_name || 'Khách hàng'}</h4>
                  <p className="text-xs text-muted-foreground">
                    Trạng thái: {getStatusLabel(selectedSession.status)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {selectedSession.status === 'active' && (
                    <button
                      onClick={handleAssign}
                      className="px-3 py-1.5 bg-primary text-primary-foreground hover:opacity-90 rounded-lg text-xs font-semibold"
                    >
                      Nhận Takeover
                    </button>
                  )}
                  {(selectedSession.status === 'staff_handling' || selectedSession.status === 'active') && (
                    <button
                      onClick={handleResolve}
                      className="px-3 py-1.5 border border-input hover:bg-accent rounded-lg text-xs font-semibold"
                    >
                      Hoàn thành / Chuyển Bot
                    </button>
                  )}
                </div>
              </div>

              {/* Message log list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {loadingMessages ? (
                  <div className="text-xs text-center text-muted-foreground py-4">Đang tải tin nhắn...</div>
                ) : messages.length === 0 ? (
                  <div className="text-xs text-center text-muted-foreground py-4">Chưa có tin nhắn</div>
                ) : (
                  messages.map((m) => {
                    const isStaff = m.sender === 'staff'
                    const isBot = m.sender === 'bot'
                    return (
                      <div
                        key={m.id}
                        className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] px-3.5 py-2 rounded-xl text-sm shadow-sm ${
                          isStaff ? 'bg-primary text-primary-foreground' :
                          isBot ? 'bg-muted/80 text-foreground border' : 'bg-card text-foreground border'
                        }`}>
                          <p className="break-words">{m.content}</p>
                          <p className="text-[9px] mt-1 opacity-70 text-right">
                            {isStaff ? 'Bạn' : isBot ? 'Virtual AI' : m.sender_name || 'Khách'} · {formatDateTime(m.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Input Box */}
              <div className="p-3 border-t bg-card flex gap-2 items-center shrink-0">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                  placeholder={
                    selectedSession.status === 'bot_handling'
                      ? "Bấm 'Nhận Takeover' để chat trực tiếp..."
                      : "Nhập tin nhắn phản hồi..."
                  }
                  disabled={selectedSession.status === 'bot_handling' || sendingReply}
                  className="flex-1 h-10 px-3.5 rounded-lg border border-input bg-background text-sm"
                />
                <button
                  onClick={handleSendReply}
                  disabled={selectedSession.status === 'bot_handling' || sendingReply || !replyText.trim()}
                  className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
                >
                  {sendingReply ? '...' : 'Gửi'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground p-8">
              Chọn một cuộc trò chuyện để bắt đầu tương tác
            </div>
          )}
        </div>

        {/* COL 3: CUSTOMER PROFILE CONTEXT PANEL */}
        {selectedSession && (
          <div className="w-72 border-l p-4 flex flex-col gap-5 overflow-y-auto shrink-0 bg-muted/10">
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Hồ sơ khách hàng</h4>
              <div className="space-y-1.5">
                <p className="font-semibold text-sm">{selectedSession.customer_name || 'Chưa cung cấp tên'}</p>
                {selectedSession.customer_phone && (
                  <p className="text-xs text-muted-foreground">SĐT: {selectedSession.customer_phone}</p>
                )}
                <p className="text-[11px] px-2 py-0.5 bg-accent text-accent-foreground rounded-md w-max">
                  Khách vãng lai
                </p>
              </div>
            </div>

            {/* Handoff notifications */}
            {selectedSession.channel === 'web' && selectedSession.metadata?.customer_phone && (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/40 p-3 rounded-lg space-y-2">
                <p className="text-xs text-yellow-800 dark:text-yellow-400 font-medium">
                  ⚠️ Handoff để lại SĐT:
                </p>
                <p className="text-sm font-bold">{selectedSession.metadata.customer_phone}</p>
                <p className="text-[10px] text-muted-foreground">
                  Gợi ý: Tìm Zalo theo số điện thoại này hoặc gửi liên kết Zalo tiếp tục đặt lịch hẹn.
                </p>
              </div>
            )}

            {selectedSession.metadata?.zalo_thread_id && (
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-1.5">Liên kết Zalo</h4>
                <p className="text-xs truncate font-mono bg-muted p-1.5 rounded text-muted-foreground">
                  ZID: {selectedSession.metadata.zalo_thread_id}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
