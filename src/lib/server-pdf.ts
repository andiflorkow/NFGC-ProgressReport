import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { Gymnast, Report } from '../types/models'
import { formatReportMonth } from './utils'

export async function buildReportPdf(report: Report, gymnast: Gymnast, contactEmail: string) {
  const pdf = await PDFDocument.create()
  let page = pdf.addPage([595, 842])
  const { width, height } = page.getSize()
  const CORE_EVENTS = ['Vault', 'Bars', 'Beam', 'Floor'] as const

  const normalizeCoachabilityRating = (status?: string) => {
    if (!status) return '3/5'
    if (status === '1' || status === '2' || status === '3' || status === '4' || status === '5') return `${status}/5`
    if (status === 'Exceeding Expectations' || status === 'Competition Ready') return '5/5'
    if (status === 'Meeting Expectations' || status === 'Consistent') return '4/5'
    if (status === 'Working/Improving' || status === 'Working') return '3/5'
    if (status === 'Needs Support') return '2/5'
    if (status === 'Not Started') return '1/5'
    return status
  }

  const drawCentered = (text: string, y: number, size: number, fontRef: any, color = rgb(0, 0, 0)) => {
    const textWidth = fontRef.widthOfTextAtSize(text, size)
    page.drawText(text, { x: (width - textWidth) / 2, y, size, font: fontRef, color })
  }

  const wrapLines = (text: string, maxWidth: number, size: number, fontRef: any) => {
    const words = text.split(/\s+/).filter(Boolean)
    if (!words.length) return ['']
    const lines: string[] = []
    let current = ''

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (fontRef.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate
      } else {
        if (current) {
          lines.push(current)
        }
        current = word
      }
    }
    if (current) lines.push(current)
    return lines
  }

  const drawWrapped = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    size: number,
    lineHeight: number,
    fontRef: any,
  ) => {
    const lines = wrapLines(text, maxWidth, size, fontRef)

    lines.forEach((line, index) => {
      page.drawText(line, { x, y: y - index * lineHeight, size, font: fontRef })
    })

    return y - lines.length * lineHeight
  }

  const formatSkillRows = (skills: Array<{ name: string; status: string; notes?: string }>) => {
    if (!skills.length) return ['• No skills listed']
    return skills.map((skill) => {
      const note = skill.notes?.trim() ? ` | ${skill.notes.trim()}` : ''
      return `• ${skill.name} | ${skill.status}${note}`
    })
  }

  const formatCoachabilityRows = (
    skills: Array<{ name: string; status: string; notes?: string }>,
    eventFeedback?: string,
  ) => {
    const required = ['Respect', 'Work Ethic', 'Training Habits']
    const rows = required.map((name) => {
      const item = skills.find((skill) => skill.name === name)
      if (!item) return `• ${name}: Not rated`
      const rating = normalizeCoachabilityRating(item.status)
      const note = item.notes?.trim() ? ` | ${item.notes.trim()}` : ''
      return `• ${name}: ${rating}${note}`
    })

    if (eventFeedback?.trim()) rows.push(`• ${eventFeedback.trim()}`)
    return rows
  }

  const drawHeader = async () => {
    page.drawRectangle({ x: 0, y: height - 18, width, height: 18, color: rgb(176 / 255, 18 / 255, 18 / 255) })

    const logoPath = path.join(process.cwd(), 'public', 'images', 'nfgc-logo.png')
    try {
      const logoBytes = await fs.readFile(logoPath)
      const image = await pdf.embedPng(logoBytes)
      const targetHeight = 38
      const ratio = image.width / image.height
      const targetWidth = targetHeight * ratio
      page.drawImage(image, {
        x: width - targetWidth - 24,
        y: height - targetHeight - 24,
        width: targetWidth,
        height: targetHeight,
      })
    } catch {
    }
  }
  await drawHeader()

  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const side = 30
  const cardWidth = width - side * 2
  const bodySize = 9
  const bodyLineHeight = 12
  const cardPadding = 10
  const titleGap = 8
  const rowGap = 4

  let y = height - 42

  const newPage = async () => {
    page = pdf.addPage([595, 842])
    await drawHeader()
    y = height - 42
  }

  const drawCardSection = async (title: string, rows: string[]) => {
    const wrappedRows = rows.map((row) => wrapLines(row, cardWidth - cardPadding * 2, bodySize, font))
    const rowLineCount = wrappedRows.reduce((sum, lines) => sum + lines.length, 0)
    const cardHeight = cardPadding + 12 + titleGap + rowLineCount * bodyLineHeight + (rows.length - 1) * rowGap + cardPadding

    if (y - cardHeight < 48) {
      await newPage()
    }

    const cardY = y - cardHeight
    page.drawRectangle({
      x: side,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      borderColor: rgb(0.82, 0.82, 0.82),
      borderWidth: 1,
      color: rgb(0.99, 0.99, 0.99),
    })

    page.drawText(title, {
      x: side + cardPadding,
      y: cardY + cardHeight - cardPadding - 2,
      size: 11,
      font: bold,
      color: rgb(176 / 255, 18 / 255, 18 / 255),
    })

    let textY = cardY + cardHeight - cardPadding - 14 - titleGap
    for (const lines of wrappedRows) {
      for (const line of lines) {
        page.drawText(line, { x: side + cardPadding, y: textY, size: bodySize, font })
        textY -= bodyLineHeight
      }
      textY -= rowGap
    }

    y = cardY - 10
  }

  drawCentered('North Florida Gymnastics', y, 18, bold, rgb(176 / 255, 18 / 255, 18 / 255))
  y -= 20
  drawCentered('Progress Report', y, 12, font, rgb(0.25, 0.25, 0.25))
  y -= 16
  drawCentered(`Gymnast: ${gymnast.name} | Level ${gymnast.level} | ${formatReportMonth(report.month)}`, y, 10, font)
  y -= 24

  const rawEventReports = report.eventReports as unknown as Record<string, Report['eventReports'][keyof Report['eventReports']]>
  const getEvent = (eventName: string) => rawEventReports[eventName] ?? (eventName === 'Coachability' ? rawEventReports.Behavior : undefined)

  for (const eventName of CORE_EVENTS) {
    const event = getEvent(eventName)
    const rows = [
      event?.eventNotes?.trim() ? `Feedback: ${event.eventNotes.trim()}` : 'Feedback: No event-specific feedback yet',
      'Skills:',
      ...formatSkillRows(event?.skills ?? []),
    ]
    await drawCardSection(eventName, rows)
  }

  const strengthEvent = getEvent('Strength/Flexibility')
  const coachabilityEvent = getEvent('Coachability')

  await drawCardSection('Strength/Flexibility', [
    strengthEvent?.eventNotes?.trim() ? `Feedback: ${strengthEvent.eventNotes.trim()}` : 'Feedback: No feedback yet',
    'Skills:',
    ...formatSkillRows(strengthEvent?.skills ?? []),
  ])

  await drawCardSection('Coachability', formatCoachabilityRows(coachabilityEvent?.skills ?? [], coachabilityEvent?.eventNotes))

  await drawCardSection('Goals', [
    report.projectedLevel?.level ? `Projected Level: ${report.projectedLevel.level}` : 'Projected Level: Not set',
    report.projectedLevel?.notes?.trim() ? `Progress Note: ${report.projectedLevel.notes.trim()}` : 'Progress Note: Not provided',
    ...report.goals
      .filter((goal) => goal.goal || goal.progressNote)
      .map((goal, index) => `Goal ${index + 1}: ${goal.goal || 'N/A'} | ${goal.progressNote || 'No progress note'}`),
  ])

  await drawCardSection('Additional Notes', [
    report.generalNotes?.trim() ? `General: ${report.generalNotes.trim()}` : 'General: None',
    report.attendance?.trim() ? `Attendance: ${report.attendance.trim()}` : 'Attendance: None',
    report.injuries?.trim() ? `Injuries: ${report.injuries.trim()}` : 'Injuries: None',
    report.reminders?.trim() ? `Reminders: ${report.reminders.trim()}` : 'Reminders: None',
  ])

  page.drawText(`Do not reply to this email. Contact ${contactEmail} for any questions or concerns.`, { x: 30, y: 30, size: 9, font, color: rgb(0.4, 0.4, 0.4) })

  return await pdf.save()
}
