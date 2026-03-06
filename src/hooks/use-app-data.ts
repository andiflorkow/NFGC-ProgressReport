'use client'

import { useCallback, useEffect, useState } from 'react'
import { AppData } from '../types/models'
import { COACH_SESSION_KEY } from '../lib/coach-session'

export function useAppData() {
  const [data, setData] = useState<AppData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/data', { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to load data')
      const payload = (await response.json()) as AppData
      const sessionCoach = typeof window !== 'undefined' ? localStorage.getItem(COACH_SESSION_KEY)?.trim() : ''
      if (sessionCoach) {
        setData({ ...payload, coachName: sessionCoach })
      } else {
        setData(payload)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(async (nextData: AppData) => {
    setData(nextData)
    const response = await fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextData),
    })

    if (!response.ok) {
      throw new Error('Failed to save data')
    }
  }, [])

  return { data, setData, save, loading, error, reload: load }
}
