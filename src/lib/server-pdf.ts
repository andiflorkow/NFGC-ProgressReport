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
    if (!skills.length) return []
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
    const rows = required.flatMap((name) => {
      const item = skills.find((skill) => skill.name === name)
      if (!item) return []
      const rating = normalizeCoachabilityRating(item.status)
      const note = item.notes?.trim() ? ` | ${item.notes.trim()}` : ''
      return [`• ${name}: ${rating}${note}`]
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
  const contentWidth = width - side * 2
  const bodySize = 9
  const bodyLineHeight = 12
  const titleGap = 6
  const rowGap = 5
  const sectionGap = 12
  const groupGap = 7
  const spacerToken = '__SPACER__'

  let y = height - 42

  const newPage = async () => {
    page = pdf.addPage([595, 842])
    await drawHeader()
    y = height - 42
  }

  const measureSectionHeight = (rows: string[], maxWidth: number) => {
    let textHeight = 0
    rows.forEach((row, index) => {
      if (row === spacerToken) {
        textHeight += groupGap
      } else {
        textHeight += wrapLines(row, maxWidth, bodySize, font).length * bodyLineHeight
      }
      if (index < rows.length - 1) textHeight += rowGap
    })
    return 12 + titleGap + textHeight + 12
  }

  const renderSection = (x: number, startY: number, maxWidth: number, title: string, rows: string[]) => {
    page.drawText(title, {
      x,
      y: startY,
      size: 11,
      font: bold,
      color: rgb(176 / 255, 18 / 255, 18 / 255),
    })
    let textY = startY - 12 - titleGap

    for (const row of rows) {
      if (row === spacerToken) {
        textY -= groupGap
      } else {
        const lines = wrapLines(row, maxWidth, bodySize, font)
        for (const line of lines) {
          page.drawText(line, { x, y: textY, size: bodySize, font })
          textY -= bodyLineHeight
        }
      }
      textY -= rowGap
    }

    return textY + rowGap - sectionGap
  }

  const drawSection = async (title: string, rows: string[]) => {
    if (!rows.length) return
    const sectionHeight = measureSectionHeight(rows, contentWidth)
    if (y - sectionHeight < 48) {
      await newPage()
    }
    y = renderSection(side, y, contentWidth, title, rows)
  }

  const buildEventRows = (eventNotes?: string, skillRows: string[] = []) => {
    const rows: string[] = []
    if (eventNotes?.trim()) rows.push(eventNotes.trim())
    if (skillRows.length) {
      if (rows.length) rows.push(spacerToken)
      rows.push('Skill Progress:')
      rows.push(...skillRows)
    }
    return rows
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
    const rows = buildEventRows(event?.eventNotes, formatSkillRows(event?.skills ?? []))
    await drawSection(eventName, rows)
  }

  const strengthEvent = getEvent('Strength/Flexibility')
  const coachabilityEvent = getEvent('Coachability')

  const strengthRows = buildEventRows(strengthEvent?.eventNotes, formatSkillRows(strengthEvent?.skills ?? []))
  const coachabilityRows = formatCoachabilityRows(coachabilityEvent?.skills ?? [], coachabilityEvent?.eventNotes)
  const goalsRows = [
    ...(report.projectedLevel?.level ? [`Projected Level: ${report.projectedLevel.level}`] : []),
    ...(report.projectedLevel?.notes?.trim() ? [`Progress Note: ${report.projectedLevel.notes.trim()}`] : []),
    ...report.goals
      .filter((goal) => goal.goal || goal.progressNote)
      .map((goal, index) => `Goal ${index + 1}: ${goal.goal || 'N/A'} | ${goal.progressNote || 'No progress note'}`),
  ]
  const additionalRows = [
    ...(report.generalNotes?.trim() ? [`General: ${report.generalNotes.trim()}`] : []),
    ...(report.attendance?.trim() ? [`Attendance: ${report.attendance.trim()}`] : []),
    ...(report.injuries?.trim() ? [`Injuries: ${report.injuries.trim()}`] : []),
    ...(report.reminders?.trim() ? [`Reminders: ${report.reminders.trim()}`] : []),
  ]

  y -= 22

  const columnGap = 26
  const columnWidth = (contentWidth - columnGap) / 2
  const leftSections = [
    { title: 'Strength/Flexibility', rows: strengthRows },
    { title: 'Goals', rows: goalsRows },
  ].filter((section) => section.rows.length)
  const rightSections = [
    { title: 'Coachability', rows: coachabilityRows },
    { title: 'Additional Notes', rows: additionalRows },
  ].filter((section) => section.rows.length)

  const leftStackHeight = leftSections.reduce((sum, section) => sum + measureSectionHeight(section.rows, columnWidth), 0)
  const rightStackHeight = rightSections.reduce((sum, section) => sum + measureSectionHeight(section.rows, columnWidth), 0)
  const dualColumnHeight = Math.max(leftStackHeight, rightStackHeight)

  if (dualColumnHeight > 0 && y - dualColumnHeight < 48) {
    await newPage()
  }

  const leftX = side
  const rightX = side + columnWidth + columnGap
  const dualColumnsTopY = y

  let leftY = y
  for (const section of leftSections) {
    leftY = renderSection(leftX, leftY, columnWidth, section.title, section.rows)
  }

  let rightY = y
  for (const section of rightSections) {
    rightY = renderSection(rightX, rightY, columnWidth, section.title, section.rows)
  }

  const dividerX = leftX + columnWidth + columnGap / 2
  const dividerTop = dualColumnsTopY + 2
  const dividerBottom = Math.min(leftY, rightY) + 8
  if (dividerTop - dividerBottom > 20) {
    page.drawLine({
      start: { x: dividerX, y: dividerTop },
      end: { x: dividerX, y: dividerBottom },
      thickness: 0.8,
      color: rgb(0.82, 0.82, 0.82),
    })
  }

  y = Math.min(leftY, rightY)

  page.drawText(`Do not reply to this email. Contact ${contactEmail} for any questions or concerns.`, { x: 30, y: 30, size: 9, font, color: rgb(0.4, 0.4, 0.4) })

  return await pdf.save()
}
