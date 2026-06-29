'use client'

import { useContext, useState } from 'react'
import { toast } from 'sonner'
import { AuthContext } from './auth-provider'
import { Header } from './header'
import { api } from '@/lib/api'

export function ProfilePanel() {
  const auth = useContext(AuthContext)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  if (!auth?.user) return null
  const { user } = auth

  const userInitials = user.username
    ? user.username.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U'

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Vui lòng nhập đầy đủ thông tin')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự')
      return
    }
    setSaving(true)
    try {
      const res = await api.post('/api/auth/change-password', {
        currentPassword,
        newPassword,
      })
      if (res.success) {
        toast.success('Đổi mật khẩu thành công')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast.error(res.error || 'Đổi mật khẩu thất bại')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi đổi mật khẩu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Header title="Thông tin cá nhân" />

      {/* Profile Card */}
      <div className="bg-card border border-border rounded-xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-4 shrink-0">
            <div className="w-[120px] h-[120px] rounded-full bg-muted border-2 border-border flex items-center justify-center text-3xl font-bold text-foreground">
              {userInitials}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Tên đăng nhập</label>
                <div className="px-3 py-2 border border-border rounded-md bg-muted/30 text-sm font-mono">{user.username}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Họ và tên</label>
                <div className="px-3 py-2 border border-border rounded-md bg-muted/30 text-sm">{user.fullName || 'Chưa cập nhật'}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Vai trò</label>
                <div className="px-3 py-2 border border-border rounded-md bg-muted/30 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${user.role === 'super_admin' ? 'bg-foreground' : user.role === 'owner' ? 'bg-success' : 'bg-muted-foreground'}`} />
                    {user.role === 'super_admin' ? 'Quản trị viên cấp cao' : user.role === 'owner' ? 'Chủ sở hữu' : 'Nhân viên'}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Trạng thái</label>
                <div className="px-3 py-2 border border-border rounded-md bg-muted/30 text-sm">
                  <span className={`inline-flex items-center gap-1.5 ${user.active ? 'text-success' : 'text-destructive'}`}>
                    <span className={`w-2 h-2 rounded-full ${user.active ? 'bg-success' : 'bg-destructive'}`} />
                    {user.active ? 'Đang hoạt động' : 'Đã khóa'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-card border border-border rounded-xl p-6 sm:p-8">
        <h3 className="text-base font-semibold mb-5">Đổi mật khẩu</h3>
        <div className="max-w-md space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Mật khẩu hiện tại</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full h-10 px-3 border border-input bg-background rounded-md text-sm outline-none focus:border-foreground transition-colors"
              placeholder="Nhập mật khẩu hiện tại"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Mật khẩu mới</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full h-10 px-3 border border-input bg-background rounded-md text-sm outline-none focus:border-foreground transition-colors"
              placeholder="Ít nhất 6 ký tự"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Xác nhận mật khẩu mới</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full h-10 px-3 border border-input bg-background rounded-md text-sm outline-none focus:border-foreground transition-colors"
              placeholder="Nhập lại mật khẩu mới"
            />
          </div>
          <button
            onClick={handleChangePassword}
            disabled={saving}
            className="h-10 px-5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </div>
    </div>
  )
}
