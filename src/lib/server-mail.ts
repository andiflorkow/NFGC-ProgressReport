import nodemailer from 'nodemailer'

type MailConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

function getEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function getMailConfig(): MailConfig {
  const host = getEnv('SMTP_HOST')
  const portRaw = getEnv('SMTP_PORT')
  const user = getEnv('SMTP_USER')
  const pass = getEnv('SMTP_PASS')
  const from = process.env.SMTP_FROM?.trim() || user
  const secure = (process.env.SMTP_SECURE || '').trim().toLowerCase() === 'true'

  const port = Number(portRaw)
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('SMTP_PORT must be a valid positive number')
  }

  return { host, port, secure, user, pass, from }
}

export async function sendReportEmail(args: {
  to: string[]
  subject: string
  text: string
  html: string
  pdfBytes: Uint8Array
  pdfFileName: string
}) {
  const config = getMailConfig()
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })

  const info = await transport.sendMail({
    from: config.from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
    attachments: [
      {
        filename: args.pdfFileName,
        content: Buffer.from(args.pdfBytes),
        contentType: 'application/pdf',
      },
    ],
  })

  return {
    messageId: info.messageId,
    accepted: info.accepted.map(String),
    rejected: info.rejected.map(String),
  }
}

export async function sendPlainEmail(args: {
  to: string[]
  subject: string
  text: string
  html: string
}) {
  const config = getMailConfig()
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })

  const info = await transport.sendMail({
    from: config.from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
  })

  return {
    messageId: info.messageId,
    accepted: info.accepted.map(String),
    rejected: info.rejected.map(String),
  }
}