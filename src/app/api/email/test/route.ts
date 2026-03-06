import { NextResponse } from 'next/server'
import { readDb } from '../../../../lib/server-db'
import { sendPlainEmail } from '../../../../lib/server-mail'

type TestEmailBody = {
  to?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as TestEmailBody
    const data = await readDb()
    const recipient = (body.to || data.contactEmail || '').trim()

    if (!recipient) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 })
    }

    const timestamp = new Date().toISOString()
    const subject = `NFGC SMTP Test - ${timestamp.slice(0, 16).replace('T', ' ')}`
    const text = [
      'This is a test email from NFGC Family Reports.',
      `Sent by: ${data.coachName}`,
      `Timestamp: ${timestamp}`,
      '',
      'If you received this, SMTP is configured correctly.',
    ].join('\n')

    const html = [
      '<p>This is a test email from <strong>NFGC Family Reports</strong>.</p>',
      `<p>Sent by: ${data.coachName}<br/>Timestamp: ${timestamp}</p>`,
      '<p>If you received this, SMTP is configured correctly.</p>',
    ].join('')

    const result = await sendPlainEmail({
      to: [recipient],
      subject,
      text,
      html,
    })

    if (!result.accepted.length) {
      return NextResponse.json({ error: 'SMTP did not accept recipient' }, { status: 502 })
    }

    return NextResponse.json({ ok: true, messageId: result.messageId, accepted: result.accepted })
  } catch (error) {
    console.error('Test email failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Test email failed' },
      { status: 500 },
    )
  }
}