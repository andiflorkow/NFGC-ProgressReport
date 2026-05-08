import { NextResponse } from 'next/server'
import { Gymnast } from '../../../types/models'
import { readDb, withDbWriteLock, writeDb } from '../../../lib/server-db'

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { gymnast?: Gymnast }
    const gymnast = payload?.gymnast

    if (!gymnast) {
      return NextResponse.json({ ok: false, error: 'Gymnast payload is required' }, { status: 400 })
    }

    await withDbWriteLock(async () => {
      const current = await readDb()
      const alreadyExists = current.gymnasts.some((item) => item.id === gymnast.id)

      if (alreadyExists) {
        return
      }

      await writeDb({
        ...current,
        gymnasts: [gymnast, ...current.gymnasts],
      })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Failed to add gymnast', error)
    return NextResponse.json({ ok: false, error: 'Failed to add gymnast' }, { status: 500 })
  }
}
