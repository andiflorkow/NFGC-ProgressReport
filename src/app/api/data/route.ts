import { NextResponse } from 'next/server'
import { readDb, writeDb } from '../../../lib/server-db'
import { AppData } from '../../../types/models'

export async function GET() {
  const data = await readDb()
  return NextResponse.json(data)
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as AppData
    await writeDb(payload)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Failed to save data', error)
    return NextResponse.json({ ok: false, error: 'Failed to save data' }, { status: 500 })
  }
}
