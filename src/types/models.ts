export type GymStatus = 'Active' | 'Inactive'
export type SkillStatus =
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | 'Not Started'
  | 'Working'
  | 'Consistent'
  | 'Competition Ready'
  | 'Exceeding Expectations'
  | 'Meeting Expectations'
  | 'Working/Improving'
  | 'Needs Support'
  | 'Needs More Focus'
  | 'Meets Appropriate Level Expectations'
  | 'Exceeds Expectations'
export type EventName = 'Vault' | 'Bars' | 'Beam' | 'Floor' | 'Strength/Flexibility' | 'Coachability'

export interface Guardian {
  id: string
  name?: string
  phone?: string
  email: string
}

export interface Gymnast {
  id: string
  name: string
  level: string
  status: GymStatus
  guardians: Guardian[]
  notes?: string
  lastUpdatedAt: string
  lastUpdatedBy: string
}

export interface SkillProgress {
  name: string
  status: SkillStatus
  notes?: string
}

export interface EventReport {
  event: EventName
  skills: SkillProgress[]
  focusAreas?: FocusAreaItem[]
  eventNotes?: string
  isComplete?: boolean
  completedAt?: string
  completedBy?: string
  lastUpdatedAt: string
  lastUpdatedBy: string
}

export interface GoalItem {
  id: string
  goal: string
  progressNote?: string
}

export interface FocusAreaItem {
  id: string
  title: string
  notes?: string
}

export interface ReportPdfEntry {
  id: string
  month: string
  path: string
  createdAt: string
}

export interface SendHistory {
  id: string
  sentAt: string
  status: 'sent' | 'queued' | 'skipped'
  by: string
}

export interface Report {
  id: string
  gymnastId: string
  month: string
  readiness: 'draft' | 'ready'
  eventReports: Record<EventName, EventReport>
  behavior: {
    effort: number
    coachability: number
    focus: number
    respect: number
    comments?: string
  }
  goals: GoalItem[]
  focusAreas?: FocusAreaItem[]
  projectedLevel?: {
    level?: string
    notes?: string
  }
  attendance?: string
  injuries?: string
  reminders?: string
  generalNotes?: string
  pdfHistory: ReportPdfEntry[]
  sendHistory: SendHistory[]
  lastUpdatedAt: string
  lastUpdatedBy: string
}

export interface AppData {
  coachName: string
  contactEmail: string
  darkMode: boolean
  gymnasts: Gymnast[]
  reports: Report[]
}
