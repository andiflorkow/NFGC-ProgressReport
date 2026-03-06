'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { useAppData } from '../../hooks/use-app-data'

export default function NeedsPage() {
  const { data, loading } = useAppData()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))

  const rows = useMemo(() => {
    if (!data) return []
    return data.gymnasts.map((gymnast) => {
      const report = data.reports.find((item) => item.gymnastId === gymnast.id && item.month === month)
      if (!report) return { gymnast, progress: 0, missing: ['All sections'] }

      const total = Object.values(report.eventReports).reduce((acc, event) => acc + event.skills.length, 0)
      const updated = Object.values(report.eventReports).reduce(
        (acc, event) => acc + event.skills.filter((skill) => skill.status !== 'Not Started').length,
        0,
      )
      const missing = Object.values(report.eventReports)
        .filter((event) => event.skills.every((skill) => skill.status === 'Not Started'))
        .map((event) => event.event)
      return { gymnast, progress: total ? Math.round((updated / total) * 100) : 0, missing }
    })
  }, [data, month])

  if (loading || !data) return <p>Loading...</p>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Needs Updating</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-2 text-sm text-muted">Primary task: identify missing report sections and jump directly to fix them.</p>
          <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="max-w-xs" />
        </CardContent>
      </Card>

      {rows.map((row) => (
        <details key={row.gymnast.id} className="rounded-xl border border-border bg-surface p-3">
          <summary className="cursor-pointer list-none">
            <div className="grid gap-2 md:grid-cols-[1.3fr_1fr_auto] md:items-center">
              <div>
                <p className="font-medium"><Link className="hover:underline" href={`/gymnasts/${row.gymnast.id}`}>{row.gymnast.name}</Link></p>
                <p className="text-sm text-muted">{row.progress}% complete</p>
              </div>
              <div className="h-2 rounded-full bg-black/10">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${row.progress}%` }} />
              </div>
              <div className="flex flex-wrap gap-1">
                {row.missing.slice(0, 3).map((item) => <Badge key={item} variant="warning">{item} missing</Badge>)}
              </div>
            </div>
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {row.missing.map((event) => (
              <Link key={event} href={`/reports?gymnastId=${row.gymnast.id}&month=${month}&event=${event}`}>
                <Button size="sm" variant="secondary">Jump to {event}</Button>
              </Link>
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}
