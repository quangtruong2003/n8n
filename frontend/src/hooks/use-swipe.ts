'use client'

import { useRef } from 'react'

export function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void, threshold = 50) {
  const touchStart = useRef(0)
  const touchEnd = useRef(0)

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.changedTouches[0].screenX
  }
  const onTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.changedTouches[0].screenX
  }
  const onTouchEnd = () => {
    const diff = touchStart.current - touchEnd.current
    if (Math.abs(diff) > threshold) {
      if (diff > 0) onSwipeLeft()
      else onSwipeRight()
    }
  }

  return { onTouchStart, onTouchMove, onTouchEnd }
}
