import type { Report, ReportActivity, ReportPdf } from '@habituar/core/reports'
import { Injectable } from '@nestjs/common'

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 46
const BOTTOM = 55

type Page = { commands: string[]; y: number }

function printable(text: string): string {
  return text.normalize('NFC').replace(/\p{Cc}/gu, ' ').replace(/[\u2010-\u2015]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, '?')
}

function pdfString(text: string): string {
  return printable(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function number(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '')
}

function percentage(value: number | null): string {
  return value === null ? 'Sem dados' : `${value.toFixed(2).replace('.', ',')}%`
}

function wrapWords(text: string, max: number): string[] {
  const words = printable(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if ((current ? `${current} ${word}` : word).length > max && current.length > 0) {
      lines.push(current)
      current = ''
    }
    if (word.length > max) {
      if (current) { lines.push(current); current = '' }
      for (let start = 0; start < word.length; start += max) lines.push(word.slice(start, start + max))
    } else current = current ? `${current} ${word}` : word
  }
  if (current.length > 0) lines.push(current)
  return lines.length ? lines : ['']
}

class PdfCanvas {
  private readonly pages: Page[] = []
  private page: Page

  constructor() {
    this.page = this.nextPage()
  }

  private nextPage(): Page {
    const page: Page = { commands: [], y: PAGE_HEIGHT - 58 }
    this.pages.push(page)
    page.commands.push('0.12 0.25 0.31 rg', `0 0 ${String(PAGE_WIDTH)} 7 re f`, '0 0 0 rg')
    return page
  }

  private reserve(height: number): void {
    if (this.page.y - height < BOTTOM) this.page = this.nextPage()
  }

  text(content: string, size = 10, bold = false, indent = 0): void {
    this.reserve(size + 10)
    this.page.commands.push(`BT /${bold ? 'F2' : 'F1'} ${number(size)} Tf ${number(MARGIN + indent)} ${number(this.page.y)} Td (${pdfString(content)}) Tj ET`)
    this.page.y -= size + 9
  }

  paragraph(content: string, size = 10, columns = 85): void {
    for (const line of wrapWords(content, columns)) this.text(line, size)
  }

  space(points = 12): void {
    this.reserve(points)
    this.page.y -= points
  }

  separator(): void {
    this.reserve(12)
    this.page.commands.push('0.79 0.83 0.84 RG 0.7 w', `${String(MARGIN)} ${number(this.page.y)} m ${number(PAGE_WIDTH - MARGIN)} ${number(this.page.y)} l S`, '0 0 0 RG')
    this.page.y -= 13
  }

  bars(labels: readonly string[], values: readonly number[]): void {
    this.reserve(labels.length * 23 + 8)
    const max = Math.max(1, ...values)
    for (const [index, label] of labels.entries()) {
      const y = this.page.y - 9
      const bar = Math.round((values[index] ?? 0) / max * 260)
      this.page.commands.push('0.10 0.43 0.45 rg', `${String(MARGIN + 135)} ${number(y)} ${number(bar)} 11 re f`, '0 0 0 rg')
      this.page.commands.push(`BT /F1 10 Tf ${String(MARGIN)} ${number(y + 2)} Td (${pdfString(label)}) Tj ET`)
      this.page.commands.push(`BT /F2 10 Tf ${String(MARGIN + 410)} ${number(y + 2)} Td (${String(values[index] ?? 0)}) Tj ET`)
      this.page.y -= 23
    }
  }

  finalize(): Buffer {
    const pageRefs = this.pages.map((_, index) => 5 + index * 2)
    const objects: Buffer[] = []
    const add = (body: string | Buffer) => { objects.push(typeof body === 'string' ? Buffer.from(body, 'latin1') : body) }
    add('<< /Type /Catalog /Pages 2 0 R >>')
    add(`<< /Type /Pages /Kids [${pageRefs.map(id => `${String(id)} 0 R`).join(' ')}] /Count ${String(this.pages.length)} >>`)
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
    for (const [index, page] of this.pages.entries()) {
      const contentId = 6 + index * 2
      page.commands.push('0.4 0.4 0.4 rg', `BT /F1 8 Tf ${String(MARGIN)} 30 Td (Habituar - Relatório pedagógico) Tj ET`, `BT /F1 8 Tf ${String(PAGE_WIDTH - MARGIN - 60)} 30 Td (Página ${String(index + 1)}) Tj ET`)
      const content = Buffer.from(page.commands.join('\n') + '\n', 'latin1')
      add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${String(PAGE_WIDTH)} ${String(PAGE_HEIGHT)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${String(contentId)} 0 R >>`)
      add(Buffer.concat([Buffer.from(`<< /Length ${String(content.length)} >>\nstream\n`, 'ascii'), content, Buffer.from('endstream', 'ascii')]))
    }
    const header = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')
    const chunks: Buffer[] = [header]
    const offsets: number[] = [0]
    let cursor = header.length
    for (const [index, object] of objects.entries()) {
      offsets.push(cursor)
      const chunk = Buffer.concat([Buffer.from(`${String(index + 1)} 0 obj\n`, 'ascii'), object, Buffer.from('\nendobj\n', 'ascii')])
      chunks.push(chunk)
      cursor += chunk.length
    }
    const xref = cursor
    chunks.push(Buffer.from(`xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`, 'ascii'))
    return Buffer.concat(chunks)
  }
}

const WEEKDAY_LABELS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']
const STATUS_LABELS = { completed: 'Concluída', missed: 'Não realizada', upcoming: 'Por vir' }
const EVALUATION_LABELS = { achieved: 'Alcançado', partial: 'Parcial', 'not-achieved': 'Não alcançado' }

function describeActivity(activity: ReportActivity, studentName: string): string {
  return `${activity.date} | ${studentName} | ${STATUS_LABELS[activity.status]} | ${activity.title}${activity.evaluation === null ? '' : ` | Avaliação: ${EVALUATION_LABELS[activity.evaluation]}`}`
}

/** PDF determinístico em estrutura e layout, gerado uma só vez pela API para web e mobile. */
@Injectable()
export class ReportsPdfService {
  render(report: Report): ReportPdf {
    const canvas = new PdfCanvas()
    canvas.text('HABITUAR', 19, true)
    canvas.text('Relatório de acompanhamento pedagógico', 15, true)
    canvas.space(7)
    canvas.paragraph(`Instituição: ${report.institution.name}`)
    canvas.text(`Período: ${report.range.from} até ${report.range.to}`)
    canvas.text(`Gerado em: ${report.generatedAt.slice(0, 19)} UTC | Fuso escolar: ${report.timeZone}`, 9)
    canvas.separator()
    canvas.text('Resumo das atividades', 13, true)
    canvas.text(`Concluídas: ${String(report.summary.completed)} | Não realizadas: ${String(report.summary.missed)} | Futuras: ${String(report.summary.upcoming)}`, 10)
    canvas.text(`Taxa de conclusão: ${percentage(report.summary.completionRate)} | Alunos acompanhados: ${String(report.students.length)}`)
    canvas.space(10)
    canvas.text('Atividades por dia da semana', 13, true)
    canvas.text('Quantidade não realizada', 9)
    canvas.bars(WEEKDAY_LABELS, report.byWeekday.map(row => row.missed))
    canvas.space(13)
    canvas.text('Indicadores por aluno', 13, true)
    canvas.text('Ordenados por taxa de conclusão; sem atividades não há classificação.', 9)
    canvas.separator()
    for (const student of report.students) {
      canvas.paragraph(`${student.name}: ${percentage(student.completionRate)} | Feitas: ${String(student.completed)} | Não feitas: ${String(student.missed)} | Futuras: ${String(student.upcoming)}`, 9, 94)
    }
    canvas.space(12)
    canvas.text('Detalhamento das atividades', 13, true)
    canvas.text('Cancelamentos não entram no total; remarcações usam a nova data.', 9)
    canvas.separator()
    const studentNames = new Map<string, string>(report.students.map(student => [student.id, student.name]))
    for (const activity of report.activities) {
      const content = describeActivity(activity, studentNames.get(activity.studentId) ?? 'Aluno')
      canvas.paragraph(content, 9, 95)
    }
    if (report.activities.length === 0) canvas.text('Nenhuma atividade prevista para o período.', 10)
    const bytes = canvas.finalize()
    return { filename: `habituar-relatorio-${report.range.from}-${report.range.to}.pdf`, mediaType: 'application/pdf', base64: bytes.toString('base64') }
  }
}
