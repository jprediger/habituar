import type { ReportPdf } from '@habituar/core/reports'
import { StorageAccessFramework, deleteAsync, writeAsStringAsync } from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'
import { openPdfFromDownloads, savePdfToDownloads } from '../../modules/report-downloads/src'
import { saveReportPdf } from './report-file'

jest.mock('../../modules/report-downloads/src', () => ({
  savePdfToDownloads: jest.fn(),
  openPdfFromDownloads: jest.fn(),
}))

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///tmp/',
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(),
    createFileAsync: jest.fn(),
  },
}))

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}))

const pdf: ReportPdf = { filename: 'Relatório Lia.pdf', mediaType: 'application/pdf', base64: 'JVBERi0xLjQ=' }

beforeEach(() => {
  jest.clearAllMocks()
  jest.replaceProperty(Platform, 'OS', 'android')
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(35)
  jest.mocked(StorageAccessFramework.requestDirectoryPermissionsAsync).mockResolvedValue({
    granted: true, directoryUri: 'content://tree/documents',
  })
  jest.mocked(StorageAccessFramework.createFileAsync).mockResolvedValue('content://document/relatorio.pdf')
  jest.mocked(writeAsStringAsync).mockResolvedValue(undefined)
  jest.mocked(deleteAsync).mockResolvedValue(undefined)
  jest.mocked(savePdfToDownloads).mockResolvedValue('content://media/external/downloads/123')
  jest.mocked(openPdfFromDownloads).mockResolvedValue(true)
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true)
  jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined)
})

afterEach(() => { jest.restoreAllMocks() })

describe('salvar PDF de relatórios', () => {
  it('no Android 10+ salva automaticamente em Downloads e abre o leitor de PDF', async () => {
    expect(await saveReportPdf(pdf)).toBe('opened')
    expect(StorageAccessFramework.requestDirectoryPermissionsAsync).not.toHaveBeenCalled()
    expect(StorageAccessFramework.createFileAsync).not.toHaveBeenCalled()
    expect(writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/tmp\/\d+-Relat_rio_Lia\.pdf$/),
      pdf.base64,
      { encoding: 'base64' },
    )
    expect(savePdfToDownloads).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/tmp\/\d+-Relat_rio_Lia\.pdf$/),
      'Relat_rio_Lia.pdf',
    )
    expect(openPdfFromDownloads).toHaveBeenCalledWith('content://media/external/downloads/123')
    expect(deleteAsync).toHaveBeenCalledWith(expect.any(String), { idempotent: true })
    expect(Sharing.shareAsync).not.toHaveBeenCalled()
  })

  it('mantém o PDF salvo se não houver leitor instalado', async () => {
    jest.mocked(openPdfFromDownloads).mockResolvedValue(false)
    expect(await saveReportPdf(pdf)).toBe('saved')
    expect(savePdfToDownloads).toHaveBeenCalledTimes(1)
    expect(deleteAsync).toHaveBeenCalledWith(expect.any(String), { idempotent: true })
  })

  it('mantém o PDF salvo quando o leitor não pode ser iniciado', async () => {
    jest.mocked(openPdfFromDownloads).mockRejectedValue(new Error('cannot open PDF'))
    expect(await saveReportPdf(pdf)).toBe('saved')
    expect(savePdfToDownloads).toHaveBeenCalledTimes(1)
    expect(deleteAsync).toHaveBeenCalledWith(expect.any(String), { idempotent: true })
  })

  it('remove o PDF temporário quando o salvamento em Downloads falha', async () => {
    jest.mocked(savePdfToDownloads).mockRejectedValue(new Error('media store unavailable'))
    await expect(saveReportPdf(pdf)).rejects.toThrow('media store unavailable')
    expect(deleteAsync).toHaveBeenCalledWith(expect.any(String), { idempotent: true })
  })

  it('no Android 9 ou anterior usa o seletor de pasta', async () => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(28)
    expect(await saveReportPdf(pdf)).toBe('saved')
    expect(StorageAccessFramework.createFileAsync).toHaveBeenCalledWith('content://tree/documents', 'Relat_rio_Lia', 'application/pdf')
    expect(writeAsStringAsync).toHaveBeenCalledWith('content://document/relatorio.pdf', pdf.base64, { encoding: 'base64' })
    expect(savePdfToDownloads).not.toHaveBeenCalled()
    expect(openPdfFromDownloads).not.toHaveBeenCalled()
  })

  it('não cria o documento quando a pessoa cancela o seletor no Android antigo', async () => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(28)
    jest.mocked(StorageAccessFramework.requestDirectoryPermissionsAsync).mockResolvedValue({ granted: false })
    expect(await saveReportPdf(pdf)).toBe('cancelled')
    expect(StorageAccessFramework.createFileAsync).not.toHaveBeenCalled()
    expect(writeAsStringAsync).not.toHaveBeenCalled()
  })

  it('no iOS apresenta as opções nativas, incluindo Salvar em Arquivos', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios')
    expect(await saveReportPdf(pdf)).toBe('file-options')
    expect(writeAsStringAsync).toHaveBeenCalledWith(expect.stringMatching(/Relat_rio_Lia\.pdf$/), pdf.base64, { encoding: 'base64' })
    expect(Sharing.shareAsync).toHaveBeenCalledWith(expect.any(String), { mimeType: 'application/pdf', dialogTitle: pdf.filename })
    expect(deleteAsync).toHaveBeenCalledWith(expect.any(String), { idempotent: true })
    expect(savePdfToDownloads).not.toHaveBeenCalled()
    expect(openPdfFromDownloads).not.toHaveBeenCalled()
  })
})
