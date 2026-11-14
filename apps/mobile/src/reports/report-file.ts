import type { ReportPdf } from '@habituar/core/reports'
import { StorageAccessFramework, cacheDirectory, deleteAsync, writeAsStringAsync } from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'

export type SaveReportResult = 'saved' | 'cancelled' | 'file-options'

/** Salva o PDF em uma pasta escolhida no Android; no iOS oferece Salvar em Arquivos. */
export async function saveReportPdf(pdf: ReportPdf): Promise<SaveReportResult> {
  const safeName = pdf.filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '')
  const filename = (safeName === '' ? 'relatorio' : safeName).replace(/\.pdf$/i, '')

  if (Platform.OS === 'android') {
    const selection = await StorageAccessFramework.requestDirectoryPermissionsAsync()
    if (!selection.granted) return 'cancelled'

    const uri = await StorageAccessFramework.createFileAsync(selection.directoryUri, filename, 'application/pdf')
    try {
      await writeAsStringAsync(uri, pdf.base64, { encoding: 'base64' })
    } catch (error) {
      await deleteAsync(uri, { idempotent: true }).catch(() => undefined)
      throw error
    }
    return 'saved'
  }

  if (cacheDirectory === null || !await Sharing.isAvailableAsync()) {
    throw new Error('PDF file options are unavailable on this device.')
  }

  const uri = `${cacheDirectory}${Date.now().toString()}-${filename}.pdf`
  try {
    await writeAsStringAsync(uri, pdf.base64, { encoding: 'base64' })
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: pdf.filename })
    return 'file-options'
  } finally {
    await deleteAsync(uri, { idempotent: true })
  }
}
