import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { Gymnast, Report } from '../types/models'
import { formatReportMonth } from './utils'

export async function buildReportPdf(report: Report, gymnast: Gymnast, contactEmail: string) {
  const pdf = await PDFDocument.create()
  let page = pdf.addPage([595, 842])
  const { width, height } = page.getSize()
  const EVENT_ORDER = ['Vault', 'Bars', 'Beam', 'Floor', 'Strength/Flexibility', 'Coachability'] as const
  const COMPACT_EVENTS = new Set(['Vault', 'Bars', 'Beam', 'Floor'])

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

  let y = height - 40
  page.drawText('NFGC Progress Report', { x: 30, y, size: 16, font: bold })
  y -= 20
  page.drawText(`Gymnast: ${gymnast.name} | Level ${gymnast.level} | ${formatReportMonth(report.month)}`, { x: 30, y, size: 11, font })
  y -= 20

  const rawEventReports = report.eventReports as unknown as Record<string, Report['eventReports'][keyof Report['eventReports']]>

  for (const eventName of EVENT_ORDER) {
    const event = rawEventReports[eventName] ?? (eventName === 'Coachability' ? rawEventReports.Behavior : undefined)
    if (!event) continue
    if (y < 120) {
      page = pdf.addPage([595, 842])
      await drawHeader()
      y = height - 40
    }
    page.drawText(eventName, { x: 30, y, size: 12, font: bold, color: rgb(176 / 255, 18 / 255, 18 / 255) })
    y -= 16
    if (event.eventNotes) {
      page.drawText(`Event notes: ${event.eventNotes}`, { x: 40, y, size: 10, font: bold })
      y -= 14
    }
    for (const skill of event.skills) {
      if (y < 80) break
      const displayStatus = eventName === 'Coachability' ? normalizeCoachabilityRating(skill.status) : skill.status
      page.drawText(`• ${skill.name}: ${displayStatus}`, { x: 40, y, size: 10, font })
      y -= 12
      if (skill.notes) {
        page.drawText(`  Note: ${skill.notes}`, { x: 50, y, size: 9, font })
        y -= 11
      }
    }
    y -= COMPACT_EVENTS.has(eventName) ? 8 : 18
  }

  if (y < 120) {
    page = pdf.addPage([595, 842])
    await drawHeader()
    y = height - 40
  }
  page.drawText('Goals', { x: 30, y, size: 12, font: bold, color: rgb(176 / 255, 18 / 255, 18 / 255) })
  y -= 16

  if (report.projectedLevel?.level) {
    page.drawText(`Current Projected Level: ${report.projectedLevel.level}`, { x: 30, y, size: 10, font })
    y -= 12
  }
  if (report.projectedLevel?.notes) {
    page.drawText(`Projected level notes: ${report.projectedLevel.notes}`, { x: 30, y, size: 10, font })
    y -= 12
  }

  for (const [index, goal] of report.goals.entries()) {
    if (!goal.goal && !goal.progressNote) continue
    page.drawText(`Goal ${index + 1}: ${goal.goal || 'N/A'}`, { x: 30, y, size: 10, font })
    y -= 12
    page.drawText(`Progress: ${goal.progressNote || 'N/A'}`, { x: 40, y, size: 10, font })
    y -= 12
  }
  y -= 18

  const notesRows = [
    { label: 'Notes', value: report.generalNotes?.trim() || '' },
    { label: 'Attendance', value: report.attendance?.trim() || '' },
    { label: 'Injuries', value: report.injuries?.trim() || '' },
    { label: 'Reminders', value: report.reminders?.trim() || '' },
  ].filter((row) => row.value)

  if (notesRows.length) {
    if (y < 120) {
      page = pdf.addPage([595, 842])
      await drawHeader()
      y = height - 40
    }
    page.drawText('Notes', { x: 30, y, size: 12, font: bold, color: rgb(176 / 255, 18 / 255, 18 / 255) })
    y -= 16

    for (const row of notesRows) {
      if (y < 80) {
        page = pdf.addPage([595, 842])
        await drawHeader()
        y = height - 40
      }
      page.drawText(`${row.label}: ${row.value}`, { x: 30, y, size: 10, font })
      y -= 12
    }
    y -= 18
  }

  page.drawText(`Do not reply to this email. Contact ${contactEmail} for any questions or concerns.`, { x: 30, y: 30, size: 9, font, color: rgb(0.4, 0.4, 0.4) })

  return await pdf.save()
}
