'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { useToast, ToastRoot } from '../../components/ui/toast'
import { useAppData } from '../../hooks/use-app-data'
import { formatReportMonth } from '../../lib/utils'
import { openReportPdfPreview } from '../../lib/pdf-preview'

const uid = () => Math.random().toString(36).slice(2, 11)

export default function ReviewPage() {
  const { data, save, loading, reload } = useAppData()
  const { open, setOpen, message, toast } = useToast()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([])
  const [singleConfirmReportId, setSingleConfirmReportId] = useState<string | null>(null)

  const rows = useMemo(() => {
    if (!data) return []
    return data.gymnasts
      .filter((gymnast) => gymnast.status === 'Active')
      .map((gymnast) => ({
        gymnast,
        report: data.reports.find((item) => item.gymnastId === gymnast.id && item.month === month),
      }))
  }, [data, month])

  if (loading || !data) return <p>Loading...</p>

  const send = async (reportId: string) => {
    const response = await fetch(`/api/reports/${reportId}/send`, { method: 'POST' })
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ error: 'Email send failed' }))) as { error?: string }
      throw new Error(payload.error || 'Email send failed')
    }

    await reload()
    toast('Report sent')
  }

  const bulkSendSelected = async () => {
    const selectedReady = rows
      .filter((row) => row.report && selectedReportIds.includes(row.report.id) && row.report.readiness === 'ready')
      .map((row) => row.report!.id)

    if (!selectedReady.length) return toast('No selected ready reports to send')

    const results = await Promise.all(
      selectedReady.map(async (reportId) => {
        const response = await fetch(`/api/reports/${reportId}/send`, { method: 'POST' })
        return response.ok
      }),
    )

    const sentCount = results.filter(Boolean).length
    if (sentCount > 0) {
      await reload()
    }
    if (sentCount === selectedReady.length) {
      setSelectedReportIds((current) => current.filter((id) => !selectedReady.includes(id)))
      toast(`Bulk sent ${sentCount} report(s)`)
      return
    }

    toast(`Bulk send finished: ${sentCount}/${selectedReady.length} sent. Check SMTP settings for failures.`)
  }

  const readyReportCount = rows.filter((row) => row.report?.readiness === 'ready').length
  const selectedReadyCount = rows.filter((row) => row.report && selectedReportIds.includes(row.report.id) && row.report.readiness === 'ready').length

  const toggleSelected = (reportId: string) => {
    setSelectedReportIds((current) =>
      current.includes(reportId) ? current.filter((id) => id !== reportId) : [...current, reportId],
    )
  }

  const selectAllReady = () => {
    const readyIds = rows.filter((row) => row.report?.readiness === 'ready').map((row) => row.report!.id)
    setSelectedReportIds(readyIds)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Email Review</CardTitle>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={selectAllReady}>Select All Ready</Button>
            <Button onClick={() => setBulkConfirmOpen(true)}>Bulk Send Selected</Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-sm text-muted">Primary task: send only ready reports for active gymnasts.</p>
          <Input
            type="month"
            value={month}
            onClick={(event) => (event.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
            onChange={(event) => setMonth(event.target.value)}
            className="max-w-xs"
          />
        </CardContent>
      </Card>

      {rows.map((row) => (
        <Card key={row.gymnast.id}>
          <CardContent className="pt-4">
            <div className="grid gap-3 md:grid-cols-[auto_1.3fr_1fr_auto] md:items-center">
              <div>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  disabled={!row.report}
                  checked={Boolean(row.report && selectedReportIds.includes(row.report.id))}
                  onChange={() => row.report && toggleSelected(row.report.id)}
                />
              </div>
              <div>
                <p className="font-medium">
                  <Link className="hover:underline" href={`/gymnasts/${row.gymnast.id}`}>{row.gymnast.name}</Link>
                </p>
                <p className="text-sm text-muted">Recipients: {row.gymnast.guardians.map((item) => item.email).join(', ') || 'Missing recipient'}</p>
                <p className="text-sm text-muted">Subject: NFGC Progress Report - {row.gymnast.name} - {formatReportMonth(month)}</p>
              </div>
              <div>
                <Badge variant={row.report?.readiness === 'ready' ? 'success' : 'warning'}>{row.report?.readiness === 'ready' ? 'Ready' : 'Not Ready'}</Badge>
                <p className="mt-1 text-sm text-muted">Last updated: {row.report ? new Date(row.report.lastUpdatedAt).toLocaleDateString() : 'No report yet'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={!row.report} onClick={async () => {
                  if (!row.report) return
                  await openReportPdfPreview(row.report.id, toast)
                }}>Preview PDF</Button>
                <Button size="sm" disabled={!row.report || row.report.readiness !== 'ready'} onClick={async () => {
                  if (!row.report) return
                  setSingleConfirmReportId(row.report.id)
                }}>Send</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader><CardTitle>Send History</CardTitle></CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            <AccordionItem value="send-history">
              <AccordionTrigger>
                <span>Show latest send activity</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1 text-sm text-muted">
                  {data.reports
                    .flatMap((report) => report.sendHistory.map((send) => ({ report, send })))
                    .sort((a, b) => b.send.sentAt.localeCompare(a.send.sentAt))
                    .slice(0, 20)
                    .map(({ report, send }) => {
                      const gymnast = data.gymnasts.find((item) => item.id === report.gymnastId)
                      return (
                        <p key={send.id}>
                          {gymnast ? <Link className="hover:underline" href={`/gymnasts/${gymnast.id}`}>{gymnast.name}</Link> : 'Unknown'} - {send.status} by {send.by} on {new Date(send.sentAt).toLocaleString()}
                        </p>
                      )
                    })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Dialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send {selectedReadyCount} selected ready report(s)?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted">This will immediately send selected ready reports for {formatReportMonth(month)}.</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBulkConfirmOpen(false)}>Cancel</Button>
            <Button
              disabled={selectedReadyCount === 0}
              onClick={async () => {
                setBulkConfirmOpen(false)
                await bulkSendSelected()
              }}
            >
              Confirm Send
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(singleConfirmReportId)} onOpenChange={(openState) => !openState && setSingleConfirmReportId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this report now?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted">This will email the selected gymnast's family immediately.</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSingleConfirmReportId(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                const reportId = singleConfirmReportId
                setSingleConfirmReportId(null)
                if (!reportId) return
                try {
                  await send(reportId)
                } catch (error) {
                  toast(error instanceof Error ? error.message : 'Email send failed')
                }
              }}
            >
              Confirm Send
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ToastRoot open={open} onOpenChange={setOpen} message={message} />
    </div>
  )
}
