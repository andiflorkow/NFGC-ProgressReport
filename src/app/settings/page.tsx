'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { useToast, ToastRoot } from '../../components/ui/toast'
import { useAppData } from '../../hooks/use-app-data'
import { applyTheme, readThemeMode, THEME_MODE_KEY, ThemeMode } from '../../lib/theme'

export default function SettingsPage() {
  const { open, setOpen, message, toast } = useToast()
  const { data, save, loading } = useAppData()
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto')

  useEffect(() => {
    const mode = readThemeMode()
    setThemeMode(mode)
    applyTheme(mode)
  }, [])

  if (loading || !data) return <p>Loading...</p>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1 text-sm text-muted">Coach display name</p>
            <Input
              value={data.coachName}
              onChange={(event) => save({ ...data, coachName: event.target.value }).catch(() => toast('Could not save coach name'))}
            />
          </div>
          <div>
            <p className="mb-1 text-sm text-muted">Family contact email</p>
            <Input
              value={data.contactEmail}
              onChange={(event) => save({ ...data, contactEmail: event.target.value }).catch(() => toast('Could not save contact email'))}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-bg p-3">
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-muted">
                Automatic follows your system theme. Switch to light mode if you prefer a brighter view.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                const nextMode: ThemeMode = themeMode === 'auto' ? 'light' : 'auto'
                localStorage.setItem(THEME_MODE_KEY, nextMode)
                setThemeMode(nextMode)
                applyTheme(nextMode)
                toast(nextMode === 'auto' ? 'Theme set to automatic' : 'Theme set to light mode')
              }}
            >
              {themeMode === 'auto' ? 'Switch to Light Mode' : 'Use Automatic Theme'}
            </Button>
          </div>
        </CardContent>
      </Card>
      <ToastRoot open={open} onOpenChange={setOpen} message={message} />
    </div>
  )
}
