'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../../components/ui/accordion'
import { useAppData } from '../../../hooks/use-app-data'
import { useToast, ToastRoot } from '../../../components/ui/toast'
import { formatReportMonth } from '../../../lib/utils'
import { openReportPdfPreview } from '../../../lib/pdf-preview'

const uid = () => Math.random().toString(36).slice(2, 11)

export default function GymnastProfilePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { data, save, loading, reload } = useAppData()
  const { open, setOpen, message, toast } = useToast()
  const [editOverviewOpen, setEditOverviewOpen] = useState(false)
  const [checklistMonth, setChecklistMonth] = useState('')
  const [confirmResendReportId, setConfirmResendReportId] = useState<string | null>(null)

  if (loading || !data) return <p>Loading...</p>

  const gymnast = data.gymnasts.find((item) => item.id === params.id)
  if (!gymnast) return <p>Gymnast not found.</p>

  const reports = data.reports.filter((item) => item.gymnastId === gymnast.id).sort((a, b) => b.month.localeCompare(a.month))
  const checklistReport = reports.find((item) => item.month === checklistMonth) || reports[0]

  const latestSent = reports.flatMap((report) => report.sendHistory).sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0]

  const saveOverview = async (formData: FormData) => {
    const name = String(formData.get('name') || gymnast.name)
    const level = String(formData.get('level') || gymnast.level)
    const status = String(formData.get('status') || gymnast.status) as 'Active' | 'Inactive'
    const next = {
      ...data,
      gymnasts: data.gymnasts.map((item) =>
        item.id === gymnast.id
          ? { ...item, name, level, status, lastUpdatedAt: new Date().toISOString(), lastUpdatedBy: data.coachName }
          : item,
      ),
    }
    await save(next)
    setEditOverviewOpen(false)
    toast('Overview updated')
  }

  const addGuardian = async (formData: FormData) => {
    const email = String(formData.get('email') || '').trim()
    if (!email) return toast('Guardian email is required')
    const next = {
      ...data,
      gymnasts: data.gymnasts.map((item) =>
        item.id === gymnast.id
          ? {
              ...item,
              guardians: [
                ...item.guardians,
                { id: uid(), email, name: String(formData.get('name') || ''), phone: String(formData.get('phone') || '') },
              ],
              lastUpdatedAt: new Date().toISOString(),
              lastUpdatedBy: data.coachName,
            }
          : item,
      ),
    }
    await save(next)
    toast('Guardian added')
  }

  const removeGuardian = async (guardianId: string) => {
    const next = {
      ...data,
      gymnasts: data.gymnasts.map((item) =>
        item.id === gymnast.id
          ? {
              ...item,
              guardians: item.guardians.filter((guardian) => guardian.id !== guardianId),
              lastUpdatedAt: new Date().toISOString(),
              lastUpdatedBy: data.coachName,
            }
          : item,
      ),
    }
    await save(next)
    toast('Guardian removed')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2>{gymnast.name}</h2>
          <p className="text-sm text-muted">Primary task: review one profile section at a time.</p>
        </div>
        <Button
          onClick={() => {
            const month = new Date().toISOString().slice(0, 7)
            router.push(`/reports?gymnastId=${gymnast.id}&month=${month}`)
          }}
        >
          Build Report
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="guardians">Guardians</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Overview</CardTitle>
              <Dialog open={editOverviewOpen} onOpenChange={setEditOverviewOpen}>
                <DialogTrigger asChild><Button variant="secondary">Edit</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Edit Overview</DialogTitle></DialogHeader>
                  <form action={(formData) => void saveOverview(formData)} className="space-y-3">
                    <Input name="name" defaultValue={gymnast.name} />
                    <Input name="level" defaultValue={gymnast.level} />
                    <Input name="status" defaultValue={gymnast.status} placeholder="Active or Inactive" />
                    <Button className="w-full" type="submit">Save</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-bg p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Status</p>
                  <p className="mt-1 text-lg font-semibold">{gymnast.status}</p>
                </div>
                <div className="rounded-xl border border-border bg-bg p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Level</p>
                  <p className="mt-1 text-lg font-semibold">{gymnast.level}</p>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-bg p-3">
                <p className="font-medium">Guardians</p>
                <p className="text-sm text-muted">
                  {gymnast.guardians.length
                    ? gymnast.guardians.map((guardian) => guardian.email).join(', ')
                    : 'No guardian contacts added yet'}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-bg p-3">
                  <p className="font-medium">Last report sent</p>
                  <p className="text-sm text-muted">{latestSent ? new Date(latestSent.sentAt).toLocaleDateString() : 'No sent reports yet'}</p>
                </div>
                <div className="rounded-xl border border-border bg-bg p-3">
                  <p className="font-medium">Most recent report month</p>
                  <p className="text-sm text-muted">{reports[0] ? formatReportMonth(reports[0].month) : 'No reports yet'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guardians">
          <Card>
            <CardHeader><CardTitle>Guardians</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {gymnast.guardians.map((guardian) => (
                <div key={guardian.id} className="flex items-center justify-between rounded-xl border border-border bg-bg p-3">
                  <div>
                    <p className="font-medium">{guardian.name || 'Guardian'}</p>
                    <p className="text-sm text-muted">{guardian.email}</p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => void removeGuardian(guardian.id)}>Delete</Button>
                </div>
              ))}
              <form action={(formData) => void addGuardian(formData)} className="grid gap-2 rounded-xl border border-border bg-bg p-3 md:grid-cols-3">
                <Input name="name" placeholder="Guardian name" />
                <Input name="phone" placeholder="Phone" />
                <Input name="email" placeholder="Guardian email * Required" />
                <Button type="submit" className="md:col-span-3">Add Guardian</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklist">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Checklist</CardTitle>
              <div className="w-full max-w-[220px]">
                <Select value={checklistReport?.month || ''} onValueChange={setChecklistMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose month" />
                  </SelectTrigger>
                  <SelectContent>
                    {reports.map((report) => (
                      <SelectItem key={report.id} value={report.month}>{formatReportMonth(report.month)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {!checklistReport ? <p className="text-sm text-muted">No reports found for this gymnast yet.</p> : null}
              {checklistReport ? (
                <>
                  <div className="rounded-xl border border-border bg-bg p-3 text-sm text-muted">
                    Quick view for <span className="font-medium text-text">{formatReportMonth(checklistReport.month)}</span>. Expand an event to see notes and skill statuses.
                  </div>
                  <Accordion type="single" collapsible>
                    {Object.values(checklistReport.eventReports).map((event) => (
                      <AccordionItem key={event.event} value={event.event}>
                        <AccordionTrigger>
                          <div className="flex w-full items-center justify-between pr-2">
                            <span>{event.event}</span>
                            <Badge variant={(event.isComplete ?? (checklistReport.readiness === 'ready')) ? 'success' : 'warning'}>
                              {(event.isComplete ?? (checklistReport.readiness === 'ready')) ? 'Completed' : 'In Progress'}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 rounded-xl border border-border bg-bg p-3">
                            <p className="text-sm"><span className="font-medium">Event notes:</span> {event.eventNotes?.trim() || 'No event notes yet.'}</p>
                            {event.skills.map((skill) => (
                              <div key={skill.name} className="rounded-lg border border-border/70 p-2">
                                <p className="text-sm font-medium">{skill.name}</p>
                                <p className="text-sm text-muted">Status: {skill.status}</p>
                                {skill.notes ? <p className="text-sm text-muted">Notes: {skill.notes}</p> : null}
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader><CardTitle>Reports</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="rounded-xl border border-border bg-bg p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{formatReportMonth(report.month)}</p>
                    <Badge variant={report.readiness === 'ready' ? 'success' : 'warning'}>{report.readiness}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={async () => {
                      await openReportPdfPreview(report.id, toast)
                    }}>
                      Preview PDF
                    </Button>
                    <Button size="sm" variant="secondary" onClick={async () => {
                      const downloadWindow = window.open(`/api/reports/${report.id}/pdf?download=1`, '_blank')
                      if (!downloadWindow) {
                        toast('Popup blocked. Please allow popups to download PDFs.')
                      }
                    }}>
                      Download PDF
                    </Button>
                    <Button size="sm" onClick={async () => {
                      setConfirmResendReportId(report.id)
                    }}>Resend</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(confirmResendReportId)} onOpenChange={(openState) => !openState && setConfirmResendReportId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resend this report?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted">This will immediately send the report email again.</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmResendReportId(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                const reportId = confirmResendReportId
                setConfirmResendReportId(null)
                if (!reportId) return
                try {
                  const response = await fetch(`/api/reports/${reportId}/send`, { method: 'POST' })
                  if (!response.ok) {
                    const payload = (await response.json().catch(() => ({ error: 'Email send failed' }))) as { error?: string }
                    throw new Error(payload.error || 'Email send failed')
                  }
                  await reload()
                  toast('Report resent')
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
