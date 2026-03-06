import { NextResponse } from 'next/server'
import { readDb, readStoredPdf, saveReportPdf, writeDb } from '../../../../../lib/server-db'
import { buildReportPdf } from '../../../../../lib/server-pdf'
import { formatReportMonth } from '../../../../../lib/utils'

const uid = () => Math.random().toString(36).slice(2, 11)

export async function GET(request: Request, context: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await context.params
    const download = new URL(request.url).searchParams.get('download') === '1'
    const data = await readDb()
    const report = data.reports.find((item) => item.id === reportId)
    if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    const latest = report.pdfHistory[0]
    if (!latest) return NextResponse.json({ error: 'No saved PDF found' }, { status: 404 })

    const pdfBytes = await readStoredPdf(latest.path)
    if (!pdfBytes) return NextResponse.json({ error: 'Saved PDF file is missing' }, { status: 404 })

    const fileName = `NFGC Progress Report - ${formatReportMonth(report.month)}.pdf`
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('PDF fetch failed', error)
    return NextResponse.json({ error: 'Could not fetch PDF' }, { status: 500 })
  }
}

export async function POST(_request: Request, context: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await context.params
    const data = await readDb()
    const report = data.reports.find((item) => item.id === reportId)
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const gymnast = data.gymnasts.find((item) => item.id === report.gymnastId)
    if (!gymnast) {
      return NextResponse.json({ error: 'Gymnast not found' }, { status: 404 })
    }

    const pdfBytes = await buildReportPdf(report, gymnast, data.contactEmail)
    const month = report.month
    const pdfId = uid()
    const storedPath = await saveReportPdf({
      pdfId,
      reportId: report.id,
      gymnastId: gymnast.id,
      month,
      pdfBytes,
    })

    report.pdfHistory = [
      {
        id: pdfId,
        month,
        path: storedPath,
        createdAt: new Date().toISOString(),
      },
      ...report.pdfHistory,
    ]

    await writeDb(data)

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="NFGC Progress Report - ${formatReportMonth(month)}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF generation failed', error)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}
