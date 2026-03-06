'use client'

import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { useToast, ToastRoot } from '../../components/ui/toast'
import { useAppData } from '../../hooks/use-app-data'

export default function SettingsPage() {
  const { open, setOpen, message, toast } = useToast()
  const { data, save, loading } = useAppData()

  useEffect(() => {
    if (!data) return
    document.documentElement.classList.toggle('dark', data.darkMode)
  }, [data?.darkMode])

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
              <p className="font-medium">Dark mode</p>
              <p className="text-sm text-muted">Light mode is default. Dark mode is optional.</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => save({ ...data, darkMode: !data.darkMode }).then(() => toast('Theme updated')).catch(() => toast('Could not update theme'))}
            >
              {data.darkMode ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </CardContent>
      </Card>
      <ToastRoot open={open} onOpenChange={setOpen} message={message} />
    </div>
  )
}
