import { requireNativeModule } from 'expo'

type HabituarReportDownloadsModule = {
  savePdfToDownloads(sourceUri: string, filename: string): Promise<string>
  openPdfFromDownloads(uri: string): Promise<boolean>
}

/** Copia um PDF do cache privado para a pasta Downloads do Android. */
export async function savePdfToDownloads(sourceUri: string, filename: string): Promise<string> {
  const nativeModule = requireNativeModule<HabituarReportDownloadsModule>('HabituarReportDownloads')
  return await nativeModule.savePdfToDownloads(sourceUri, filename)
}

/** Abre o PDF publicado em Downloads com o leitor instalado no Android. */
export async function openPdfFromDownloads(uri: string): Promise<boolean> {
  const nativeModule = requireNativeModule<HabituarReportDownloadsModule>('HabituarReportDownloads')
  return await nativeModule.openPdfFromDownloads(uri)
}
