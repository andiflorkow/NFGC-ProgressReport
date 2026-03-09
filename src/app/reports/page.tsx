'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { useToast, ToastRoot } from '../../components/ui/toast'
import { useAppData } from '../../hooks/use-app-data'
import { EventName, Report, SkillStatus } from '../../types/models'
import { formatReportMonth } from '../../lib/utils'
import { openReportPdfPreview } from '../../lib/pdf-preview'

const EVENTS: EventName[] = ['Vault', 'Bars', 'Beam', 'Floor', 'Strength/Flexibility', 'Coachability']
const SKILL_STATUSES: SkillStatus[] = ['Not Started', 'Working', 'Consistent', 'Competition Ready']
const COACHABILITY_STATUSES: SkillStatus[] = ['1', '2', '3', '4', '5']
const COACHABILITY_FIELDS = ['Respect', 'Work Ethic', 'Training Habits'] as const
const OPTIONAL_SKILL_EVENTS: EventName[] = ['Strength/Flexibility']
const DEFAULT_EVENT_SKILL_LIBRARY: Record<EventName, string[]> = {
  Vault: ['Front Handspring', 'Round-Off Entry', 'Handstand Flat Back', 'Block Technique', 'Stick Landing'],
  Bars: ['Pullover', 'Back Hip Circle', 'Cast to Horizontal', 'Kip Drill', 'Dismount Landing'],
  Beam: ['Cartwheel', 'Handstand Hold', 'Leap Series', 'Turn Control', 'Dismount'],
  Floor: ['Round-Off Back Handspring', 'Front Tuck', 'Dance Passage', 'Split Leap', 'Routine Form'],
  'Strength/Flexibility': [],
  Coachability: [],
}

const LEVEL_SKILL_LIBRARY: Partial<Record<string, Partial<Record<EventName, string[]>>>> = {
  'Xcel Bronze': {
    Vault: ['Straight Jump', 'Kick Handstand Flat Fall', 'Handstand Flat Fall', 'Front Handspring'],
    Bars: [
      'Glide Swing',
      'Pullover',
      'Kip',
      'Cast',
      'Back Hip Circle',
      'Double Back Hip Circle',
      'Straddle Sole Circle Dismount',
      'Pike Sole Circle Dismount',
      'Back Hip Circle Undershoot Dismount',
      'Squat On',
      'Jump to High Bar',
    ],
    Beam: [
      'Mount',
      'Pivot Turn',
      'Half Turn',
      'Full Turn',
      'Straight Jump',
      'Split Jump',
      'Lever',
      'Hiccup',
      'Handstand',
      'Cartwheel',
      'Side Handstand Dismount',
      'Side Handstand Quarter Turn Dismount',
    ],
    Floor: [
      'Half Turn',
      'Full Turn',
      'Leap',
      'Dance Routine',
      'Round-off Rebound',
      'Round-off Rebound Backward Roll',
      'Round-off Back Handspring',
      'Front Handspring',
      'Front Tuck',
    ],
  },
}

const PROJECTED_LEVEL_OPTIONS = [
  'Xcel Bronze',
  'Xcel Silver',
  'Xcel Gold',
  'Xcel Platinum',
  'Xcel Diamond',
  'Xcel Sapphire',
  'Level 1',
  'Level 2',
  'Level 3',
  'Level 4',
  'Level 5',
  'Level 6',
  'Level 7',
  'Level 8',
  'Level 9',
  'Level 10',
] as const

const emptyEventValues = EVENTS.reduce((acc, event) => {
  acc[event] = ''
  return acc
}, {} as Record<EventName, string>)

const buildCoachabilitySkills = () =>
  COACHABILITY_FIELDS.map((name) => ({
    name,
    status: '3' as SkillStatus,
    notes: '',
  }))

