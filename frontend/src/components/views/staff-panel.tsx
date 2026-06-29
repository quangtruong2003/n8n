'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

interface Staff {
  id: string
  username: string
  full_name: string | null
  phone: string | null
  email: string | null
  role_id?: string
  role_name?: string
  branches?: string[]
}

interface Role {
  id: string
  name: string
  description: string | null
  permissionsCount?: number
}

interface Permission {
  resource: string
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
}

const RESOURCES = ['booking', 'order', 'customer', 'chat', 'product'] as const

export function StaffPanel() {
  const [activeTab, setActiveTab] = useState<'staff' | 'roles'>('staff')

  // Staff CRUD states
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [showStaffModal, setShowStaffModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)

  // Staff Form
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [submittingStaff, setSubmittingStaff] = useState(false)

  // Roles states
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [savingPerms, setSavingPerms] = useState(false)

  // Shared context
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])

  const fetchStaff = async () => {
    setLoadingStaff(true)
    try {
      const res = await api.get('/api/staff')
      setStaffList(res.data || [])
    } catch {
      toast.error('Lỗi tải danh sách nhân viên')
    } finally {
      setLoadingStaff(false)
    }
  }

  const fetchRoles = async () => {
    try {
      const res = await api.get('/api/roles')
      setRoles(res.data || [])
      if (res.data && res.data.length > 0 && !selectedRole) {
        setSelectedRole(res.data[0])
      }
    } catch {
      toast.error('Lỗi tải danh sách vai trò')
    }
  }

  useEffect(() => {
    fetchStaff()
    fetchRoles()
    api.get('/api/branches')
      .then((res) => setBranches(res.data || []))
      .catch(() => {})
  }, [])

  // Load permissions when selected role changes
  useEffect(() => {
    if (!selectedRole || activeTab !== 'roles') return

    const loadPermissions = async () => {
      setLoadingPerms(true)
      try {
        const res = await api.get(`/api/roles/${selectedRole.id}/permissions`)
        // Initialize default permissions for all resources
        const permsMap = new Map<string, Permission>()
        RESOURCES.forEach(r => permsMap.set(r, {
          resource: r,
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false
        }))

        if (res.data && Array.isArray(res.data)) {
          res.data.forEach((p: any) => {
            permsMap.set(p.resource, {
              resource: p.resource,
              can_view: p.can_view === 1,
              can_create: p.can_create === 1,
              can_edit: p.can_edit === 1,
              can_delete: p.can_delete === 1
            })
          })
        }
        setPermissions(Array.from(permsMap.values()))
      } catch {
        toast.error('Lỗi tải quyền hạn')
      } finally {
        setLoadingPerms(false)
      }
    }

    loadPermissions()
  }, [selectedRole, activeTab])

  const handleSavePermissions = async () => {
    if (!selectedRole) return
    setSavingPerms(true)
    try {
      const formatted = permissions.map(p => ({
        resource: p.resource,
        can_view: p.can_view ? 1 : 0,
        can_create: p.can_create ? 1 : 0,
        can_edit: p.can_edit ? 1 : 0,
        can_delete: p.can_delete ? 1 : 0
      }))

      const res = await api.put(`/api/roles/${selectedRole.id}/permissions`, {
        permissions: formatted
      })
      if (res.success) {
        toast.success('Cập nhật quyền hạn thành công')
        fetchRoles()
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi lưu quyền hạn')
    } finally {
      setSavingPerms(false)
    }
  }

  const handleOpenCreateModal = () => {
    setEditingStaff(null)
    setUsername('')
    setPassword('')
    setFullName('')
    setPhone('')
    setEmail('')
    setSelectedRoleId(roles[0]?.id || '')
    setSelectedBranches([])
    setShowStaffModal(true)
  }

  const handleSaveStaff = async () => {
    if (!username.trim() || (!editingStaff && !password.trim())) {
      toast.error('Vui lòng điền đầy đủ tài khoản & mật khẩu')
      return
    }

    setSubmittingStaff(true)
    try {
      if (editingStaff) {
        // Update staff
        await api.put(`/api/staff/${editingStaff.id}`, {
          name: fullName || null,
          phone: phone || null,
          email: email || null,
          role_id: selectedRoleId
        })

        // Assign branches
        await api.put(`/api/staff/${editingStaff.id}/branches`, {
          branch_ids: selectedBranches
        })

        toast.success('Cập nhật thông tin nhân viên thành công')
      } else {
        // Create staff
        await api.post('/api/staff', {
          username,
          password,
          name: fullName || null,
          phone: phone || null,
          email: email || null,
          role_id: selectedRoleId,
          branch_ids: selectedBranches
        })

        toast.success('Tạo tài khoản nhân viên thành công')
      }
      setShowStaffModal(false)
      fetchStaff()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi lưu thông tin')
    } finally {
      setSubmittingStaff(false)
    }
  }

  const handleTogglePermission = (resource: string, field: keyof Omit<Permission, 'resource'>) => {
    setPermissions(permissions.map(p => {
      if (p.resource !== resource) return p
      return {
        ...p,
        [field]: !p[field]
      }
    }))
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3">
        <h2 className="text-xl sm:text-2xl font-bold">Quản trị nhân sự</h2>
        {activeTab === 'staff' && (
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all self-start sm:self-auto"
          >
            Thêm nhân viên mới
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 shrink-0">
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2.5 text-xs sm:text-sm rounded-lg whitespace-nowrap transition-all active:scale-95 ${
            activeTab === 'staff'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          Tài khoản Nhân viên
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2.5 text-xs sm:text-sm rounded-lg whitespace-nowrap transition-all active:scale-95 ${
            activeTab === 'roles'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          Vai trò & Quyền hạn
        </button>
      </div>

      {/* TAB 1: STAFF LIST */}
      {activeTab === 'staff' && (
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          {loadingStaff ? (
            <div className="p-8 text-center text-muted-foreground">Đang tải nhân viên...</div>
          ) : staffList.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Chưa có tài khoản nhân viên nào</div>
          ) : (
            <div className="overflow-x-auto text-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tài khoản</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Họ tên</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Liên hệ</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vai trò</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((st) => (
                    <tr key={st.id} className="border-b last:border-0 hover:bg-accent/50">
                      <td className="px-4 py-3 font-mono font-semibold">{st.username}</td>
                      <td className="px-4 py-3">{st.full_name || '-'}</td>
                      <td className="px-4 py-3">
                        {st.phone && <div className="text-xs">{st.phone}</div>}
                        {st.email && <div className="text-[11px] text-muted-foreground">{st.email}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                          {st.role_name || 'Nhân viên'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setEditingStaff(st)
                            setUsername(st.username)
                            setFullName(st.full_name || '')
                            setPhone(st.phone || '')
                            setEmail(st.email || '')
                            setSelectedRoleId(st.role_id || '')
                            setSelectedBranches(st.branches || [])
                            setShowStaffModal(true)
                          }}
                          className="text-xs text-primary hover:underline font-semibold"
                        >
                          Chỉnh sửa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSIONS */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Roles selection */}
          <div className="lg:col-span-1 space-y-2.5">
            <h3 className="text-xs font-bold text-muted-foreground uppercase">Danh sách Vai trò</h3>
            <div className="space-y-1.5">
              {roles.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedRole(r)}
                  className={`p-3 border rounded-xl cursor-pointer hover:bg-accent/40 transition-all duration-150 ${
                    selectedRole?.id === r.id ? 'bg-primary/10 text-primary font-semibold' : ''
                  }`}
                >
                  <p className="text-sm">{r.name}</p>
                  {r.description && <p className="text-[11px] text-muted-foreground mt-0.5">{r.description}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Permissions Checklist */}
          <div className="lg:col-span-2 space-y-4">
            {selectedRole ? (
              <div className="bg-card border rounded-xl p-4 sm:p-5 shadow-sm space-y-6">
                <div>
                  <h3 className="font-bold text-base">Quyền hạn của: {selectedRole.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tích chọn để cấp quyền xem, tạo, sửa hoặc xóa cho các nghiệp vụ.
                  </p>
                </div>

                {loadingPerms ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">Đang tải cấu hình quyền...</div>
                ) : (
                  <div className="overflow-x-auto text-sm border rounded-lg">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase">Nghiệp vụ</th>
                          <th className="text-center px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase">Xem</th>
                          <th className="text-center px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase">Tạo</th>
                          <th className="text-center px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase">Sửa</th>
                          <th className="text-center px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase">Xóa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {permissions.map((p) => {
                          const label =
                            p.resource === 'booking' ? 'Lịch hẹn (Booking)' :
                            p.resource === 'order' ? 'Hóa đơn (Order)' :
                            p.resource === 'customer' ? 'Khách hàng (CRM)' :
                            p.resource === 'chat' ? 'Kênh chat (Takeover)' :
                            p.resource === 'product' ? 'Hàng hóa / Dịch vụ' : p.resource

                          return (
                            <tr key={p.resource} className="hover:bg-accent/20">
                              <td className="px-4 py-3.5 font-semibold text-sm">{label}</td>
                              <td className="px-4 py-3.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={p.can_view}
                                  onChange={() => handleTogglePermission(p.resource, 'can_view')}
                                  className="w-4 h-4 rounded border-input cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={p.can_create}
                                  onChange={() => handleTogglePermission(p.resource, 'can_create')}
                                  className="w-4 h-4 rounded border-input cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={p.can_edit}
                                  onChange={() => handleTogglePermission(p.resource, 'can_edit')}
                                  className="w-4 h-4 rounded border-input cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={p.can_delete}
                                  onChange={() => handleTogglePermission(p.resource, 'can_delete')}
                                  className="w-4 h-4 rounded border-input cursor-pointer"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t shrink-0">
                  <button
                    onClick={handleSavePermissions}
                    disabled={savingPerms || loadingPerms}
                    className="w-full sm:w-auto px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 active:scale-[0.98] transition-all"
                  >
                    {savingPerms ? 'Đang lưu...' : 'Lưu cấu hình quyền'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
                Chọn một vai trò để bắt đầu cấu hình quyền hạn
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE/EDIT STAFF MODAL */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[1px]">
          <div className="bg-background border rounded-xl max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">
                {editingStaff ? `Chỉnh sửa nhân viên: ${editingStaff.username}` : 'Thêm nhân viên mới'}
              </h3>
              <button
                onClick={() => setShowStaffModal(false)}
                className="p-1 rounded-lg hover:bg-accent text-muted-foreground"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {!editingStaff && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Tài khoản (Username)</label>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Mật khẩu</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Họ tên nhân viên</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Số điện thoại</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Chọn Vai trò</label>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Branch Assignments checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">Gán Chi nhánh hoạt động</label>
                <div className="space-y-1.5 border p-3 rounded-lg max-h-36 overflow-y-auto">
                  {branches.map(b => {
                    const isChecked = selectedBranches.includes(b.id)
                    return (
                      <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedBranches(selectedBranches.filter(id => id !== b.id))
                            } else {
                              setSelectedBranches([...selectedBranches, b.id])
                            }
                          }}
                          className="w-4 h-4 rounded border-input cursor-pointer"
                        />
                        <span>{b.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowStaffModal(false)}
                className="px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-accent"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveStaff}
                disabled={submittingStaff}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
              >
                {submittingStaff ? 'Đang lưu...' : 'Hoàn tất'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
