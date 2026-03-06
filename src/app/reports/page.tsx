'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { useToast, ToastRoot } from '../../components/ui/toast'
import { useAppData } from '../../hooks/use-app-data'
import { EventName, Report, SkillStatus } from '../../types/models'
import { formatReportMonth } from '../../lib/utils'

const EVENTS: EventName[] = ['Vault', 'Bars', 'Beam', 'Floor', 'Strength/Flexibility', 'Behavior']
const STATUSES: SkillStatus[] = ['Not Started', 'Working', 'Consistent', 'Competition Ready']
const OPTIONAL_SKILL_EVENTS: EventName[] = ['Strength/Flexibility', 'Behavior']
const BEHAVIOR_METRICS = [
  { key: 'effort', label: 'Effort' },
  { key: 'coachability', label: 'Coachability' },
  { key: 'focus', label: 'Focus' },
  { key: 'respect', label: 'Respect' },
] as const
const DEFAULT_EVENT_SKILL_LIBRARY: Record<EventName, string[]> = {
  Vault: ['Front Handspring', 'Round-Off Entry', 'Handstand Flat Back', 'Block Technique', 'Stick Landing'],
  Bars: ['Pullover', 'Back Hip Circle', 'Cast to Horizontal', 'Kip Drill', 'Dismount Landing'],
  Beam: ['Cartwheel', 'Handstand Hold', 'Leap Series', 'Turn Control', 'Dismount'],
  Floor: ['Round-Off Back Handspring', 'Front Tuck', 'Dance Passage', 'Split Leap', 'Routine Form'],
  'Strength/Flexibility': [],
  Behavior: [],
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

const emptyEventValues = EVENTS.reduce((acc, event) => {
  acc[event] = ''
  return acc
}, {} as Record<EventName, string>)

const uid = () => Math.random().toString(36).slice(2, 11)

export default function ReportsPage() {
  const { data, save, loading } = useAppData()
  const { open, setOpen, message, toast } = useToast()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [gymnastId, setGymnastId] = useState('')
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [report, setReport] = useState<Report | null>(null)
  const [activeEvent, setActiveEvent] = useState<EventName>('Vault')
  const [savedFlag, setSavedFlag] = useState('Saved')
  const [selectedSuggestedSkill, setSelectedSuggestedSkill] = useState<Record<EventName, string>>(emptyEventValues)
  const [customSkillName, setCustomSkillName] = useState<Record<EventName, string>>(emptyEventValues)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const queryGymnastId = query.get('gymnastId')
    const queryMonth = query.get('month')
    const queryEvent = query.get('event') as EventName | null
    if (queryGymnastId) setGymnastId(queryGymnastId)
    if (queryMonth) setMonth(queryMonth)
    if (queryEvent && EVENTS.includes(queryEvent)) setActiveEvent(queryEvent)
  }, [])

  useEffect(() => {
    if (!data || !gymnastId) return
    const existing = data.reports.find((item) => item.gymnastId === gymnastId && item.month === month)
    if (existing) {
      setReport(existing)
      setSavedFlag('Saved')
      return
    }

    const baseEventReports = EVENTS.reduce((acc, event) => {
      acc[event] = {
        event,
        eventNotes: '',
        isComplete: false,
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: data.coachName,
        skills: [],
      }
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

    setSelectedSuggestedSkill((current) => ({ ...current, [activeEvent]: '' }))
    setCustomSkillName((current) => ({ ...current, [activeEvent]: '' }))
  }

  const removeSkillFromActiveEvent = (skillName: string) => {
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

  const setBehaviorScore = (field: 'effort' | 'coachability' | 'focus' | 'respect', value: number) => {
    updateReport((current) => ({
      ...current,
      behavior: {
        ...current.behavior,
        [field]: value,
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
          <p className="text-sm text-muted">Primary task: complete one report in 3 clear steps.</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant={step === 1 ? 'default' : 'secondary'}>Step 1: Select</Badge>
            <Badge variant={step === 2 ? 'default' : 'secondary'}>Step 2: Fill Events</Badge>
            <Badge variant={step === 3 ? 'default' : 'secondary'}>Step 3: Review & Send</Badge>
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
              <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
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
            <div className="grid gap-2 md:grid-cols-3">
              {EVENTS.map((event) => {
                const isComplete = report.eventReports[event].isComplete ?? (report.readiness === 'ready')
                return (
                  <Button
                    key={event}
                    type="button"
                    variant={event === activeEvent ? 'default' : 'secondary'}
                    onClick={() => setActiveEvent(event)}
                    className="justify-between"
                  >
                    <span>{event}</span>
                    <span className="text-xs">{isComplete ? 'Done' : 'Open'}</span>
                  </Button>
                )
              })}
            </div>

            <Accordion type="single" collapsible value={activeEvent} onValueChange={(value) => setActiveEvent((value as EventName) || activeEvent)}>
              <AccordionItem value={activeEvent}>
                <AccordionTrigger>{activeEvent}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <div className="rounded-xl border border-border bg-bg p-3">
                      <p className="mb-2 font-medium">Add skills to {activeEvent}</p>
                      {OPTIONAL_SKILL_EVENTS.includes(activeEvent) ? (
                        <p className="mb-2 text-sm text-muted">Skills are optional for this event. Add only if you want to track them.</p>
                      ) : null}
                      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                        <Select
                          value={selectedSuggestedSkill[activeEvent]}
                          onValueChange={(value) => setSelectedSuggestedSkill((current) => ({ ...current, [activeEvent]: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a suggested skill" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSuggestedSkills.map((skill) => (
                              <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={!selectedSuggestedSkill[activeEvent]}
                          onClick={() => addSkillToActiveEvent(selectedSuggestedSkill[activeEvent])}
                        >
                          Add Selected Skill
                        </Button>
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
                        <Input
                          placeholder="Or type a custom skill"
                          value={customSkillName[activeEvent]}
                          onChange={(event) => setCustomSkillName((current) => ({ ...current, [activeEvent]: event.target.value }))}
                        />
                        <Button type="button" variant="secondary" onClick={() => addSkillToActiveEvent(customSkillName[activeEvent])}>
                          Add Custom Skill
                        </Button>
                      </div>
                    </div>

                    {!report.eventReports[activeEvent].skills.length ? (
                      <p className="text-sm text-muted">No skills added for this event yet. Select or add one above to begin.</p>
                    ) : null}

                    {report.eventReports[activeEvent].skills.map((skill) => (
                      <div key={skill.name} className="rounded-xl border border-border bg-bg p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="font-medium">{skill.name}</p>
                          <Button type="button" size="sm" variant="ghost" onClick={() => removeSkillFromActiveEvent(skill.name)}>
                            Remove
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {STATUSES.map((status) => (
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
                        <Input
                          className="mt-2"
                          placeholder="Quick note (optional)"
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
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-bg p-3">
                      <div>
                        <p className="font-medium">Event completion</p>
                        <p className="text-sm text-muted">
                          {(report.eventReports[activeEvent].isComplete ?? (report.readiness === 'ready'))
                            ? `Completed by ${report.eventReports[activeEvent].completedBy || data.coachName}`
                            : 'Mark this event complete when your review is done.'}
                        </p>
                      </div>
                      <Button
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
                        {(report.eventReports[activeEvent].isComplete ?? (report.readiness === 'ready')) ? 'Mark Incomplete' : 'Mark Complete'}
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => requiredStepTwoComplete ? setStep(3) : toast('Mark each event complete before review')}>
                Next: Review
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 && report ? (
        <Card>
          <CardHeader><CardTitle>Step 3: Review + Generate PDF + Send</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border bg-bg p-3">
              <p className="font-medium">Summary</p>
              <p className="text-sm text-muted">Gymnast: {currentGymnast?.name || 'Unknown'} • Month: {formatReportMonth(month)}</p>
            </div>

            <div className="rounded-xl border border-border bg-bg p-3 space-y-4">
              <div>
                <p className="font-medium">Behavior and Monthly Summary</p>
                <p className="text-sm text-muted">Use quick ratings and short notes. Keep it simple and coach-friendly.</p>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className="text-sm font-medium">Behavior Ratings (1 to 5)</p>
                {BEHAVIOR_METRICS.map((metric) => {
                  const value = report.behavior[metric.key]
                  return (
                    <div key={metric.key} className="flex flex-wrap items-center gap-2">
                      <p className="w-24 text-sm text-muted">{metric.label}</p>
                      <div className="flex flex-wrap gap-1">
                        {[1, 2, 3, 4, 5].map((score) => (
                          <Button
                            key={`${metric.key}-${score}`}
                            type="button"
                            size="sm"
                            variant={value === score ? 'default' : 'secondary'}
                            onClick={() => setBehaviorScore(metric.key, score)}
                          >
                            {score}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Behavior Comments</p>
                  <Input
                    placeholder="Short behavior note"
                    value={report.behavior.comments || ''}
                    onChange={(event) =>
                      updateReport((current) => ({
                        ...current,
                        behavior: { ...current.behavior, comments: event.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">General Notes</p>
                  <Input
                    placeholder="Monthly wrap-up note"
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
              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
              <Button variant="secondary" onClick={async () => {
                const response = await fetch(`/api/reports/${report.id}/pdf`, { method: 'POST' })
                if (!response.ok) return toast('Preview failed. Please try again.')
                const blob = await response.blob()
                window.open(URL.createObjectURL(blob), '_blank')
                toast('PDF preview opened')
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
                toast('Queued for email')
              }}>Send / Queue</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ToastRoot open={open} onOpenChange={setOpen} message={message} />
    </div>
  )
}
