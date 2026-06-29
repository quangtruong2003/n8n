export interface SpaInfo {
  id: string
  name: string
  phone: string | null
  openTime: string | null
  closeTime: string | null
  botActive: boolean
  config: { botGreeting: string | null; botName: string | null } | null
  branches: { id: string; name: string; address: string | null }[]
}

export type PageKey = 'dashboard' | 'customers' | 'bookings' | 'pricing' | 'settings' | 'chat-logs'

export interface ServiceFormData {
  name: string
  price: string
  duration: string
  description: string
}

export interface Service {
  id: string
  name: string
  price: number
  duration: number | null
  description: string | null
  active: boolean
}

export interface AuthUser {
  id: string
  username: string
  role: 'super_admin' | 'owner' | 'staff'
  tenantId: string | null
  active: boolean
  fullName?: string
}

export interface TenantInfo {
  id: string
  name: string
  slug: string
  business_type: string
  open_time: string
  close_time: string
  phone?: string
  email?: string
  address?: string
}

export interface AuthState {
  user: AuthUser | null
  tenant: TenantInfo | null
  permissions: string[]
  spa: SpaInfo
  spaId: string
  updateSpa: (spa: SpaInfo) => void
}
