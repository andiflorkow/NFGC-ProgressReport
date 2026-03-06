export async function openReportPdfPreview(reportId: string, toast: (message: string) => void) {
  const previewTab = window.open('', '_blank')
  if (!previewTab) {
    toast('Popup blocked. Please allow popups to preview PDFs.')
    return false
  }

  previewTab.document.write('<p style="font-family:sans-serif;padding:16px;">Generating PDF preview...</p>')

  const previewUrl = `/api/reports/${reportId}/pdf`

  try {
    const response = await fetch(previewUrl, { method: 'POST' })
    if (!response.ok) {
      previewTab.close()
      toast('PDF preview failed')
      return false
    }

    previewTab.location.href = previewUrl
    return true
  } catch {
    previewTab.close()
    toast('PDF preview failed')
    return false
  }
}
