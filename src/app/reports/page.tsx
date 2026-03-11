'use client'

import { useEffect, useMemo, useState } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { ToastRoot, useToast } from '../../components/ui/toast'
import { useAppData } from '../../hooks/use-app-data'
import { openReportPdfPreview } from '../../lib/pdf-preview'
import { formatReportMonth } from '../../lib/utils'
import { EventName, Report, SkillStatus } from '../../types/models'

const EVENTS: EventName[] = ['Vault', 'Bars', 'Beam', 'Floor', 'Strength/Flexibility', 'Coachability']
const STEPS = [1, 2, 3, 4] as const
const SKILL_STATUSES: SkillStatus[] = ['Not Started', 'Working', 'Consistent', 'Competition Ready']
const COACHABILITY_STATUSES: SkillStatus[] = ['1', '2', '3', '4', '5']
const COACHABILITY_FIELDS = ['Respect', 'Work Ethic', 'Training Habits'] as const
const OPTIONAL_SKILL_EVENTS: EventName[] = ['Strength/Flexibility']
const FOCUS_AREA_DISABLED_EVENTS: EventName[] = ['Strength/Flexibility', 'Coachability']
const DEFAULT_EVENT_SKILL_LIBRARY: Record<EventName, string[]> = {
  Vault: ['Front Handspring', 'Round-Off Entry', 'Handstand Flat Back', 'Block Technique', 'Stick Landing'],
  Bars: ['Pullover', 'Back Hip Circle', 'Cast to Horizontal', 'Kip Drill', 'Dismount Landing'],
  Beam: ['Cartwheel', 'Handstand Hold', 'Leap Series', 'Turn Control', 'Dismount'],
  Floor: ['Round-Off Back Handspring', 'Front Tuck', 'Dance Passage', 'Split Leap', 'Routine Form'],
  'Strength/Flexibility': [],
  Coachability: [],
}
const FOCUS_AREA_LIBRARY = ['Form', 'Strength', 'Presentation', 'Confidence', 'Consistency', 'Flexibility']

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

const uid = () => Math.random().toString(36).slice(2, 11)

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
  focusAreas: [],
  isComplete: false,
  lastUpdatedAt: new Date().toISOString(),
  lastUpdatedBy: coachName,
  skills: event === 'Coachability' ? buildCoachabilitySkills() : [],
})

const normalizeReportForCurrentEvents = (report: Report, coachName: string, gymnastLevel = ''): Report => {
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
                  if (!existing) return { name: fieldName, status: '3' as SkillStatus, notes: '' }
                  return { ...existing, status: normalizeCoachabilityStatus(existing.status) }
                })
              : current.skills,
        }
      : fallback
    return acc
  }, {} as Report['eventReports'])

  return {
    ...report,
    eventReports: nextEventReports,
    goals: report.goals?.length ? report.goals : [{ id: uid(), goal: '', progressNote: '' }],
    projectedLevel: report.projectedLevel ?? { level: gymnastLevel, notes: '' },
  }
}

const hasGoalContent = (report: Report) =>
  Boolean(
    report.projectedLevel?.level?.trim() ||
      report.projectedLevel?.notes?.trim() ||
      report.goals.some((goal) => goal.goal.trim() || goal.progressNote?.trim()),
  )

const hasAdditionalNotes = (report: Report) =>
  Boolean(report.attendance?.trim() || report.injuries?.trim() || report.reminders?.trim())

const formatEventQuickBreakdown = (eventReport: Report['eventReports'][EventName]) => {
  const lines: string[] = []
  if (eventReport.eventNotes?.trim()) lines.push(eventReport.eventNotes.trim())
  if ((eventReport.focusAreas ?? []).length) {
    lines.push(...(eventReport.focusAreas ?? []).map((item) => `Focus: ${item.title}${item.notes?.trim() ? ` | ${item.notes.trim()}` : ''}`))
  }
  if (eventReport.skills.length) {
    lines.push(...eventReport.skills.map((skill) => `${skill.name}: ${skill.status}${skill.notes?.trim() ? ` | ${skill.notes.trim()}` : ''}`))
  }
  return lines
}

