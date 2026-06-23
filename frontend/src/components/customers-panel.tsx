'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatPrice, formatDate, formatDateTime, statusMap } from '@/lib/format'
import { Header } from '@/components/header'
import { Pagination } from '@/components/pagination'

export function CustomersPanel({ spaId }: { spaId: string }) {
  const [branchFilter, setBranchFilter] = useState('')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [customers, setCustomers] = useState<unknown[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string; phone: string } | null>(null)
  const [customerDetail, setCustomerDetail] = useState<{ chatLogs: unknown[]; bookings: unknown[] } | null>(null)

  useEffect(() => {
    api.get(`/api/spa/${spaId}/branches`).then((res) => {
      setBranches(res.branches || [])
    }).catch(() => {})
  }, [spaId])

  const fetchCustomers = useCallback(async (page: number, s: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), search: s })
      if (branchFilter) params.set('branchId', branchFilter)
      const res = await api.get(`/api/spa/${spaId}/customers?${params}`)
      setCustomers(res.customers)
      setPagination(res.pagination)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [spaId, branchFilter])

  useEffect(() => {
    const t = setTimeout(() => fetchCustomers(1, search), 300)
    return () => clearTimeout(t)
  }, [fetchCustomers, search])

  const handleSelectCustomer = async (c: { id: string; name: string; phone: string }) => {
    setSelectedCustomer(c)
    try {
      const res = await api.get(`/api/spa/${spaId}/customers/${c.id}`)
      setCustomerDetail(res)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải chi tiết')
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <Header title="Khách hàng" />

      <input
        type="text"
        placeholder="Tìm theo tên hoặc SĐT..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full h-10 px-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
      />

      {branches.length > 1 && (
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="w-full h-10 px-4 rounded-lg border border-input bg-background text-sm"
        >
          <option value="">Tất cả chi nhánh</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      )}

      {selectedCustomer ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedCustomer(null); setCustomerDetail(null) }} className="p-2 -ml-2 hover:bg-accent rounded-lg active:bg-accent/80 transition-colors" aria-label="Quay lại">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            </button>
            <div>
              <h2 className="font-bold text-lg">{selectedCustomer.name}</h2>
              <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
            </div>
          </div>

          {customerDetail ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-card border rounded-xl p-4 sm:p-5">
                <h3 className="font-semibold mb-3 text-sm">Lịch sử chat</h3>
                <div className="max-h-80 sm:max-h-96 overflow-y-auto space-y-2.5 pr-1">
                  {customerDetail.chatLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có tin nhắn</p>
                  ) : (
                    customerDetail.chatLogs.map((log: unknown) => {
                      const l = log as { id: string; sender: string; content: string; createdAt: string }
                      return (
                        <div key={l.id} className={`flex ${l.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[85%] sm:max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                            l.sender === 'user' ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'
                          }`}>
                            <p className="break-words">{l.content}</p>
                            <p className="text-[10px] mt-1 opacity-70">{formatDateTime(l.createdAt)}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
              <div className="bg-card border rounded-xl p-4 sm:p-5">
                <h3 className="font-semibold mb-3 text-sm">Lịch sử đặt lịch</h3>
                <div className="max-h-80 sm:max-h-96 overflow-y-auto space-y-2.5 pr-1">
                  {customerDetail.bookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có đặt lịch</p>
                  ) : (
                    customerDetail.bookings.map((b: unknown) => {
                      const bk = b as { id: string; serviceName: string; servicePrice: number; branchName: string; status: string; bookingTime: string | null; note: string | null; createdAt: string }
                      const st = statusMap[bk.status] || { label: bk.status, color: 'bg-gray-100 text-gray-800' }
                      return (
                        <div key={bk.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-medium text-sm truncate">{bk.serviceName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${st.color}`}>{st.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{formatPrice(bk.servicePrice)} · {bk.branchName}</p>
                          {bk.bookingTime && <p className="text-xs text-muted-foreground mt-0.5">Giờ: {formatDateTime(bk.bookingTime)}</p>}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="p-8 text-center text-muted-foreground">Đang tải...</div>
      ) : (
        <>
          <div className="sm:hidden space-y-2">
            {customers.map((c: unknown) => {
              const cust = c as { id: string; name: string; phone: string; bookingCount: number; chatCount: number; createdAt: string }
              return (
                <button key={cust.id} onClick={() => handleSelectCustomer(cust)} className="w-full text-left bg-card border rounded-xl p-3.5 hover:bg-accent/50 active:bg-accent/80 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{cust.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{cust.phone}</p>
                    </div>
                    <svg className="w-4 h-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{cust.bookingCount} đặt lịch</span>
                    <span>{cust.chatCount} tin nhắn</span>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="hidden sm:block bg-card border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tên</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">SĐT</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Đặt lịch</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Tin nhắn</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Ngày tạo</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c: unknown) => {
                    const cust = c as { id: string; name: string; phone: string; bookingCount: number; chatCount: number; createdAt: string }
                    return (
                      <tr key={cust.id} className="border-b last:border-0 hover:bg-accent/50 cursor-pointer active:bg-accent/80" onClick={() => handleSelectCustomer(cust)}>
                        <td className="px-4 py-3 font-medium">{cust.name}</td>
                        <td className="px-4 py-3">{cust.phone}</td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">{cust.bookingCount}</td>
                        <td className="px-4 py-3 text-center hidden lg:table-cell">{cust.chatCount}</td>
                        <td className="px-4 py-3 hidden xl:table-cell">{formatDate(cust.createdAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {pagination.totalPages > 1 && <Pagination pagination={pagination} onPrev={() => fetchCustomers(pagination.page - 1, search)} onNext={() => fetchCustomers(pagination.page + 1, search)} />}
          </div>
        </>
      )}
    </div>
  )
}
