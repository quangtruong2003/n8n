'use client'

import { BookingsPanel } from '@/components/bookings-panel'
import { useAuth } from '@/hooks/use-auth'

export default function BookingsPage() {
  const { spaId } = useAuth()
  return <BookingsPanel spaId={spaId} />
}
