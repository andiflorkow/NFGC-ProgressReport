import { NextResponse } from 'next/server'
import { readDb, saveReportPdf, writeDb } from '../../../../../lib/server-db'
import { buildReportPdf } from '../../../../../lib/server-pdf'
import { sendReportEmail } from '../../../../../lib/server-mail'
import { formatReportMonth } from '../../../../../lib/utils'

const uid = () => Math.random().toString(36).slice(2, 11)

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

    const recipients = gymnast.guardians
      .map((guardian) => guardian.email.trim())
      .filter(Boolean)

    if (!recipients.length) {
      return NextResponse.json({ error: 'No guardian email recipients found' }, { status: 400 })
    }

    const pdfBytes = await buildReportPdf(report, gymnast, data.contactEmail)
    const month = report.month
    const monthLabel = formatReportMonth(month)
    const pdfId = uid()
    const storedPath = await saveReportPdf({
      pdfId,
      reportId: report.id,
      gymnastId: gymnast.id,
      month,
      pdfBytes,
    })

    const subject = `NFGC Progress Report - ${gymnast.name} - ${monthLabel}`
    const text = [
      `Hello ${gymnast.name} family,`,
      '',
      `Your ${monthLabel} progress report is attached as a PDF.`,
      '',
      `If you have questions, reply to ${data.contactEmail}.`,
      '',
      '- NFGC Coaching Staff',
    ].join('\n')

    const html = [
      `<p>Hello ${gymnast.name} family,</p>`,
      `<p>Your <strong>${monthLabel}</strong> progress report is attached as a PDF.</p>`,
      `<p>If you have questions, reply to ${data.contactEmail}.</p>`,
      `<p>- NFGC Coaching Staff</p>`,
    ].join('')

    const emailResult = await sendReportEmail({
      to: recipients,
      subject,
      text,
      html,
      pdfBytes,
      pdfFileName: `NFGC Progress Report - ${monthLabel}.pdf`,
    })

    if (!emailResult.accepted.length) {
      return NextResponse.json({ error: 'SMTP did not accept any recipients' }, { status: 502 })
    }

    report.pdfHistory = [
      {
        id: pdfId,
        month,
        path: storedPath,
        createdAt: new Date().toISOString(),
      },
      ...report.pdfHistory,
    ]

    report.sendHistory = [
      {
        id: uid(),
        sentAt: new Date().toISOString(),
        status: 'sent',
        by: data.coachName,
      },
      ...report.sendHistory,
    ]

    await writeDb(data)

    return NextResponse.json({
      ok: true,
      messageId: emailResult.messageId,
      accepted: emailResult.accepted,
      rejected: emailResult.rejected,
    })
  } catch (error) {
    console.error('Email send failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Email send failed' },
      { status: 500 },
    )
  }
}