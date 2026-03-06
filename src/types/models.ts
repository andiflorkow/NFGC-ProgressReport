export type GymStatus = 'Active' | 'Inactive'
export type SkillStatus = 'Not Started' | 'Working' | 'Consistent' | 'Competition Ready'
export type EventName = 'Vault' | 'Bars' | 'Beam' | 'Floor' | 'Strength/Flexibility' | 'Behavior'

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