const normalizeCoachabilityStatus = (status?: SkillStatus) => {
  if (!status) return '3' as SkillStatus
  if (status === 'Exceeding Expectations') return '5' as SkillStatus
  if (status === 'Meeting Expectations') return '4' as SkillStatus
  if (status === 'Working/Improving') return '3' as SkillStatus
  if (status === 'Needs Support') return '2' as SkillStatus
  if (status === 'Not Started') return '1' as SkillStatus
  if (status === 'Working') return '3' as SkillStatus
  if (status === 'Consistent') return '4' as SkillStatus
  if (status === 'Competition Ready') return '5' as SkillStatus
  return status
}

const buildEmptyEventReport = (event: EventName, coachName: string): Report['eventReports'][EventName] => ({
  event,
  eventNotes: '',
  isComplete: false,
  lastUpdatedAt: new Date().toISOString(),
  lastUpdatedBy: coachName,
  skills: event === 'Coachability' ? buildCoachabilitySkills() : [],
})

const normalizeReportForCurrentEvents = (report: Report, coachName: string): Report => {
  const rawEventReports = report.eventReports as unknown as Record<string, Report['eventReports'][EventName]>
  const nextEventReports = EVENTS.reduce((acc, event) => {
    const current = rawEventReports[event] ?? (event === 'Coachability' ? rawEventReports.Behavior : undefined)
    const fallback = buildEmptyEventReport(event, coachName)
    acc[event] = current
      ? {
          ...fallback,
          ...current,
          event,
          skills:
            event === 'Coachability'
              ? COACHABILITY_FIELDS.map((fieldName) => {
                  const existing = current.skills.find((skill) => skill.name === fieldName)
                  if (!existing) {
                    return { name: fieldName, status: '3' as SkillStatus, notes: '' }
                  }
                  return {
                    ...existing,
                    status: normalizeCoachabilityStatus(existing.status),
                  }
                })
              : current.skills,
        }
      : fallback
    return acc
  }, {} as Report['eventReports'])

  return {
    ...report,
    eventReports: nextEventReports,
  }
}

const uid = () => Math.random().toString(36).slice(2, 11)

