'use client'

import { DashboardPanel } from '@/components/dashboard-panel'
import { useAuth } from '@/hooks/use-auth'

export default function DashboardPage() {
  const { spaId } = useAuth()
  return <DashboardPanel spaId={spaId} />
}