const hasEventDisplayContent = (eventReport: Report['eventReports'][EventName], event: EventName) => {
  const hasNotes = Boolean(eventReport.eventNotes?.trim())
  const hasSkills = eventReport.skills.length > 0
  const hasFocus = FOCUS_AREA_DISABLED_EVENTS.includes(event)
    ? false
    : Boolean((eventReport.focusAreas ?? []).some((item) => item.title.trim() || item.notes?.trim()))
  return hasNotes || hasSkills || hasFocus
}

export default function ReportsPage() {
  const { data, save, loading, reload } = useAppData()
  const { open, setOpen, message, toast } = useToast()

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [gymnastId, setGymnastId] = useState('')
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [report, setReport] = useState<Report | null>(null)
  const [activeEvent, setActiveEvent] = useState<EventName>('Vault')
  const [savedFlag, setSavedFlag] = useState('Saved')
  const [addSkillInput, setAddSkillInput] = useState<Record<EventName, string>>(emptyEventValues)
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false)
  const [focusAreaInput, setFocusAreaInput] = useState<Record<EventName, string>>(emptyEventValues)
  const [showFocusAreaSuggestions, setShowFocusAreaSuggestions] = useState(false)

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

  const currentGymnast = data?.gymnasts.find((item) => item.id === gymnastId)

  useEffect(() => {
    if (!data || !gymnastId) return
    const selectedGymnast = data.gymnasts.find((item) => item.id === gymnastId)
    const existing = data.reports.find((item) => item.gymnastId === gymnastId && item.month === month)
    if (existing) {
      setReport(normalizeReportForCurrentEvents(existing, data.coachName, selectedGymnast?.level || ''))
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
  const completedEvents = useMemo(() => {
    if (!report) return 0
    return EVENTS.filter((event) => report.eventReports[event].isComplete).length
  }, [report])

  const levelSkillLibrary = useMemo(() => {
    const level = currentGymnast?.level
    if (!level) return DEFAULT_EVENT_SKILL_LIBRARY
    const perLevel = LEVEL_SKILL_LIBRARY[level]
    if (!perLevel) return DEFAULT_EVENT_SKILL_LIBRARY
    return { ...DEFAULT_EVENT_SKILL_LIBRARY, ...perLevel } as Record<EventName, string[]>
  }, [currentGymnast?.level])

  const availableSuggestedSkills = useMemo(() => {
    if (!report) return []
    const existing = new Set(report.eventReports[activeEvent].skills.map((skill) => skill.name.trim().toLowerCase()))
    return levelSkillLibrary[activeEvent].filter((skill) => !existing.has(skill.toLowerCase()))
  }, [report, activeEvent, levelSkillLibrary])

  const availableFocusAreas = useMemo(() => {
    if (!report) return FOCUS_AREA_LIBRARY
    const existing = new Set((report.eventReports[activeEvent].focusAreas ?? []).map((item) => item.title.trim().toLowerCase()))
    return FOCUS_AREA_LIBRARY.filter((item) => !existing.has(item.toLowerCase()))
  }, [report, activeEvent])

  const currentEventIsComplete = Boolean(report?.eventReports[activeEvent].isComplete)
  const eventNotesLabel = activeEvent === 'Strength/Flexibility' || activeEvent === 'Coachability' ? 'Notes' : 'Event Notes'
  const stepSummaryText = currentGymnast
    ? `${currentGymnast.name} • Level ${currentGymnast.level} • ${formatReportMonth(month)}`
    : 'Select a gymnast and month to begin.'

  const addSkillToActiveEvent = (skillName: string) => {
    if (activeEvent === 'Coachability') return
    const normalized = skillName.trim()
    if (!normalized || !report) return
    const alreadyExists = report.eventReports[activeEvent].skills.some(
      (skill) => skill.name.trim().toLowerCase() === normalized.toLowerCase(),
    )
    if (alreadyExists) return toast('That skill is already added for this event')

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

  const addFocusAreaToActiveEvent = (title: string) => {
    const normalized = title.trim()
    if (!normalized || !report) return
    const alreadyExists = (report.eventReports[activeEvent].focusAreas ?? []).some(
      (item) => item.title.trim().toLowerCase() === normalized.toLowerCase(),
    )
    if (alreadyExists) return toast('That focus area is already added')

    updateReport((current) => ({
      ...current,
      eventReports: {
        ...current.eventReports,
        [activeEvent]: {
          ...current.eventReports[activeEvent],
          focusAreas: [...(current.eventReports[activeEvent].focusAreas ?? []), { id: uid(), title: normalized, notes: '' }],
        },
      },
    }))
    setFocusAreaInput((current) => ({ ...current, [activeEvent]: '' }))
  }

  const toggleActiveEventComplete = () => {
    updateReport((current) => {
      const currentEvent = current.eventReports[activeEvent]
      const nextComplete = !currentEvent.isComplete
      if (nextComplete && !hasEventDisplayContent(currentEvent, activeEvent)) {
        toast('Add at least one item that appears on the PDF before marking this event complete')
        return current
      }
      return {
        ...current,
        eventReports: {
          ...current.eventReports,
          [activeEvent]: {
            ...currentEvent,
            isComplete: nextComplete,
            completedAt: nextComplete ? new Date().toISOString() : undefined,
            completedBy: nextComplete ? data?.coachName : undefined,
          },
        },
      }
    })
  }

  const markAllEventsComplete = () => {
    updateReport((current) => {
      const blockedEvents = EVENTS.filter((event) => !hasEventDisplayContent(current.eventReports[event], event))
      const nextEventReports = EVENTS.reduce((acc, event) => {
        const canComplete = !blockedEvents.includes(event)
        acc[event] = {
          ...current.eventReports[event],
          isComplete: canComplete,
          completedAt: canComplete ? current.eventReports[event].completedAt || new Date().toISOString() : undefined,
          completedBy: canComplete ? current.eventReports[event].completedBy || data?.coachName : undefined,
        }
        return acc
      }, {} as Report['eventReports'])

      if (blockedEvents.length) {
        toast(`These events need display content first: ${blockedEvents.join(', ')}`)
      } else {
        toast('All events marked complete')
      }

      return {
        ...current,
        eventReports: nextEventReports,
      }
    })
  }

  const handlePreviewPdf = async () => {
    if (!report) return
    const opened = await openReportPdfPreview(report.id, toast)
    if (opened) await reload()
  }

  const goToStep = (targetStep: 1 | 2 | 3 | 4) => {
    if (targetStep > 1 && !requiredStepOneComplete) {
      toast('Select gymnast and month first')
      return
    }
    setStep(targetStep)
  }

  if (loading || !data) return <p>Loading...</p>

  const summarySections = report
    ? [
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
          onEdit: () => setStep(3),
        },
        {
          key: 'monthly-summary',
          title: 'Monthly Summary Notes',
          complete: Boolean(report.generalNotes?.trim()),
          lines: report.generalNotes?.trim() ? [report.generalNotes.trim()] : [],
          onEdit: () => setStep(3),
        },
        {
          key: 'additional-notes',
          title: 'Additional Notes',
          complete: hasAdditionalNotes(report),
          lines: [
            ...(report.attendance?.trim() ? [`Attendance: ${report.attendance.trim()}`] : []),
            ...(report.injuries?.trim() ? [`Injuries / Health: ${report.injuries.trim()}`] : []),
            ...(report.reminders?.trim() ? [`Reminders: ${report.reminders.trim()}`] : []),
          ],
          onEdit: () => setStep(3),
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle>Report Builder</CardTitle>
            <p className="text-sm text-muted">{stepSummaryText}</p>
          </div>
          <p className="text-xs text-muted">{savedFlag}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted">Primary task: complete one report in 4 clear steps.</p>
          <div className="flex flex-wrap gap-2">
            {STEPS.map((stepNumber) => (
              <Button
                key={stepNumber}
                type="button"
                size="sm"
                variant={step === stepNumber ? 'default' : 'secondary'}
                onClick={() => goToStep(stepNumber)}
                disabled={stepNumber > 1 && !requiredStepOneComplete}
              >
                {stepNumber === 1 ? 'Step 1: Select' : null}
                {stepNumber === 2 ? 'Step 2: Skill Progress' : null}
                {stepNumber === 3 ? 'Step 3: Monthly Summary' : null}
                {stepNumber === 4 ? 'Step 4: Review' : null}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Select Gymnast and Month</CardTitle>
          </CardHeader>
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
            <Button disabled={!requiredStepOneComplete} onClick={() => setStep(2)}>Next: Skill Progress</Button>
            {!requiredStepOneComplete ? <p className="text-sm text-muted">Select required fields to continue.</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 2 && report ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Step 2: Skill Progress</CardTitle>
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
                  const isComplete = Boolean(report.eventReports[event].isComplete)
                  return (
                    <TabsTrigger key={event} value={event} className="h-8 gap-2 px-2 py-1 text-xs">
                      <span>{event}</span>
                      <span className={isComplete ? 'text-green-700' : 'text-muted'}>{isComplete ? '✓' : ''}</span>
                    </TabsTrigger>
                  )
                })}
              </TabsList>

              <TabsContent value={activeEvent} className="space-y-3">
                <div className="flex items-start justify-between gap-3 border-b border-border pb-2">
                  <div>
                    <p className="text-base font-semibold tracking-wide">{activeEvent}</p>
                    <p className="text-xs text-muted">
                      {activeEvent === 'Coachability'
                        ? 'Rate the required coachability fields and add quick notes if needed.'
                        : 'Track the most relevant skills and a short note for this event.'}
                    </p>
                  </div>
                  <Badge variant={currentEventIsComplete ? 'success' : 'warning'}>
                    {currentEventIsComplete ? 'Complete' : 'Open'}
                  </Badge>
                </div>

                {activeEvent !== 'Coachability' ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Add Skill</p>
                    {OPTIONAL_SKILL_EVENTS.includes(activeEvent) ? (
                      <p className="text-sm text-muted">Skills are optional here. Add only what you want to track.</p>
                    ) : null}
                    <div className="grid max-w-lg gap-2 md:grid-cols-[minmax(0,20rem)_auto]">
                      <div className="relative">
                        <Input
                          placeholder="Search or add skill..."
                          value={addSkillInput[activeEvent]}
                          onChange={(event) => setAddSkillInput((current) => ({ ...current, [activeEvent]: event.target.value }))}
                          onFocus={() => setShowSkillSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSkillSuggestions(false), 120)}
                        />
                        {showSkillSuggestions ? (
                          <div className="absolute z-10 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-border bg-surface shadow-md">
                            {availableSuggestedSkills
                              .filter((skill) => skill.toLowerCase().includes(addSkillInput[activeEvent].toLowerCase().trim()))
                              .map((skill) => (
                                <button
                                  key={skill}
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-bg"
                                  onMouseDown={(event) => {
                                    event.preventDefault()
                                    setAddSkillInput((current) => ({ ...current, [activeEvent]: skill }))
                                  }}
                                >
                                  {skill}
                                </button>
                              ))}
                          </div>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-10"
                        disabled={!addSkillInput[activeEvent].trim()}
                        onClick={() => addSkillToActiveEvent(addSkillInput[activeEvent])}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="mb-1 text-sm font-semibold">{eventNotesLabel}</p>
                  <textarea
                    className="min-h-[74px] w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
                    placeholder="Optional note"
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

                {!FOCUS_AREA_DISABLED_EVENTS.includes(activeEvent) ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Focus Areas</p>
                    <div className="grid max-w-lg gap-2 md:grid-cols-[minmax(0,20rem)_auto]">
                      <div className="relative">
                        <Input
                          placeholder="Search or add focus area..."
                          value={focusAreaInput[activeEvent]}
                          onChange={(event) => setFocusAreaInput((current) => ({ ...current, [activeEvent]: event.target.value }))}
                          onFocus={() => setShowFocusAreaSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowFocusAreaSuggestions(false), 120)}
                        />
                        {showFocusAreaSuggestions ? (
                          <div className="absolute z-10 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-border bg-surface shadow-md">
                            {availableFocusAreas
                              .filter((item) => item.toLowerCase().includes(focusAreaInput[activeEvent].toLowerCase().trim()))
                              .map((item) => (
                                <button
                                  key={item}
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-bg"
                                  onMouseDown={(event) => {
                                    event.preventDefault()
                                    setFocusAreaInput((current) => ({ ...current, [activeEvent]: item }))
                                  }}
                                >
                                  {item}
                                </button>
                              ))}
                          </div>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-10"
                        disabled={!focusAreaInput[activeEvent].trim()}
                        onClick={() => addFocusAreaToActiveEvent(focusAreaInput[activeEvent])}
                      >
                        Add
                      </Button>
                    </div>

                    {(report.eventReports[activeEvent].focusAreas ?? []).length ? (
                      <div className="space-y-2">
                        {(report.eventReports[activeEvent].focusAreas ?? []).map((focusArea) => (
                          <div key={focusArea.id} className="rounded-xl border border-border bg-bg p-2.5">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold">{focusArea.title}</p>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  updateReport((current) => ({
                                    ...current,
                                    eventReports: {
                                      ...current.eventReports,
                                      [activeEvent]: {
                                        ...current.eventReports[activeEvent],
                                        focusAreas: (current.eventReports[activeEvent].focusAreas ?? []).filter(
                                          (item) => item.id !== focusArea.id,
                                        ),
                                      },
                                    },
                                  }))
                                }
                              >
                                Remove
                              </Button>
                            </div>
                            <textarea
                              className="min-h-[62px] w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
                              placeholder="Brief focus description (optional)"
                              value={focusArea.notes || ''}
                              onChange={(event) =>
                                updateReport((current) => ({
                                  ...current,
                                  eventReports: {
                                    ...current.eventReports,
                                    [activeEvent]: {
                                      ...current.eventReports[activeEvent],
                                      focusAreas: (current.eventReports[activeEvent].focusAreas ?? []).map((item) =>
                                        item.id === focusArea.id ? { ...item, notes: event.target.value } : item,
                                      ),
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted">No focus areas added for this event yet.</p>
                    )}
                  </div>
                ) : null}

                <div>
                  <p className="mb-1 text-sm font-semibold">Skill Progress</p>
                </div>

                {!report.eventReports[activeEvent].skills.length ? (
                  <p className="text-sm text-muted">
                    {activeEvent === 'Coachability'
                      ? 'Coachability ratings are set up automatically.'
                      : 'No skills added for this event yet. Add one above to begin.'}
                  </p>
                ) : null}

                {report.eventReports[activeEvent].skills.map((skill) => (
                  <div key={skill.name} className="rounded-xl border border-border bg-bg p-2.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{skill.name}</p>
                      {activeEvent !== 'Coachability' ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeSkillFromActiveEvent(skill.name)}>
                          Remove
                        </Button>
                      ) : null}
                    </div>

                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Status</p>
                    <div className="flex flex-wrap gap-1">
                      {(activeEvent === 'Coachability' ? COACHABILITY_STATUSES : SKILL_STATUSES).map((status) => (
                        <button
                          key={status}
                          type="button"
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
                          className={
                            status === skill.status
                              ? 'rounded-full border border-primary bg-primary/15 px-2 py-1 text-xs'
                              : 'rounded-full border border-border px-2 py-1 text-xs'
                          }
                        >
                          {status}
                        </button>
                      ))}
                    </div>

                    <p className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wide text-muted">Notes</p>
                    <textarea
                      className="min-h-[56px] w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
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
              </TabsContent>
            </Tabs>

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={toggleActiveEventComplete}>
                  {currentEventIsComplete ? 'Mark Incomplete' : 'Mark Complete'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const currentIndex = EVENTS.indexOf(activeEvent)
                    const hasNextEvent = currentIndex >= 0 && currentIndex < EVENTS.length - 1
                    if (hasNextEvent) {
                      setActiveEvent(EVENTS[currentIndex + 1])
                      return
                    }
                    setStep(3)
                  }}
                >
                  Save & Continue
                </Button>
                <Button onClick={() => setStep(3)}>Next Step</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 && report ? (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Monthly Summary</CardTitle>
            <p className="text-sm text-muted">{formatReportMonth(month)}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="font-medium">Goals</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-border bg-bg p-3">
                  <p className="text-sm font-medium">Current Projected Level</p>
                  <div className="space-y-1">
                    <p className="text-sm text-muted">Projected level</p>
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
                    <p className="text-sm text-muted">Notes</p>
                    <textarea
                      className="min-h-[82px] w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
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

                <div className="space-y-3 rounded-xl border border-border bg-bg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Additional Goals</p>
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
                  <div className="space-y-2">
                    {report.goals.map((goal) => (
                      <div key={goal.id} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                        <Input
                          placeholder="Goal"
                          value={goal.goal}
                          onChange={(event) =>
                            updateReport((current) => ({
                              ...current,
                              goals: current.goals.map((item) =>
                                item.id === goal.id ? { ...item, goal: event.target.value } : item,
                              ),
                            }))
                          }
                        />
                        <Input
                          placeholder="Progress note"
                          value={goal.progressNote || ''}
                          onChange={(event) =>
                            updateReport((current) => ({
                              ...current,
                              goals: current.goals.map((item) =>
                                item.id === goal.id ? { ...item, progressNote: event.target.value } : item,
                              ),
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
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-medium">Monthly Summary Notes</p>
              <div className="rounded-xl border border-border bg-bg p-3">
                <textarea
                  className="min-h-[92px] w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder="Short monthly summary note"
                  value={report.generalNotes || ''}
                  onChange={(event) => updateReport((current) => ({ ...current, generalNotes: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-medium">Additional Notes</p>
              <div className="rounded-xl border border-border bg-bg p-3">
                <div className="grid gap-3 md:grid-cols-2">
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
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Step 4: Review</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
              <Button variant="secondary" onClick={markAllEventsComplete}>Mark All Complete</Button>
              <Button onClick={handlePreviewPdf}>Preview PDF</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-bg p-3">
              <p className="text-sm text-muted">Review each section below, then preview the PDF. Final ready/send happens on the Email Review page.</p>
            </div>

            <Accordion type="multiple" className="space-y-2">
              {EVENTS.map((event) => {
                const eventReport = report.eventReports[event]
                const lines = formatEventQuickBreakdown(eventReport)
                return (
                  <AccordionItem key={event} value={event} className="rounded-xl border border-border bg-bg px-3">
                    <AccordionTrigger>
                      <div className="flex w-full items-center justify-between gap-3 pr-3">
                        <span className="font-medium">{event}</span>
                        <Badge variant={eventReport.isComplete ? 'success' : 'warning'}>
                          {eventReport.isComplete ? 'Complete' : 'Open'}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pb-3">
                      {lines.length ? (
                        <div className="space-y-1 text-sm text-muted">
                          {lines.map((line, index) => (
                            <p key={`${event}-${index}`}>{line}</p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted">No details added yet.</p>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setActiveEvent(event)
                          setStep(2)
                        }}
                      >
                        Edit
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}

              {summarySections.map((section) => (
                <AccordionItem key={section.key} value={section.key} className="rounded-xl border border-border bg-bg px-3">
                  <AccordionTrigger>
                    <div className="flex w-full items-center justify-between gap-3 pr-3">
                      <span className="font-medium">{section.title}</span>
                      <Badge variant={section.complete ? 'success' : 'warning'}>
                        {section.complete ? 'Added' : 'Missing'}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pb-3">
                    {section.lines.length ? (
                      <div className="space-y-1 text-sm text-muted">
                        {section.lines.map((line, index) => (
                          <p key={`${section.key}-${index}`}>{line}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted">Nothing added yet.</p>
                    )}
                    <Button type="button" size="sm" variant="secondary" onClick={section.onEdit}>Edit</Button>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      ) : null}

      <ToastRoot open={open} onOpenChange={setOpen} message={message} />
    </div>
  )
}
