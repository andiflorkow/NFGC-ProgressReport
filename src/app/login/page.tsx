'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { COACH_SESSION_KEY } from '../../lib/coach-session'
import { AppData } from '../../types/models'

const COACH_OPTIONS = ['Coach Andi', 'Coach Olivia', 'Coach GC', 'Coach Erin', 'Coach Melissa', 'Other'] as const

export default function LoginPage() {
  const router = useRouter()
  const [coachSelection, setCoachSelection] = useState<(typeof COACH_OPTIONS)[number]>('Coach Andi')
  const [otherCoachName, setOtherCoachName] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const selectedCoach = coachSelection === 'Other' ? otherCoachName.trim() : coachSelection

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Coach Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted">Select your coach name to continue.</p>
          <div>
            <p className="mb-1 text-sm">Coach</p>
            <Select value={coachSelection} onValueChange={(value) => setCoachSelection(value as (typeof COACH_OPTIONS)[number])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COACH_OPTIONS.map((coach) => <SelectItem key={coach} value={coach}>{coach}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {coachSelection === 'Other' ? (
            <div>
              <p className="mb-1 text-sm">Type your name</p>
              <Input value={otherCoachName} onChange={(event) => setOtherCoachName(event.target.value)} placeholder="Coach name" />
            </div>
          ) : null}

          <Button
            className="w-full"
            disabled={loggingIn || !selectedCoach}
            onClick={async () => {
              try {
                setLoggingIn(true)
                localStorage.setItem(COACH_SESSION_KEY, selectedCoach)

                // Persist active coach name so all server-side send/update actions are attributed correctly.
                const response = await fetch('/api/data', { cache: 'no-store' })
                if (response.ok) {
                  const payload = (await response.json()) as AppData
                  await fetch('/api/data', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...payload, coachName: selectedCoach }),
                  })
                }
              } finally {
                setLoggingIn(false)
                router.replace('/dashboard')
              }
            }}
          >
            {loggingIn ? 'Logging in...' : 'Login'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
