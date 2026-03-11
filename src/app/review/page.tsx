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
import { EventName, Report } from '../../types/models'

const EVENTS: EventName[] = ['Vault', 'Bars', 'Beam', 'Floor', 'Strength/Flexibility', 'Coachability']

const hasGoalContent = (report: Report) =>
  Boolean(
    report.projectedLevel?.level?.trim() ||
      report.projectedLevel?.notes?.trim() ||
      report.goals.some((goal) => goal.goal.trim() || goal.progressNote?.trim()),
  )

const hasAdditionalNotes = (report: Report) =>
  Boolean(report.attendance?.trim() || report.injuries?.trim() || report.reminders?.trim())

const getMissingItems = (report: Report) => {
  const missing: string[] = []
  const incompleteEvents = EVENTS.filter((event) => !report.eventReports[event].isComplete)
  if (incompleteEvents.length) {
    missing.push(`Incomplete events: ${incompleteEvents.join(', ')}`)
  }
  if (!hasGoalContent(report)) missing.push('Goals')
  if (!(report.focusAreas ?? []).some((item) => item.title.trim() || item.notes?.trim())) missing.push('Focus Areas')
  if (!report.generalNotes?.trim()) missing.push('Monthly Summary Notes')
  if (!hasAdditionalNotes(report)) missing.push('Additional Notes')
  return missing
}

const getQuickSections = (report: Report) => [
  ...EVENTS.map((event) => ({
    key: event,
    title: event,
    complete: Boolean(report.eventReports[event].isComplete),
    lines: [
      ...(report.eventReports[event].eventNotes?.trim() ? [report.eventReports[event].eventNotes.trim()] : []),
      ...report.eventReports[event].skills.map(
        (skill) => `${skill.name}: ${skill.status}${skill.notes?.trim() ? ` | ${skill.notes.trim()}` : ''}`,
      ),
    ],
    editHref: `/reports?gymnastId=${report.gymnastId}&month=${report.month}&event=${encodeURIComponent(event)}`,
  })),
  {
    key: 'summary',
    title: 'Monthly Summary',
    complete: Boolean(report.generalNotes?.trim()),
    lines: report.generalNotes?.trim() ? [report.generalNotes.trim()] : [],
    editHref: `/reports?gymnastId=${report.gymnastId}&month=${report.month}`,
  },
  {
    key: 'focus',
    title: 'Focus Areas',
    complete: Boolean((report.focusAreas ?? []).some((item) => item.title.trim() || item.notes?.trim())),
    lines: (report.focusAreas ?? [])
      .filter((item) => item.title.trim() || item.notes?.trim())
      .map((item) => `${item.title}${item.notes?.trim() ? `: ${item.notes.trim()}` : ''}`),
    editHref: `/reports?gymnastId=${report.gymnastId}&month=${report.month}`,
  },
  {
    key: 'goals',
    title: 'Goals',
    complete: hasGoalContent(report),
    lines: [
      ...(report.projectedLevel?.level ? [`Projected Level: ${report.projectedLevel.level}`] : []),
      ...(report.projectedLevel?.notes?.trim() ? [`Projected Level Notes: ${report.projectedLevel.notes.trim()}`] : []),
      ...report.goals
        .filter((goal) => goal.goal.trim() || goal.progressNote?.trim())
        .map((goal, index) => `Goal ${index + 1}: ${goal.goal || 'N/A'}${goal.progressNote?.trim() ? ` | ${goal.progressNote.trim()}` : ''}`),
    ],
    editHref: `/reports?gymnastId=${report.gymnastId}&month=${report.month}`,
  },
  {
    key: 'notes',
    title: 'Additional Notes',
    complete: hasAdditionalNotes(report),
    lines: [
      ...(report.attendance?.trim() ? [`Attendance: ${report.attendance.trim()}`] : []),
      ...(report.injuries?.trim() ? [`Injuries / Health: ${report.injuries.trim()}`] : []),
      ...(report.reminders?.trim() ? [`Reminders: ${report.reminders.trim()}`] : []),
    ],
    editHref: `/reports?gymnastId=${report.gymnastId}&month=${report.month}`,
  },
]

