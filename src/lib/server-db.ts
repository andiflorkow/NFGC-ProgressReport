import fs from 'node:fs/promises'
import path from 'node:path'
import { neon } from '@neondatabase/serverless'
import { AppData, EventName } from '../types/models'

const DATA_PATH = path.join(process.cwd(), 'data', 'db.json')
const DATABASE_URL = process.env.DATABASE_URL

const EVENTS: EventName[] = ['Vault', 'Bars', 'Beam', 'Floor', 'Strength/Flexibility', 'Behavior']

const nowIso = () => new Date().toISOString()
const uid = () => Math.random().toString(36).slice(2, 11)

let sqlClient: ReturnType<typeof neon> | null = null

function getSqlClient() {
  if (!DATABASE_URL) {
    return null
  }

  if (!sqlClient) {
    sqlClient = neon(DATABASE_URL)
  }

  return sqlClient
}

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

async function ensureNeonSchema(sql: ReturnType<typeof neon>) {
  await sql`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
}

async function readNeonDb(sql: ReturnType<typeof neon>): Promise<AppData> {
  await ensureNeonSchema(sql)
  const rows = (await sql`SELECT payload FROM app_state WHERE id = 1`) as Array<{ payload: unknown }>

  if (rows.length === 0) {
    const seedData = createDefaultData()
    await writeNeonDb(sql, seedData)
    return seedData
  }

  const payload = rows[0]?.payload
  if (typeof payload === 'string') {
    return JSON.parse(payload) as AppData
  }

  return payload as AppData
}

async function writeNeonDb(sql: ReturnType<typeof neon>, data: AppData): Promise<void> {
  await ensureNeonSchema(sql)
  await sql`
    INSERT INTO app_state (id, payload, updated_at)
    VALUES (1, ${JSON.stringify(data)}::jsonb, NOW())
    ON CONFLICT (id)
    DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
  `
}

export async function readDb(): Promise<AppData> {
  const sql = getSqlClient()
  if (sql) {
    return readNeonDb(sql)
  }

  await ensureDataFile()
  const raw = await fs.readFile(DATA_PATH, 'utf8')
  return JSON.parse(raw) as AppData
}

export async function writeDb(data: AppData): Promise<void> {
  const sql = getSqlClient()
  if (sql) {
    await writeNeonDb(sql, data)
    return
  }

  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true })
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8')
}
