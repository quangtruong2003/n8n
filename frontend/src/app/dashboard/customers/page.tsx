'use client'

import { CustomersPanel } from '@/components/customers-panel'
import { useAuth } from '@/hooks/use-auth'

export default function CustomersPage() {
  const { spaId } = useAuth()
  return <CustomersPanel spaId={spaId} />
}
