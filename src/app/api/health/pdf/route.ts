import { NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'

export async function GET() {
  try {
    const doc = await PDFDocument.create()
    doc.addPage([200, 100])
    await doc.save()
    return NextResponse.json({ ok: true, message: 'PDF library healthy' })
  } catch (error) {
    console.error('PDF health check failed', error)
    return NextResponse.json({ ok: false, message: 'PDF library failed' }, { status: 500 })
  }
}
