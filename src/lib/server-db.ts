import fs from 'node:fs/promises'
import path from 'node:path'
import { AppData, EventName } from '../types/models'

const DATA_PATH = path.join(process.cwd(), 'data', 'db.json')

const EVENTS: EventName[] = ['Vault', 'Bars', 'Beam', 'Floor', 'Strength/Flexibility', 'Behavior']

const nowIso = () => new Date().toISOString()
const uid = () => Math.random().toString(36).slice(2, 11)

function createDefaultData(): AppData {
  const gymnastId = uid()
  const baseEventReports = EVENTS.reduce(
    (acc, event) => {
      acc[event] = {
        event,
        eventNotes: '',
        isComplete: false,
        lastUpdatedAt: nowIso(),
        lastUpdatedBy: 'Coach Andi',
        skills: [
          { name: `${event} Foundation 1`, status: 'Not Started' },
          { name: `${event} Foundation 2`, status: 'Not Started' },
        ],
      }
      return acc
    },
    {} as AppData['reports'][number]['eventReports'],
  )

  return {
    coachName: 'Coach Andi',
    contactEmail: 'nfgc@example.com',
    darkMode: false,
    gymnasts: [
      {
        id: gymnastId,
        name: 'Sample Gymnast',
        level: '4',
        status: 'Active',
        guardians: [{ id: uid(), email: 'parent@example.com', name: 'Parent One' }],
        notes: '',
        lastUpdatedAt: nowIso(),
        lastUpdatedBy: 'Coach Andi',
      },
    ],
    reports: [
      {
        id: uid(),
        gymnastId,
        month: new Date().toISOString().slice(0, 7),
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
        lastUpdatedAt: nowIso(),
        lastUpdatedBy: 'Coach Andi',
      },
    ],
  }
}

async function ensureDataFile() {
  try {
    await fs.access(DATA_PATH)
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true })
    await fs.writeFile(DATA_PATH, JSON.stringify(createDefaultData(), null, 2), 'utf8')
  }
}

export async function readDb(): Promise<AppData> {
  await ensureDataFile()
  const raw = await fs.readFile(DATA_PATH, 'utf8')
  return JSON.parse(raw) as AppData
}

export async function writeDb(data: AppData): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true })
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8')
}
