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

  // Safely read-modify-write: always fetches the latest server state before
  // applying the patch so concurrent saves from other users are not overwritten.
  const saveWithPatch = useCallback(async (patcher: (current: AppData) => AppData) => {
    const response = await fetch('/api/data', { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to load latest data before saving')
    const sessionCoach = typeof window !== 'undefined' ? localStorage.getItem(COACH_SESSION_KEY)?.trim() : ''
    const latest = (await response.json()) as AppData
    const base: AppData = sessionCoach ? { ...latest, coachName: sessionCoach } : latest
    const next = patcher(base)
    await save(next)
  }, [save])

  return { data, setData, save, saveWithPatch, loading, error, reload: load }
}
