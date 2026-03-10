import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { Gymnast, Report } from '../types/models'
import { formatReportMonth } from './utils'

export async function buildReportPdf(report: Report, gymnast: Gymnast, contactEmail: string) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
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

  const drawWrapped = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    size: number,
    lineHeight: number,
    fontRef: any,
    maxLines = 6,
  ) => {
    const words = text.split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let current = ''

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (fontRef.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate
      } else {
        if (current) lines.push(current)
        current = word
        if (lines.length >= maxLines) break
      }
    }
    if (current && lines.length < maxLines) lines.push(current)

    lines.forEach((line, index) => {
      page.drawText(line, { x, y: y - index * lineHeight, size, font: fontRef })
    })

    return y - lines.length * lineHeight
  }

  const buildWrappedLines = (text: string, maxWidth: number, size: number, fontRef: any) => {
    const words = text.split(/\s+/).filter(Boolean)
    if (!words.length) return ['']
    const lines: string[] = []
    let current = ''

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (fontRef.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate
      } else {
        if (current) lines.push(current)
        current = word
      }
    }
    if (current) lines.push(current)
    return lines
  }

  const formatSkillRows = (skills: Array<{ name: string }>) => (skills.length ? skills.map((skill) => `• ${skill.name}`) : ['• None'])

  const formatFeedbackRows = (eventName: string, skills: Array<{ status: string; notes?: string }>, eventFeedback?: string) => {
    const statusRows = skills.length
      ? skills.map((skill) => {
          const displayStatus = eventName === 'Coachability' ? normalizeCoachabilityRating(skill.status) : skill.status
          return skill.notes?.trim() ? `${displayStatus}: ${skill.notes.trim()}` : displayStatus
        })
      : ['-']

    if (eventFeedback?.trim()) statusRows.push(eventFeedback.trim())
    return statusRows
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

  drawCentered('North Florida Gymnastics', height - 52, 18, bold, rgb(176 / 255, 18 / 255, 18 / 255))
  drawCentered('Progress Report', height - 72, 12, font, rgb(0.25, 0.25, 0.25))
  drawCentered(`Gymnast: ${gymnast.name} | Level ${gymnast.level} | ${formatReportMonth(report.month)}`, height - 92, 10, font)

  const rawEventReports = report.eventReports as unknown as Record<string, Report['eventReports'][keyof Report['eventReports']]>
  const getEvent = (eventName: string) => rawEventReports[eventName] ?? (eventName === 'Coachability' ? rawEventReports.Behavior : undefined)

  const tableX = 30
  const tableTop = height - 120
  const tableWidth = width - 60
  const headerHeight = 22
  const minRowHeight = 72
  const lineHeight = 14
  const eventColWidth = 120
  const feedbackColWidth = 175
  const skillsColWidth = tableWidth - eventColWidth - feedbackColWidth

  page.drawRectangle({ x: tableX, y: tableTop - headerHeight, width: tableWidth, height: headerHeight, color: rgb(0.95, 0.95, 0.95) })
  page.drawLine({ start: { x: tableX + eventColWidth, y: tableTop }, end: { x: tableX + eventColWidth, y: tableTop - headerHeight }, thickness: 1, color: rgb(0.82, 0.82, 0.82) })
  page.drawLine({ start: { x: tableX + eventColWidth + skillsColWidth, y: tableTop }, end: { x: tableX + eventColWidth + skillsColWidth, y: tableTop - headerHeight }, thickness: 1, color: rgb(0.82, 0.82, 0.82) })
  page.drawText('Event', { x: tableX + 8, y: tableTop - 15, size: 10, font: bold })
  page.drawText('Skills', { x: tableX + eventColWidth + 8, y: tableTop - 15, size: 10, font: bold })
  page.drawText('Feedback', { x: tableX + eventColWidth + skillsColWidth + 8, y: tableTop - 15, size: 10, font: bold })

  let rowY = tableTop - headerHeight
  for (const eventName of CORE_EVENTS) {
    const event = getEvent(eventName)
    const skillRows = formatSkillRows(event?.skills ?? [])
    const feedbackRows = formatFeedbackRows(eventName, event?.skills ?? [], event?.eventNotes)

    const skillLines = skillRows.flatMap((row) => buildWrappedLines(row, skillsColWidth - 16, 9, font))
    const feedbackLines = feedbackRows.flatMap((row) => buildWrappedLines(row, feedbackColWidth - 16, 9, font))
    const contentLines = Math.max(skillLines.length, feedbackLines.length, 1)
    const rowHeight = Math.max(minRowHeight, 24 + contentLines * lineHeight)

    rowY -= rowHeight
    page.drawRectangle({ x: tableX, y: rowY, width: tableWidth, height: rowHeight, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 1 })
    page.drawRectangle({ x: tableX + eventColWidth + skillsColWidth, y: rowY, width: feedbackColWidth, height: rowHeight, color: rgb(0.985, 0.985, 0.985) })
    page.drawLine({ start: { x: tableX + eventColWidth, y: rowY + rowHeight }, end: { x: tableX + eventColWidth, y: rowY }, thickness: 1, color: rgb(0.85, 0.85, 0.85) })
    page.drawLine({ start: { x: tableX + eventColWidth + skillsColWidth, y: rowY + rowHeight }, end: { x: tableX + eventColWidth + skillsColWidth, y: rowY }, thickness: 1, color: rgb(0.85, 0.85, 0.85) })
    page.drawText(eventName, { x: tableX + 8, y: rowY + rowHeight - 16, size: 10, font: bold })

    for (let line = 0; line < contentLines; line += 1) {
      const yLine = rowY + rowHeight - 18 - line * lineHeight
      if (skillLines[line]) {
        page.drawText(skillLines[line], { x: tableX + eventColWidth + 8, y: yLine, size: 9, font })
      }
      if (feedbackLines[line]) {
        page.drawText(feedbackLines[line], { x: tableX + eventColWidth + skillsColWidth + 8, y: yLine, size: 9, font })
      }
    }
  }

  const cardsTop = rowY - 16
  const cardsX = 30
  const cardsWidth = width - 60
  const gap = 12
  const cardWidth = (cardsWidth - gap) / 2
  const cardHeight = 110

  const drawCard = (title: string, text: string, x: number, y: number) => {
    page.drawRectangle({ x, y, width: cardWidth, height: cardHeight, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1, color: rgb(0.99, 0.99, 0.99) })
    page.drawText(title, { x: x + 8, y: y + cardHeight - 16, size: 10, font: bold, color: rgb(176 / 255, 18 / 255, 18 / 255) })
    drawWrapped(text || 'None', x + 8, y + cardHeight - 30, cardWidth - 16, 9, 11, font, 6)
  }

  const strengthEvent = getEvent('Strength/Flexibility')
  const coachabilityEvent = getEvent('Coachability')
  const goalsText = [
    report.projectedLevel?.level ? `Projected Level: ${report.projectedLevel.level}` : '',
    report.projectedLevel?.notes ? `Projected Level Detail: ${report.projectedLevel.notes}` : '',
    ...report.goals
      .filter((goal) => goal.goal || goal.progressNote)
      .map((goal, index) => `Goal ${index + 1}: ${goal.goal || 'N/A'} | Progress: ${goal.progressNote || 'N/A'}`),
  ]
    .filter(Boolean)
    .join(' | ')

  const additionalNotesText = [
    report.generalNotes?.trim() ? report.generalNotes.trim() : '',
    report.attendance?.trim() ? `Attendance: ${report.attendance.trim()}` : '',
    report.injuries?.trim() ? `Injuries: ${report.injuries.trim()}` : '',
    report.reminders?.trim() ? `Reminders: ${report.reminders.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' | ')

  const strengthText = [
    strengthEvent?.eventNotes?.trim() || '',
    ...formatSkillRows(strengthEvent?.skills ?? []),
  ]
    .filter(Boolean)
    .join(' | ')

  const coachabilityText = [
    coachabilityEvent?.eventNotes?.trim() || '',
    ...formatFeedbackRows('Coachability', coachabilityEvent?.skills ?? []),
  ]
    .filter(Boolean)
    .join(' | ')

  drawCard('Strength/Flexibility', strengthText, cardsX, cardsTop - cardHeight)
  drawCard('Coachability', coachabilityText, cardsX + cardWidth + gap, cardsTop - cardHeight)
  drawCard('Goals', goalsText, cardsX, cardsTop - cardHeight * 2 - gap)
  drawCard('Additional Notes', additionalNotesText, cardsX + cardWidth + gap, cardsTop - cardHeight * 2 - gap)

  page.drawText(`Do not reply to this email. Contact ${contactEmail} for any questions or concerns.`, { x: 30, y: 30, size: 9, font, color: rgb(0.4, 0.4, 0.4) })

  return await pdf.save()
}
