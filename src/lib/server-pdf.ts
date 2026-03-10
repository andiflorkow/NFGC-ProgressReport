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

  const formatSkillRows = (skills: Array<{ name: string }>) => (skills.length ? skills.map((skill) => `• ${skill.name}`) : ['• None'])

  const formatFeedbackRows = (eventName: string, skills: Array<{ status: string; notes?: string }>, eventFeedback?: string) => {
    const statusRows = skills.length
      ? skills.map((skill) => {
          const displayStatus = eventName === 'Coachability' ? normalizeCoachabilityRating(skill.status) : skill.status
          return skill.notes?.trim() ? `• ${displayStatus}: ${skill.notes.trim()}` : `• ${displayStatus}`
        })
      : ['• -']

    if (eventFeedback?.trim()) statusRows.push(`• ${eventFeedback.trim()}`)
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

  const cardsX = 30
  const cardsWidth = width - 60
  const gap = 12
  const cardWidth = (cardsWidth - gap) / 2
  const wideCardHeight = 64
  const smallCardHeight = 120

  const drawWideCard = (title: string, skillsText: string, feedbackText: string, y: number) => {
    page.drawRectangle({ x: cardsX, y, width: cardsWidth, height: wideCardHeight, borderColor: rgb(0.82, 0.82, 0.82), borderWidth: 1, color: rgb(0.99, 0.99, 0.99) })
    page.drawText(title, { x: cardsX + 8, y: y + wideCardHeight - 14, size: 10, font: bold, color: rgb(176 / 255, 18 / 255, 18 / 255) })
    drawWrapped(skillsText || '• None', cardsX + 120, y + wideCardHeight - 16, 210, 9, 11, font, 3)
    drawWrapped(feedbackText || '• -', cardsX + 340, y + wideCardHeight - 16, cardsWidth - 348, 9, 11, font, 3)
    page.drawLine({ start: { x: cardsX + 112, y: y + 6 }, end: { x: cardsX + 112, y: y + wideCardHeight - 6 }, thickness: 1, color: rgb(0.86, 0.86, 0.86) })
    page.drawLine({ start: { x: cardsX + 332, y: y + 6 }, end: { x: cardsX + 332, y: y + wideCardHeight - 6 }, thickness: 1, color: rgb(0.86, 0.86, 0.86) })
  }

  const drawSmallCard = (title: string, text: string, x: number, y: number) => {
    page.drawRectangle({ x, y, width: cardWidth, height: smallCardHeight, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1, color: rgb(0.99, 0.99, 0.99) })
    page.drawText(title, { x: x + 8, y: y + smallCardHeight - 16, size: 10, font: bold, color: rgb(176 / 255, 18 / 255, 18 / 255) })
    drawWrapped(text || 'None', x + 8, y + smallCardHeight - 30, cardWidth - 16, 9, 11, font, 7)
  }

  let y = height - 128
  for (const eventName of CORE_EVENTS) {
    const event = getEvent(eventName)
    const skillsText = formatSkillRows(event?.skills ?? []).join('  ')
    const feedbackText = formatFeedbackRows(eventName, event?.skills ?? [], event?.eventNotes).join('  ')
    drawWideCard(eventName, skillsText, feedbackText, y - wideCardHeight)
    y -= wideCardHeight + 8
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

  const bottomTop = y - 8
  drawSmallCard('Strength/Flexibility', strengthText, cardsX, bottomTop - smallCardHeight)
  drawSmallCard('Coachability', coachabilityText, cardsX + cardWidth + gap, bottomTop - smallCardHeight)
  drawSmallCard('Goals', goalsText, cardsX, bottomTop - smallCardHeight * 2 - gap)
  drawSmallCard('Additional Notes', additionalNotesText, cardsX + cardWidth + gap, bottomTop - smallCardHeight * 2 - gap)

  page.drawText(`Do not reply to this email. Contact ${contactEmail} for any questions or concerns.`, { x: 30, y: 30, size: 9, font, color: rgb(0.4, 0.4, 0.4) })

  return await pdf.save()
}
