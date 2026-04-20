'use client'

import { useEffect, useState } from 'react'

// useEffect is required here: we need to schedule/cancel a timer tied to
// the latest value. No TanStack Query alternative exists for pure
// client-side value debouncing.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}
