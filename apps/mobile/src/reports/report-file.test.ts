import type { ReportPdf } from '@habituar/core/reports'
import { StorageAccessFramework, deleteAsync, writeAsStringAsync } from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'
import { saveReportPdf } from './report-file'

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
  jest.mocked(StorageAccessFramework.requestDirectoryPermissionsAsync).mockResolvedValue({
    granted: true, directoryUri: 'content://tree/documents',
  })
  jest.mocked(StorageAccessFramework.createFileAsync).mockResolvedValue('content://document/relatorio.pdf')
  jest.mocked(writeAsStringAsync).mockResolvedValue(undefined)
  jest.mocked(deleteAsync).mockResolvedValue(undefined)
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true)
  jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined)
})

afterEach(() => { jest.restoreAllMocks() })

describe('salvar PDF de relatórios', () => {
  it('no Android grava o documento na pasta escolhida sem abrir a tela de compartilhamento', async () => {
    expect(await saveReportPdf(pdf)).toBe('saved')
    expect(StorageAccessFramework.createFileAsync).toHaveBeenCalledWith('content://tree/documents', 'Relat_rio_Lia', 'application/pdf')
    expect(writeAsStringAsync).toHaveBeenCalledWith('content://document/relatorio.pdf', pdf.base64, { encoding: 'base64' })
    expect(Sharing.shareAsync).not.toHaveBeenCalled()
  })

  it('não exporta nada quando a pessoa cancela o seletor de pasta', async () => {
    jest.mocked(StorageAccessFramework.requestDirectoryPermissionsAsync).mockResolvedValue({ granted: false })
    expect(await saveReportPdf(pdf)).toBe('cancelled')
    expect(StorageAccessFramework.createFileAsync).not.toHaveBeenCalled()
    expect(writeAsStringAsync).not.toHaveBeenCalled()
  })

  it('remove um arquivo incompleto quando a gravação falha', async () => {
    jest.mocked(writeAsStringAsync).mockRejectedValue(new Error('write failed'))
    await expect(saveReportPdf(pdf)).rejects.toThrow('write failed')
    expect(deleteAsync).toHaveBeenCalledWith('content://document/relatorio.pdf', { idempotent: true })
  })

  it('no iOS apresenta as opções nativas, incluindo Salvar em Arquivos', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios')
    expect(await saveReportPdf(pdf)).toBe('file-options')
    expect(writeAsStringAsync).toHaveBeenCalledWith(expect.stringMatching(/Relat_rio_Lia\.pdf$/), pdf.base64, { encoding: 'base64' })
    expect(Sharing.shareAsync).toHaveBeenCalledWith(expect.any(String), { mimeType: 'application/pdf', dialogTitle: pdf.filename })
    expect(deleteAsync).toHaveBeenCalledWith(expect.any(String), { idempotent: true })
  })
})
