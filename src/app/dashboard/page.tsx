'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { useAppData } from '../../hooks/use-app-data'
import { useMemo, useState } from 'react'

export default function DashboardPage() {
  const { data, loading } = useAppData()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))

  const needs = useMemo(() => {
    if (!data) return []
    return data.gymnasts
      .map((gymnast) => {
        const report = data.reports.find((item) => item.gymnastId === gymnast.id && item.month === month)
        if (!report) return { gymnast, missing: ['All sections'] }

        const missingEvents = Object.values(report.eventReports)
          .filter((event) => event.skills.every((skill) => skill.status === 'Not Started'))
          .map((event) => event.event)
        return { gymnast, missing: missingEvents }
      })
      .filter((item) => item.missing.length > 0)
      .slice(0, 5)
  }, [data, month])

  if (loading || !data) return <p>Loading...</p>

  const activeCount = data.gymnasts.filter((item) => item.status === 'Active').length
  const readyReports = data.reports.filter((item) => item.month === month && item.readiness === 'ready').length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-sm text-muted">Select month to review report readiness.</p>
          <Input
            type="month"
            value={month}
            onClick={(event) => (event.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
            onChange={(event) => setMonth(event.target.value)}
            className="max-w-xs"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-5"><p className="text-sm text-muted">Total Gymnasts</p><p className="text-2xl font-semibold">{data.gymnasts.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-sm text-muted">Active Gymnasts</p><p className="text-2xl font-semibold">{activeCount}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-sm text-muted">Ready Reports</p><p className="text-2xl font-semibold">{readyReports}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Needs Updating</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {needs.length === 0 ? <p className="text-sm text-muted">No pending updates for this month.</p> : null}
          {needs.map((item) => (
            <div key={item.gymnast.id} className="flex flex-wrap items-center justify-between rounded-xl border border-border bg-bg p-3">
              <div>
                <p className="font-medium"><Link className="hover:underline" href={`/gymnasts/${item.gymnast.id}`}>{item.gymnast.name}</Link></p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.missing.map((name) => <Badge key={name} variant="warning">{name}</Badge>)}
                </div>
              </div>
              <Link href={`/reports?gymnastId=${item.gymnast.id}&month=${month}`}>
                <Button>Update Report</Button>
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
