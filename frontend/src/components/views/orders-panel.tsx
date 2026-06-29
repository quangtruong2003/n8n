'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatCurrency } from '@/lib/format'
import { Header } from '@/components/header'
import { Pagination } from '@/components/pagination'

interface Order {
  id: string
  order_code: string
  customer_name: string | null
  customer_phone: string | null
  status: 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled' | 'refunded'
  payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded'
  total: number
  created_at: string
  branch_name: string
}

interface Product {
  id: string
  name: string
  price: number
  type: 'service' | 'product' | 'combo'
  stock_quantity: number
}

interface OrderItem {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  total: number
}

interface Payment {
  id: string
  amount: number
  method: string
  paid_at: string
  reference: string | null
  note: string | null
}

export function OrdersPanel() {
  const [orders, setOrders] = useState<Order[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [branchFilter, setBranchFilter] = useState('')

  // Detail view state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Add Payment Form
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [submittingPayment, setSubmittingPayment] = useState(false)

  // Create Order Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [customers, setCustomers] = useState<{ id: string; full_name: string; phone: string | null }[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([])
  const [submittingOrder, setSubmittingOrder] = useState(false)

  const fetchOrders = useCallback(async (page: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (statusFilter) params.set('status', statusFilter)
      if (paymentFilter) params.set('payment_status', paymentFilter)
      if (branchFilter) params.set('branch_id', branchFilter)

      const res = await api.get(`/api/orders?${params}`)
      setOrders(res.data || [])
      if (res.meta) {
        setPagination(res.meta)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải đơn hàng')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, paymentFilter, branchFilter])

  useEffect(() => {
    fetchOrders(1)
  }, [fetchOrders])

  useEffect(() => {
    api.get('/api/branches')
      .then((res) => {
        setBranches(res.data || [])
        if (res.data && res.data.length > 0) {
          setSelectedBranchId(res.data[0].id)
        }
      })
      .catch(() => {})
  }, [])

  const loadOrderDetail = async (order: Order) => {
    setSelectedOrder(order)
    setLoadingDetail(true)
    try {
      const res = await api.get(`/api/orders/${order.id}`)
      if (res.success && res.data) {
        setOrderItems(res.data.items || [])
        setPayments(res.data.payments || [])
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tải chi tiết đơn hàng')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleAddPayment = async () => {
    if (!selectedOrder) return
    const amount = Number(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Vui lòng nhập số tiền hợp lệ')
      return
    }

    setSubmittingPayment(true)
    try {
      const res = await api.post(`/api/orders/${selectedOrder.id}/payments`, {
        amount,
        method: paymentMethod,
        reference: paymentRef || null,
        note: paymentNote || null,
        paid_at: new Date().toISOString()
      })
      if (res.success) {
        toast.success('Ghi nhận thanh toán thành công')
        setShowPaymentModal(false)
        setPaymentAmount('')
        setPaymentRef('')
        setPaymentNote('')
        // Refresh details & list
        loadOrderDetail(selectedOrder)
        fetchOrders(pagination.page)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi lưu thanh toán')
    } finally {
      setSubmittingPayment(false)
    }
  }

  const handleOpenCreateModal = async () => {
    setShowCreateModal(true)
    try {
      const custRes = await api.get('/api/customers?limit=100')
      setCustomers(custRes.data || [])

      const prodRes = await api.get('/api/products?active=1&limit=100')
      setProducts(prodRes.data || [])
    } catch {
      toast.error('Lỗi tải dữ liệu khởi tạo đơn hàng')
    }
  }

  const handleAddToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id)
    if (existing) {
      // Check stock limit for products
      if (product.type === 'product' && existing.quantity >= product.stock_quantity) {
        toast.error(`Sản phẩm ${product.name} chỉ còn ${product.stock_quantity} trong kho!`)
        return
      }
      setCart(cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
    } else {
      if (product.type === 'product' && product.stock_quantity <= 0) {
        toast.error(`Sản phẩm ${product.name} đã hết hàng trong kho!`)
        return
      }
      setCart([...cart, { product, quantity: 1 }])
    }
  }

  const handleRemoveFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId))
  }

  const handleUpdateCartQuantity = (productId: string, qty: number) => {
    const item = cart.find(c => c.product.id === productId)
    if (!item) return

    if (item.product.type === 'product' && qty > item.product.stock_quantity) {
      toast.error(`Sản phẩm ${item.product.name} chỉ còn ${item.product.stock_quantity} trong kho!`)
      return
    }

    if (qty <= 0) {
      handleRemoveFromCart(productId)
    } else {
      setCart(cart.map(c => c.product.id === productId ? { ...c, quantity: qty } : c))
    }
  }

  const handleCreateOrder = async () => {
    if (!selectedBranchId) {
      toast.error('Vui lòng chọn chi nhánh')
      return
    }
    if (cart.length === 0) {
      toast.error('Giỏ hàng trống')
      return
    }

    setSubmittingOrder(true)
    try {
      const items = cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity
      }))
      const res = await api.post('/api/orders', {
        branch_id: selectedBranchId,
        customer_id: selectedCustomerId || null,
        items
      })
      if (res.success) {
        toast.success('Tạo đơn hàng thành công')
        setShowCreateModal(false)
        setCart([])
        setSelectedCustomerId('')
        fetchOrders(1)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi tạo đơn hàng')
    } finally {
      setSubmittingOrder(false)
    }
  }

  const handleUpdateStatus = async (status: string) => {
    if (!selectedOrder) return
    try {
      const res = await api.patch(`/api/orders/${selectedOrder.id}/status`, { status })
      if (res.success) {
        toast.success('Cập nhật trạng thái đơn hàng thành công')
        loadOrderDetail({ ...selectedOrder, status: status as any })
        fetchOrders(pagination.page)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi cập nhật trạng thái')
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Header title="Quản lý đơn hàng" />
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all self-start sm:self-auto"
        >
          Tạo đơn hàng mới
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-lg border border-input bg-background text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="pending">Chờ xử lý</option>
          <option value="confirmed">Đã xác nhận</option>
          <option value="processing">Đang thực hiện</option>
          <option value="completed">Hoàn thành</option>
          <option value="cancelled">Đã hủy</option>
        </select>

        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="h-10 px-3 rounded-lg border border-input bg-background text-sm"
        >
          <option value="">Tất cả thanh toán</option>
          <option value="unpaid">Chưa thanh toán</option>
          <option value="partial">Thanh toán một phần</option>
          <option value="paid">Đã thanh toán</option>
        </select>

        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="h-10 px-3 rounded-lg border border-input bg-background text-sm col-span-2 sm:col-span-1"
        >
          <option value="">Tất cả chi nhánh</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <button
          onClick={() => fetchOrders(1)}
          className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 active:scale-[0.97] transition-all col-span-2 sm:col-span-1"
        >
          Lọc
        </button>
      </div>

      {/* ORDERS LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="border rounded-xl bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-3"><Skeleton className="h-3 w-16" /></th>
                      <th className="text-left px-4 py-3"><Skeleton className="h-3 w-20" /></th>
                      <th className="text-left px-4 py-3"><Skeleton className="h-3 w-16" /></th>
                      <th className="text-left px-4 py-3"><Skeleton className="h-3 w-14" /></th>
                      <th className="text-left px-4 py-3"><Skeleton className="h-3 w-20" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border rounded-xl">Không tìm thấy đơn hàng nào</div>
          ) : (
            <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mã đơn</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Khách hàng</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Chi nhánh</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tổng tiền</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trạng thái</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr
                        key={o.id}
                        className={`border-b last:border-0 hover:bg-accent/50 cursor-pointer ${
                          selectedOrder?.id === o.id ? 'bg-primary/5' : ''
                        }`}
                        onClick={() => loadOrderDetail(o)}
                      >
                        <td className="px-4 py-3 font-semibold text-primary">{o.order_code}</td>
                        <td className="px-4 py-3">
                          <div>{o.customer_name || 'Khách vãng lai'}</div>
                          {o.customer_phone && <div className="text-xs text-muted-foreground">{o.customer_phone}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs">{o.branch_name}</td>
                        <td className="px-4 py-3 font-medium">{formatCurrency(o.total)}</td>
                        <td className="px-4 py-3 space-y-1">
                          <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            o.status === 'completed' ? 'bg-green-100 text-green-800' :
                            o.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {o.status === 'completed' ? 'Hoàn thành' :
                             o.status === 'cancelled' ? 'Đã hủy' : 'Chờ xử lý'}
                          </span>
                          <span className={`block text-[10px] ${
                            o.payment_status === 'paid' ? 'text-green-600' :
                            o.payment_status === 'partial' ? 'text-yellow-600' :
                            'text-red-500'
                          }`}>
                            {o.payment_status === 'paid' ? 'Đã thanh toán' :
                             o.payment_status === 'partial' ? 'Trả một phần' : 'Chưa trả'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              loadOrderDetail(o)
                            }}
                            className="text-xs text-primary hover:underline font-semibold"
                          >
                            Xem chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination.totalPages > 1 && (
                <Pagination
                  pagination={pagination}
                  onPrev={() => fetchOrders(pagination.page - 1)}
                  onNext={() => fetchOrders(pagination.page + 1)}
                />
              )}
            </div>
          )}
        </div>

        {/* ORDER DETAIL SIDE PANEL */}
        <div className="lg:col-span-1">
          {selectedOrder ? (
            <div className="bg-card border rounded-xl p-4 sm:p-5 space-y-6 shadow-sm sticky top-20">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="font-bold text-lg text-primary">{selectedOrder.order_code}</h3>
                  <p className="text-xs text-muted-foreground">{formatDateTime(selectedOrder.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCurrency(selectedOrder.total)}</p>
                  <p className="text-xs text-muted-foreground">{selectedOrder.branch_name}</p>
                </div>
              </div>

              {/* Status Update Select */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Trạng thái đơn hàng</label>
                <select
                  value={selectedOrder.status}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                  disabled={selectedOrder.status === 'completed' || selectedOrder.status === 'cancelled'}
                >
                  <option value="pending">Chờ xử lý</option>
                  <option value="confirmed">Đã xác nhận</option>
                  <option value="processing">Đang thực hiện</option>
                  <option value="completed">Hoàn thành</option>
                  <option value="cancelled">Đã hủy</option>
                </select>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Sản phẩm / Dịch vụ</h4>
                {loadingDetail ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="py-2.5 flex justify-between gap-4">
                        <div className="space-y-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div>
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="divide-y text-sm">
                    {orderItems.map((item) => (
                      <div key={item.id} className="py-2.5 flex justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(item.unit_price)} x {item.quantity}
                          </p>
                        </div>
                        <span className="font-medium shrink-0">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payments List */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Thanh toán</h4>
                  {selectedOrder.status !== 'cancelled' && selectedOrder.payment_status !== 'paid' && (
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="text-xs text-primary hover:underline font-semibold"
                    >
                      + Nhập thanh toán
                    </button>
                  )}
                </div>
                {loadingDetail ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="py-2 flex justify-between gap-4">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    ))}
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-1 text-center bg-muted/40 rounded-lg">
                    Chưa có giao dịch thanh toán nào
                  </div>
                ) : (
                  <div className="divide-y text-xs">
                    {payments.map((p) => (
                      <div key={p.id} className="py-2 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-primary">{formatCurrency(p.amount)}</p>
                          <p className="text-muted-foreground">
                            {p.method === 'cash' ? 'Tiền mặt' : p.method === 'transfer' ? 'Chuyển khoản' : p.method}
                            {p.reference ? ` (${p.reference})` : ''}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{formatDateTime(p.paid_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground shadow-sm">
              Chọn một đơn hàng ở danh sách để xem chi tiết
            </div>
          )}
        </div>
      </div>

      {/* CREATE ORDER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[1px]">
          <div className="bg-background border rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg">Tạo đơn hàng mới</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setCart([])
                }}
                className="p-1 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Select Column */}
              <div className="space-y-4 flex flex-col min-h-0">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
                    Chọn chi nhánh
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => {
                      setSelectedBranchId(e.target.value)
                      setCart([]) // Clear cart when branch changes
                    }}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
                    Chọn dịch vụ & sản phẩm
                  </label>
                  <div className="border rounded-lg flex-1 overflow-y-auto divide-y">
                    {products.map(p => (
                      <div key={p.id} className="p-3 flex justify-between items-center gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(p.price)}
                            {p.type === 'product' && (
                              <span className={`ml-2 px-1.5 py-0.5 rounded font-semibold ${
                                p.stock_quantity <= 0 ? 'bg-red-100 text-red-800' :
                                p.stock_quantity < 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                              }`}>
                                Kho: {p.stock_quantity}
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAddToCart(p)}
                          className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-xs font-semibold rounded-lg transition-colors"
                        >
                          Thêm
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cart & Customer Column */}
              <div className="space-y-4 flex flex-col min-h-0 border-t md:border-t-0 md:border-l md:pl-6 pt-4 md:pt-0">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
                    Chọn khách hàng
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                  >
                    <option value="">Khách vãng lai</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name} {c.phone ? `(${c.phone})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Chi tiết giỏ hàng</h4>
                  {cart.length === 0 ? (
                    <div className="border rounded-lg flex-1 flex items-center justify-center text-sm text-muted-foreground">
                      Chưa chọn sản phẩm nào
                    </div>
                  ) : (
                    <div className="border rounded-lg flex-1 overflow-y-auto divide-y p-1">
                      {cart.map((item) => (
                        <div key={item.product.id} className="p-3 flex justify-between items-start gap-4">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{item.product.name}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(item.product.price)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleUpdateCartQuantity(item.product.id, item.quantity - 1)}
                              className="w-6 h-6 flex items-center justify-center border rounded hover:bg-accent text-sm"
                            >
                              -
                            </button>
                            <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateCartQuantity(item.product.id, item.quantity + 1)}
                              className="w-6 h-6 flex items-center justify-center border rounded hover:bg-accent text-sm"
                            >
                              +
                            </button>
                            <button
                              onClick={() => handleRemoveFromCart(item.product.id)}
                              className="ml-2 text-xs text-red-500 hover:underline shrink-0"
                            >
                              Xóa
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subtotal summary */}
                <div className="border-t pt-4 flex justify-between items-center shrink-0">
                  <span className="font-semibold text-sm">Tổng cộng:</span>
                  <span className="font-bold text-lg text-primary">
                    {formatCurrency(cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t flex justify-end gap-3 shrink-0">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setCart([])
                }}
                className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-accent active:scale-[0.98] transition-all"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={submittingOrder || cart.length === 0}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {submittingOrder ? 'Đang tạo...' : 'Tạo hóa đơn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INPUT PAYMENT MODAL */}
      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[1px]">
          <div className="bg-background border rounded-xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold">Nhập thanh toán cho {selectedOrder.order_code}</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-lg hover:bg-accent text-muted-foreground"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Số tiền thanh toán</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Nhập số tiền VNĐ..."
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Phương thức</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                >
                  <option value="cash">Tiền mặt</option>
                  <option value="transfer">Chuyển khoản</option>
                  <option value="card">Thanh toán thẻ</option>
                  <option value="momo">Momo</option>
                  <option value="zalopay">ZaloPay</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Mã tham chiếu (nếu có)</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="Mã giao dịch ngân hàng..."
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Ghi chú</label>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-accent"
              >
                Hủy
              </button>
              <button
                onClick={handleAddPayment}
                disabled={submittingPayment}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {submittingPayment ? 'Ghi nhận...' : 'Hoàn tất'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