export default function ReviewPage() {
  const { data, save, loading, reload } = useAppData()
  const { open, setOpen, message, toast } = useToast()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([])
  const [singleConfirmReportId, setSingleConfirmReportId] = useState<string | null>(null)
  const [readyConfirm, setReadyConfirm] = useState<{ reportId: string; missingItems: string[] } | null>(null)

  const rows = useMemo(() => {
    if (!data) return []
    return data.reports
      .filter((report) => report.month === month)
      .map((report) => ({
        report,
        gymnast: data.gymnasts.find((item) => item.id === report.gymnastId),
      }))
      .sort((a, b) => (a.gymnast?.name || '').localeCompare(b.gymnast?.name || ''))
  }, [data, month])

  if (loading || !data) return <p>Loading...</p>

  const markReady = async (reportId: string) => {
    const report = data.reports.find((item) => item.id === reportId)
    if (!report) return
    const nextData = {
      ...data,
      reports: data.reports.map((item) => (item.id === reportId ? { ...item, readiness: 'ready' as const } : item)),
    }

    try {
      await save(nextData)
      await reload()
      toast('Marked ready to send')
    } catch {
      toast('Failed to update readiness')
    }
  }

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
      .filter((row) => selectedReportIds.includes(row.report.id) && row.report.readiness === 'ready')
      .map((row) => row.report.id)

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
  const selectedReadyCount = rows.filter((row) => selectedReportIds.includes(row.report.id) && row.report.readiness === 'ready').length

  const toggleSelected = (reportId: string) => {
    setSelectedReportIds((current) =>
      current.includes(reportId) ? current.filter((id) => id !== reportId) : [...current, reportId],
    )
  }

  const selectAllReady = () => {
    const readyIds = rows.filter((row) => row.report.readiness === 'ready').map((row) => row.report.id)
    setSelectedReportIds(readyIds)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle>Email Review</CardTitle>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button className="w-full sm:w-auto" variant="secondary" onClick={selectAllReady}>Select All Ready</Button>
            <Button className="w-full sm:w-auto" onClick={() => setBulkConfirmOpen(true)}>Bulk Send Selected</Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-sm text-muted">Preview each PDF first, then mark reports ready and send only the reviewed ones.</p>
          <p className="mb-3 text-sm text-muted">{readyReportCount} ready report(s) for {formatReportMonth(month)}.</p>
          <Input
            type="month"
            value={month}
            onClick={(event) => (event.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
            onChange={(event) => setMonth(event.target.value)}
            className="w-full sm:max-w-xs"
          />
        </CardContent>
      </Card>

      {!rows.length ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted">No reports found for {formatReportMonth(month)}.</p>
          </CardContent>
        </Card>
      ) : null}

      {rows.map((row) => {
        const hasPreviewedPdf = row.report.pdfHistory.length > 0
        const quickSections = getQuickSections(row.report)
        const missingItems = getMissingItems(row.report)

        return (
        <Card key={row.report.id}>
          <CardContent className="pt-4">
            <div className="grid gap-3 md:grid-cols-[auto_1.4fr_1fr_auto] md:items-start">
              <div>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selectedReportIds.includes(row.report.id)}
                  onChange={() => toggleSelected(row.report.id)}
                />
              </div>
              <div>
                <p className="font-medium">
                  {row.gymnast ? <Link className="hover:underline" href={`/gymnasts/${row.gymnast.id}`}>{row.gymnast.name}</Link> : 'Unknown Gymnast'}
                </p>
                <p className="text-sm text-muted">Level: {row.gymnast?.level || 'Unknown'} • {formatReportMonth(row.report.month)}</p>
                <p className="break-words text-sm text-muted">Recipients: {row.gymnast?.guardians.map((item) => item.email).join(', ') || 'Missing recipient'}</p>
                <p className="break-words text-sm text-muted">Subject: NFGC Progress Report - {row.gymnast?.name || 'Unknown'} - {formatReportMonth(month)}</p>
              </div>
              <div>
                <Badge variant={row.report.readiness === 'ready' ? 'success' : 'warning'}>{row.report.readiness === 'ready' ? 'Ready' : 'Draft'}</Badge>
                <p className="mt-1 text-sm text-muted">PDF reviewed: {hasPreviewedPdf ? 'Yes' : 'No'}</p>
                <p className="mt-1 text-sm text-muted">Last updated: {new Date(row.report.lastUpdatedAt).toLocaleDateString()}</p>
              </div>
              <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:flex-wrap">
                <Button className="w-full md:w-auto" size="sm" variant="secondary" onClick={async () => {
                  const opened = await openReportPdfPreview(row.report.id, toast)
                  if (opened) await reload()
                }}>Preview PDF</Button>
                <Button
                  className="w-full md:w-auto"
                  size="sm"
                  variant="secondary"
                  disabled={!hasPreviewedPdf || row.report.readiness === 'ready'}
                  onClick={() => {
                    if (!hasPreviewedPdf) {
                      toast('Preview the PDF before marking ready')
                      return
                    }
                    if (missingItems.length) {
                      setReadyConfirm({ reportId: row.report.id, missingItems })
                      return
                    }
                    void markReady(row.report.id)
                  }}
                >
                  {row.report.readiness === 'ready' ? 'Ready' : 'Mark Ready'}
                </Button>
                <Button className="w-full md:w-auto" size="sm" disabled={row.report.readiness !== 'ready'} onClick={() => {
                  setSingleConfirmReportId(row.report.id)
                }}>Send</Button>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-bg px-3 py-2">
              <Accordion type="single" collapsible>
                <AccordionItem value={`review-${row.report.id}`}>
                  <AccordionTrigger>
                    <span>Quick breakdown</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {quickSections.map((section) => (
                        <div key={section.key} className="rounded-lg border border-border bg-surface p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{section.title}</span>
                              <Badge variant={section.complete ? 'success' : 'warning'}>{section.complete ? 'Complete' : 'Open'}</Badge>
                            </div>
                            <Link className="text-sm font-medium text-primary hover:underline" href={section.editHref}>Edit</Link>
                          </div>
                          {section.lines.length ? (
                            <div className="space-y-1 text-sm text-muted">
                              {section.lines.slice(0, 5).map((line, index) => (
                                <p key={`${section.key}-${index}`}>{line}</p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted">Nothing added yet.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </CardContent>
        </Card>
      )})}

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
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setBulkConfirmOpen(false)}>Cancel</Button>
            <Button
              className="w-full sm:w-auto"
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
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setSingleConfirmReportId(null)}>Cancel</Button>
            <Button
              className="w-full sm:w-auto"
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

      <Dialog open={Boolean(readyConfirm)} onOpenChange={(openState) => !openState && setReadyConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark this report ready?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted">Some sections still look incomplete. You can still mark it ready, but review these first:</p>
          <div className="space-y-1 text-sm text-muted">
            {readyConfirm?.missingItems.map((item) => <p key={item}>• {item}</p>)}
          </div>
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setReadyConfirm(null)}>Cancel</Button>
            <Button
              className="w-full sm:w-auto"
              onClick={async () => {
                const reportId = readyConfirm?.reportId
                setReadyConfirm(null)
                if (!reportId) return
                await markReady(reportId)
              }}
            >
              Mark Ready Anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ToastRoot open={open} onOpenChange={setOpen} message={message} />
    </div>
  )
}
