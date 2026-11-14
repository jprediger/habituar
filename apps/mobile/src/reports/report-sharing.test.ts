import { deleteAsync, writeAsStringAsync } from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { shareReportPdf } from './report-sharing'

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///tmp/',
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
}))

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true)
  jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined)
  jest.mocked(writeAsStringAsync).mockResolvedValue(undefined)
  jest.mocked(deleteAsync).mockResolvedValue(undefined)
})

describe('compartilhamento do PDF de relatórios', () => {
  const pdf = { filename: 'relatorio.pdf', base64: 'JVBERi0xLjQ=', mediaType: 'application/pdf' as const }

  it('usa o PDF da API e apaga o arquivo temporário após compartilhar', async () => {
    await shareReportPdf(pdf)

    expect(writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/tmp\/\d+-relatorio\.pdf$/),
      pdf.base64,
      { encoding: 'base64' },
    )
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/tmp\/\d+-relatorio\.pdf$/),
      { mimeType: 'application/pdf', dialogTitle: 'relatorio.pdf' },
    )
    expect(deleteAsync).toHaveBeenCalledWith(expect.any(String), { idempotent: true })
  })

  it('não grava dados no aparelho se o compartilhamento estiver indisponível', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false)
    await expect(shareReportPdf(pdf)).rejects.toThrow()
    expect(writeAsStringAsync).not.toHaveBeenCalled()
  })

  it('remove o arquivo temporário mesmo quando compartilhar falha', async () => {
    jest.mocked(Sharing.shareAsync).mockRejectedValue(new Error('sharing unavailable'))
    await expect(shareReportPdf(pdf)).rejects.toThrow()
    expect(deleteAsync).toHaveBeenCalledWith(expect.any(String), { idempotent: true })
  })
})
