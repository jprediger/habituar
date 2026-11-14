import type { ReportPdf } from '@habituar/core/reports'
import { cacheDirectory, deleteAsync, writeAsStringAsync } from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

/** Compartilha o PDF do servidor e remove a cópia temporária após o menu nativo fechar. */
export async function shareReportPdf(pdf: ReportPdf): Promise<void> {
  if (cacheDirectory === null || !await Sharing.isAvailableAsync()) {
    throw new Error('PDF sharing is not available on this device.')
  }

  const cleanName = pdf.filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '')
  const filename = cleanName.toLowerCase().endsWith('.pdf') ? cleanName : `${cleanName}.pdf`
  const uri = `${cacheDirectory}${Date.now().toString()}-${filename}`
  try {
    await writeAsStringAsync(uri, pdf.base64, { encoding: 'base64' })
    await Sharing.shareAsync(uri, { mimeType: pdf.mediaType, dialogTitle: pdf.filename })
  } finally {
    await deleteAsync(uri, { idempotent: true })
  }
}
