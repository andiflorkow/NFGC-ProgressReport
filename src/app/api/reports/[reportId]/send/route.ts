import { NextResponse } from 'next/server'
import { readDb, saveReportPdf, withDbWriteLock, writeDb } from '../../../../../lib/server-db'
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
      'Hello NFGC family,',
      '',
      `Your ${monthLabel} progress report is attached as a PDF.`,
      '',
      'If you have questions, please reach out to team@nfgymcheer.com.',
      'Please note: this email inbox is not monitored.',
      '',
      '- NFGC Coaching Staff',
    ].join('\n')

    const html = [
      '<p>Hello NFGC family,</p>',
      `<p>Your <strong>${monthLabel}</strong> progress report is attached as a PDF.</p>`,
      '<p>If you have questions, please reach out to team@nfgymcheer.com.</p>',
      '<p><strong style="color:#c1121f;">Please note: this email inbox is not monitored.</strong></p>',
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

    await withDbWriteLock(async () => {
      const fresh = await readDb()
      const freshReport = fresh.reports.find((item) => item.id === reportId)
      if (!freshReport) return

      freshReport.pdfHistory = [
        {
          id: pdfId,
          month,
          path: storedPath,
          createdAt: new Date().toISOString(),
        },
        ...freshReport.pdfHistory,
      ]

      freshReport.sendHistory = [
        {
          id: uid(),
          sentAt: new Date().toISOString(),
          status: 'sent',
          by: fresh.coachName,
        },
        ...freshReport.sendHistory,
      ]

      await writeDb(fresh)
    })

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