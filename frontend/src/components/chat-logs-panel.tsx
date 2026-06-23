'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { Header } from '@/components/header'
import { Pagination } from '@/components/pagination'

export function ChatLogsPanel({ spaId }: { spaId: string }) {
  const [logs, setLogs] = useState<unknown[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('')
  const [senderFilter, setSenderFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [sessionLogs, setSessionLogs] = useState<unknown[]>([])

  const fetchLogs = useCallback(async (page: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (dateFilter) params.set('date', dateFilter)
      if (senderFilter) params.set('sender', senderFilter)
      if (branchFilter) params.set('branchId', branchFilter)
      const res = await api.get(`/api/spa/${spaId}/chat-logs?${params}`)
      setLogs(res.logs)
      setPagination(res.pagination)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [spaId, dateFilter, senderFilter, branchFilter])

  useEffect(() => { fetchLogs(1) }, [fetchLogs])

  useEffect(() => {
    api.get(`/api/spa/${spaId}/branches`).then((res) => setBranches(res.branchs || res.branches || [])).catch(() => {})
  }, [spaId])

  const handleExpandSession = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null)
      return
    }
    setExpandedSession(sessionId)
    try {
      const res = await api.get(`/api/spa/${spaId}/chat-logs/${sessionId}`)
      setSessionLogs(res.logs)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải chi tiết')
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <Header title="Chat Logs" />

      <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="h-10 px-3 rounded-lg border border-input bg-background text-sm col-span-2 sm:col-span-1" />
        <select value={senderFilter} onChange={(e) => setSenderFilter(e.target.value)} className="h-10 px-3 rounded-lg border border-input bg-background text-sm">
          <option value="">Tất cả loại</option>
          <option value="user">Khách gửi</option>
          <option value="bot">Bot phản hồi</option>
        </select>
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="h-10 px-3 rounded-lg border border-input bg-background text-sm col-span-2 sm:col-span-1">
          <option value="">Tất cả chi nhánh</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button onClick={() => fetchLogs(1)} className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 active:scale-[0.97] transition-all">Lọc</button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Đang tải...</div>
      ) : logs.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">Không có dữ liệu</div>
      ) : (
        <>
          <div className="sm:hidden space-y-2">
            {logs.map((l: unknown) => {
              const log = l as { id: string; customerName: string; customerPhone: string; branchName: string; sender: string; content: string; sessionId: string | null; createdAt: string }
              return (
                <div key={log.id} className="bg-card border rounded-xl p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{log.customerName}</p>
                      <p className="text-xs text-muted-foreground">{log.customerPhone}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${log.sender === 'user' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                      {log.sender === 'user' ? 'Khách' : 'Bot'}
                    </span>
                  </div>
                  <p className="text-sm break-words line-clamp-2">{log.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                    {log.sessionId && (
                      <button onClick={() => handleExpandSession(log.sessionId!)} className="text-xs text-primary hover:underline active:opacity-70 transition-opacity">
                        {expandedSession === log.sessionId ? 'Ẩn' : 'Xem hội thoại'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="hidden sm:block bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Khách</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Loại</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nội dung</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Chi nhánh</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Thời gian</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l: unknown) => {
                    const log = l as { id: string; customerName: string; customerPhone: string; branchName: string; sender: string; content: string; sessionId: string | null; createdAt: string }
                    return (
                      <tr key={log.id} className="border-b last:border-0 hover:bg-accent/50">
                        <td className="px-4 py-3"><div className="font-medium">{log.customerName}</div><div className="text-xs text-muted-foreground">{log.customerPhone}</div></td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${log.sender === 'user' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>{log.sender === 'user' ? 'Khách' : 'Bot'}</span></td>
                        <td className="px-4 py-3 max-w-xs truncate">{log.content}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">{log.branchName}</td>
                        <td className="px-4 py-3 hidden md:table-cell">{formatDateTime(log.createdAt)}</td>
                        <td className="px-4 py-3 text-right">{log.sessionId && <button onClick={() => handleExpandSession(log.sessionId!)} className="text-xs text-primary hover:underline">{expandedSession === log.sessionId ? 'Ẩn' : 'Xem'}</button>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {pagination.totalPages > 1 && <Pagination pagination={pagination} onPrev={() => fetchLogs(pagination.page - 1)} onNext={() => fetchLogs(pagination.page + 1)} />}
          </div>

          {expandedSession && (
            <div className="bg-card border rounded-xl p-4 sm:p-5 ring-2 ring-primary/20">
              <h4 className="font-semibold mb-3 text-sm">Hội thoại chi tiết</h4>
              <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                {sessionLogs.map((l: unknown) => {
                  const log = l as { id: string; sender: string; content: string; customerName: string; createdAt: string }
                  return (
                    <div key={log.id} className={`flex ${log.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[85%] sm:max-w-[70%] px-3 py-2 rounded-lg text-sm ${
                        log.sender === 'user' ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'
                      }`}>
                        <p className="break-words">{log.content}</p>
                        <p className="text-[10px] mt-1 opacity-70">{log.sender === 'user' ? log.customerName : 'Bot'} · {formatDateTime(log.createdAt)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