export default function ReportsPage() {
  const { data, save, loading } = useAppData()
  const { open, setOpen, message, toast } = useToast()

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [gymnastId, setGymnastId] = useState('')
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [report, setReport] = useState<Report | null>(null)
  const [activeEvent, setActiveEvent] = useState<EventName>('Vault')
  const [savedFlag, setSavedFlag] = useState('Saved')
  const [addSkillInput, setAddSkillInput] = useState<Record<EventName, string>>(emptyEventValues)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const queryGymnastId = query.get('gymnastId')
    const queryMonth = query.get('month')
    const rawQueryEvent = query.get('event')
    const queryEvent = (rawQueryEvent === 'Behavior' ? 'Coachability' : rawQueryEvent) as EventName | null
    if (queryGymnastId) setGymnastId(queryGymnastId)
    if (queryMonth) setMonth(queryMonth)
    if (queryEvent && EVENTS.includes(queryEvent)) setActiveEvent(queryEvent)
  }, [])

  useEffect(() => {
    if (!data || !gymnastId) return
    const selectedGymnast = data.gymnasts.find((item) => item.id === gymnastId)
    const existing = data.reports.find((item) => item.gymnastId === gymnastId && item.month === month)
    if (existing) {
      setReport(normalizeReportForCurrentEvents(existing, data.coachName))
      setSavedFlag('Saved')
      return
    }

    const baseEventReports = EVENTS.reduce((acc, event) => {
      acc[event] = buildEmptyEventReport(event, data.coachName)
      return acc
    }, {} as Report['eventReports'])

    setReport({
      id: uid(),
      gymnastId,
      month,
      readiness: 'draft',
      eventReports: baseEventReports,
      behavior: { effort: 3, coachability: 3, focus: 3, respect: 3, comments: '' },
      goals: [{ id: uid(), goal: '', progressNote: '' }],
      projectedLevel: { level: selectedGymnast?.level || '', notes: '' },
      attendance: '',
      injuries: '',
      reminders: '',
      generalNotes: '',
      pdfHistory: [],
      sendHistory: [],
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: data.coachName,
    })
    setSavedFlag('Saving...')
  }, [data, gymnastId, month])

  useEffect(() => {
    if (!report || !data) return
    const timer = setTimeout(async () => {
      const nextData = {
        ...data,
        reports: data.reports.some((item) => item.id === report.id)
          ? data.reports.map((item) => (item.id === report.id ? report : item))
          : [report, ...data.reports],
      }
      try {
        await save(nextData)
        setSavedFlag('Saved')
      } catch {
        toast('Autosave failed')
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [report, data, save, toast])

  const currentGymnast = data?.gymnasts.find((item) => item.id === gymnastId)

  const updateReport = (updater: (current: Report) => Report) => {
    setReport((current) => {
      if (!current || !data) return current
      setSavedFlag('Saving...')
      return {
        ...updater(current),
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: data.coachName,
      }
    })
  }

  const requiredStepOneComplete = Boolean(gymnastId && month)

  const requiredStepTwoComplete = useMemo(() => {
    if (!report) return false
    return EVENTS.every((event) => Boolean(report.eventReports[event].isComplete ?? (report.readiness === 'ready')))
  }, [report])

  const completedEvents = useMemo(() => {
    if (!report) return 0
    return EVENTS.filter((event) => report.eventReports[event].isComplete ?? (report.readiness === 'ready')).length
  }, [report])

  const levelSkillLibrary = useMemo(() => {
    const level = currentGymnast?.level
    if (!level) return DEFAULT_EVENT_SKILL_LIBRARY
    const perLevel = LEVEL_SKILL_LIBRARY[level]
    if (!perLevel) return DEFAULT_EVENT_SKILL_LIBRARY

    return {
      ...DEFAULT_EVENT_SKILL_LIBRARY,
      ...perLevel,
    } as Record<EventName, string[]>
  }, [currentGymnast?.level])

  const availableSuggestedSkills = useMemo(() => {
    if (!report) return []
    const existing = new Set(report.eventReports[activeEvent].skills.map((skill) => skill.name.trim().toLowerCase()))
    return levelSkillLibrary[activeEvent].filter((skill) => !existing.has(skill.toLowerCase()))
  }, [report, activeEvent, levelSkillLibrary])

  const addSkillToActiveEvent = (skillName: string) => {
    if (activeEvent === 'Coachability') return
    const normalized = skillName.trim()
    if (!normalized) return
    if (!report) return

    const alreadyExists = report.eventReports[activeEvent].skills.some(
      (skill) => skill.name.trim().toLowerCase() === normalized.toLowerCase(),
    )
    if (alreadyExists) {
      toast('That skill is already added for this event')
      return
    }

    updateReport((current) => ({
      ...current,
      eventReports: {
        ...current.eventReports,
        [activeEvent]: {
          ...current.eventReports[activeEvent],
          skills: [...current.eventReports[activeEvent].skills, { name: normalized, status: 'Not Started', notes: '' }],
        },
      },
    }))

    setAddSkillInput((current) => ({ ...current, [activeEvent]: '' }))
  }

  const removeSkillFromActiveEvent = (skillName: string) => {
    if (activeEvent === 'Coachability') return
    updateReport((current) => ({
      ...current,
      eventReports: {
        ...current.eventReports,
        [activeEvent]: {
          ...current.eventReports[activeEvent],
          skills: current.eventReports[activeEvent].skills.filter((skill) => skill.name !== skillName),
        },
      },
    }))
  }

  if (loading || !data) return <p>Loading...</p>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Report Builder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted">Primary task: complete one report in 4 clear steps.</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant={step === 1 ? 'default' : 'secondary'}>Step 1: Select</Badge>
            <Badge variant={step === 2 ? 'default' : 'secondary'}>Step 2: Fill Events</Badge>
            <Badge variant={step === 3 ? 'default' : 'secondary'}>Step 3: Monthly Summary</Badge>
            <Badge variant={step === 4 ? 'default' : 'secondary'}>Step 4: Review & Send</Badge>
            <Badge variant="secondary">{savedFlag}</Badge>
          </div>
        </CardContent>
      </Card>

      {step === 1 ? (
        <Card>
          <CardHeader><CardTitle>Step 1: Select Gymnast and Month</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="mb-1 text-sm">Gymnast <span className="text-primary">* Required</span></p>
              <Select value={gymnastId} onValueChange={setGymnastId}>
                <SelectTrigger><SelectValue placeholder="Select gymnast" /></SelectTrigger>
                <SelectContent>
                  {data.gymnasts.map((gymnast) => (
                    <SelectItem key={gymnast.id} value={gymnast.id}>{gymnast.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-sm">Month <span className="text-primary">* Required</span></p>
              <Input
                type="month"
                value={month}
                onClick={(event) => (event.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
                onChange={(event) => setMonth(event.target.value)}
              />
            </div>
            <Button disabled={!requiredStepOneComplete} onClick={() => setStep(2)}>Next: Fill Events</Button>
            {!requiredStepOneComplete ? <p className="text-sm text-muted">Select required fields to continue.</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 2 && report ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Step 2: Fill Events (One at a time)</CardTitle>
            <div className="flex gap-2">
              <Badge variant="secondary">{activeEvent}</Badge>
              <Badge variant={completedEvents === EVENTS.length ? 'success' : 'warning'}>
                {completedEvents}/{EVENTS.length} complete
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeEvent} onValueChange={(value) => setActiveEvent(value as EventName)}>
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-bg p-1">
                {EVENTS.map((event) => {
                  const isComplete = report.eventReports[event].isComplete ?? (report.readiness === 'ready')
                  return (
                    <TabsTrigger key={event} value={event} className="h-8 gap-2 px-2 py-1 text-xs">
                      <span>{event}</span>
                      <span className={isComplete ? 'text-green-700' : 'text-amber-700'}>{isComplete ? 'Done' : 'Open'}</span>
                    </TabsTrigger>
                  )
                })}
              </TabsList>

              <TabsContent value={activeEvent} className="space-y-3">
                <div className="flex items-start justify-between gap-3 border-b border-border pb-2">
                  <div>
                    <p className="text-base font-semibold tracking-wide">{activeEvent}</p>
                    <p className="text-xs text-muted">{activeEvent === 'Coachability' ? 'Coachability fields and ratings' : 'Event skill editing'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={(report.eventReports[activeEvent].isComplete ?? (report.readiness === 'ready')) ? 'success' : 'warning'}>
                      {(report.eventReports[activeEvent].isComplete ?? (report.readiness === 'ready')) ? 'Complete' : 'Open'}
                    </Badge>
                    <Button
                      size="sm"
                      variant={(report.eventReports[activeEvent].isComplete ?? (report.readiness === 'ready')) ? 'secondary' : 'default'}
                      onClick={() =>
                        updateReport((current) => {
                          const currentEvent = current.eventReports[activeEvent]
                          const isCurrentlyComplete = currentEvent.isComplete ?? (current.readiness === 'ready')
                          const nextComplete = !isCurrentlyComplete
                          return {
                            ...current,
                            eventReports: {
                              ...current.eventReports,
                              [activeEvent]: {
                                ...currentEvent,
                                isComplete: nextComplete,
                                completedAt: nextComplete ? new Date().toISOString() : undefined,
                                completedBy: nextComplete ? data.coachName : undefined,
                              },
                            },
                          }
                        })
                      }
                    >
                      {(report.eventReports[activeEvent].isComplete ?? (report.readiness === 'ready')) ? 'Mark Incomplete' : 'Mark Event Complete'}
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-sm font-semibold">Add Skill</p>
                  {OPTIONAL_SKILL_EVENTS.includes(activeEvent) ? (
                    <p className="mb-2 text-sm text-muted">Skills are optional for this event. Add only if you want to track them.</p>
                  ) : null}
                  {activeEvent === 'Coachability' ? (
                    <p className="text-sm text-muted">Respect, Work Ethic, and Training Habits are required coachability fields and use a 1-5 rating scale.</p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                      <div>
                        <Input
                          placeholder="Search or add skill..."
                          value={addSkillInput[activeEvent]}
                          onChange={(event) => setAddSkillInput((current) => ({ ...current, [activeEvent]: event.target.value }))}
                          list={`skill-suggestions-${activeEvent}`}
                        />
                        <datalist id={`skill-suggestions-${activeEvent}`}>
                          {availableSuggestedSkills.map((skill) => (
                            <option key={skill} value={skill} />
                          ))}
                        </datalist>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!addSkillInput[activeEvent].trim()}
                        onClick={() => addSkillToActiveEvent(addSkillInput[activeEvent])}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-sm font-semibold">Skills</p>
                </div>

                {!report.eventReports[activeEvent].skills.length ? (
                  <p className="text-sm text-muted">No skills added for this event yet. Select or add one above to begin.</p>
                ) : null}

                {report.eventReports[activeEvent].skills.map((skill) => (
                  <div key={skill.name} className="rounded-xl border border-border bg-bg p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{skill.name}</p>
                      {activeEvent !== 'Coachability' ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeSkillFromActiveEvent(skill.name)}>
                          Remove Skill
                        </Button>
                      ) : null}
                    </div>

                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Status</p>
                    <div className="flex flex-wrap gap-1">
                        {(activeEvent === 'Coachability' ? COACHABILITY_STATUSES : SKILL_STATUSES).map((status) => (
                          <button
                            key={status}
                            onClick={() =>
                              updateReport((current) => ({
                                ...current,
                                eventReports: {
                                  ...current.eventReports,
                                  [activeEvent]: {
                                    ...current.eventReports[activeEvent],
                                    skills: current.eventReports[activeEvent].skills.map((item) =>
                                      item.name === skill.name ? { ...item, status } : item,
                                    ),
                                  },
                                },
                              }))
                            }
                            className={status === skill.status ? 'rounded-full border border-primary bg-primary/15 px-2 py-1 text-xs' : 'rounded-full border border-border px-2 py-1 text-xs'}
                          >
                            {status}
                          </button>
                        ))}
                    </div>

                    <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Notes</p>
                    <Input
                      placeholder={activeEvent === 'Coachability' ? `${skill.name} note (optional)` : 'Quick note (optional)'}
                      value={skill.notes || ''}
                      onChange={(event) =>
                        updateReport((current) => ({
                          ...current,
                          eventReports: {
                            ...current.eventReports,
                            [activeEvent]: {
                              ...current.eventReports[activeEvent],
                              skills: current.eventReports[activeEvent].skills.map((item) =>
                                item.name === skill.name ? { ...item, notes: event.target.value } : item,
                              ),
                            },
                          },
                        }))
                      }
                    />
                  </div>
                ))}

                <div>
                  <p className="mb-1 text-sm font-semibold">Event Notes</p>
                  <div className="rounded-xl border border-border bg-bg p-3">
                    <Input
                      placeholder="Event notes (optional)"
                      value={report.eventReports[activeEvent].eventNotes || ''}
                      onChange={(event) =>
                        updateReport((current) => ({
                          ...current,
                          eventReports: {
                            ...current.eventReports,
                            [activeEvent]: { ...current.eventReports[activeEvent], eventNotes: event.target.value },
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => requiredStepTwoComplete ? setStep(3) : toast('Mark each event complete before continuing')}>
                Next: Monthly Summary
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 && report ? (
        <Card>
          <CardHeader><CardTitle>Step 3: Monthly Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border bg-bg p-3">
              <p className="font-medium">Summary</p>
              <p className="text-sm text-muted">Gymnast: {currentGymnast?.name || 'Unknown'} • Month: {formatReportMonth(month)}</p>
            </div>

            <div className="rounded-xl border border-border bg-bg p-3 space-y-4">
              <div>
                <p className="font-medium">Monthly Summary</p>
                <p className="text-sm text-muted">Use short notes. Keep it simple and coach-friendly.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Monthly Summary Notes</p>
                  <Input
                    placeholder="Short monthly summary note"
                    value={report.generalNotes || ''}
                    onChange={(event) => updateReport((current) => ({ ...current, generalNotes: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Attendance</p>
                  <Input
                    placeholder="Attendance summary"
                    value={report.attendance || ''}
                    onChange={(event) => updateReport((current) => ({ ...current, attendance: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Injuries / Health</p>
                  <Input
                    placeholder="Injuries or health notes"
                    value={report.injuries || ''}
                    onChange={(event) => updateReport((current) => ({ ...current, injuries: event.target.value }))}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <p className="text-sm font-medium">Reminders for Family</p>
                  <Input
                    placeholder="Important reminders"
                    value={report.reminders || ''}
                    onChange={(event) => updateReport((current) => ({ ...current, reminders: event.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)}>Next: Review</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 4 && report ? (
        <Card>
          <CardHeader><CardTitle>Step 4: Review + Generate PDF + Send</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border bg-bg p-3">
              <p className="font-medium">Summary</p>
              <p className="text-sm text-muted">Gymnast: {currentGymnast?.name || 'Unknown'} • Month: {formatReportMonth(month)}</p>
            </div>

            <div className="rounded-xl border border-border bg-bg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium">Goals</p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    updateReport((current) => ({
                      ...current,
                      goals: [...current.goals, { id: uid(), goal: '', progressNote: '' }],
                    }))
                  }
                >
                  Add Goal
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Current Projected Level</p>
                  <Select
                    value={report.projectedLevel?.level || ''}
                    onValueChange={(value) =>
                      updateReport((current) => ({
                        ...current,
                        projectedLevel: {
                          ...current.projectedLevel,
                          level: value,
                        },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select projected level" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECTED_LEVEL_OPTIONS.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Projected Level Notes</p>
                  <Input
                    placeholder="Notes about projected level"
                    value={report.projectedLevel?.notes || ''}
                    onChange={(event) =>
                      updateReport((current) => ({
                        ...current,
                        projectedLevel: {
                          ...current.projectedLevel,
                          notes: event.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>

              {report.goals.map((goal) => (
                <div key={goal.id} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <Input
                    placeholder="Goal"
                    value={goal.goal}
                    onChange={(event) =>
                      updateReport((current) => ({
                        ...current,
                        goals: current.goals.map((item) => item.id === goal.id ? { ...item, goal: event.target.value } : item),
                      }))
                    }
                  />
                  <Input
                    placeholder="Progress note"
                    value={goal.progressNote || ''}
                    onChange={(event) =>
                      updateReport((current) => ({
                        ...current,
                        goals: current.goals.map((item) => item.id === goal.id ? { ...item, progressNote: event.target.value } : item),
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      updateReport((current) => ({
                        ...current,
                        goals: current.goals.length > 1 ? current.goals.filter((item) => item.id !== goal.id) : current.goals,
                      }))
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
              <Button variant="secondary" onClick={async () => {
                await openReportPdfPreview(report.id, toast)
              }}>Preview PDF</Button>
              <Button onClick={async () => {
                const response = await fetch(`/api/reports/${report.id}/pdf`, { method: 'POST' })
                if (!response.ok) return toast('PDF generation failed')
                updateReport((current) => ({ ...current, readiness: 'ready' }))
                toast('PDF generated and report marked ready')
              }}>Generate PDF</Button>
              <Button onClick={async () => {
                updateReport((current) => ({
                  ...current,
                  readiness: 'ready',
                  sendHistory: [{ id: uid(), sentAt: new Date().toISOString(), status: 'queued', by: data.coachName }, ...current.sendHistory],
                }))
                toast('Marked ready to send')
              }}>Ready to Send</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ToastRoot open={open} onOpenChange={setOpen} message={message} />
    </div>
  )
}
