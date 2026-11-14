import type { Report, ReportActivity, ReportPdf, ReportStudent } from '@habituar/core/reports'
import { Injectable } from '@nestjs/common'

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 42
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const BOTTOM = 65

const COLOR = {
  ink: '#203B40',
  muted: '#62777A',
  primary: '#146F6C',
  primaryLight: '#E9F4F1',
  paper: '#FFFFFF',
  surface: '#F6F9F8',
  line: '#DCE6E4',
  completed: '#17826C',
  missed: '#B45B51',
  upcoming: '#587FAB',
  empty: '#D8E1DF',
} as const

type Page = { commands: string[]; y: number }
type Paint = keyof typeof COLOR

type GroupedCount = Readonly<{ label: string; completed: number; missed: number; upcoming: number }>

function printable(text: string): string {
  return text.normalize('NFC').replace(/\p{Cc}/gu, ' ').replace(/[\u2010-\u2015]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, '?')
}

function pdfString(text: string): string {
  return printable(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function number(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '')
}

function color(name: Paint): string {
  const hex = COLOR[name].slice(1)
  return [0, 2, 4].map(offset => number(parseInt(hex.slice(offset, offset + 2), 16) / 255)).join(' ')
}

function textWidth(text: string, size: number, bold = false): number {
  return Array.from(printable(text)).reduce((width, character) => {
    if ('il.,:;!|\' '.includes(character)) return width + size * 0.25
    if ('MW@%'.includes(character)) return width + size * 0.86
    if ('ABCDEFGHJKLMNOPQRSTUVWXYZ'.includes(character)) return width + size * (bold ? 0.68 : 0.65)
    return width + size * (bold ? 0.55 : 0.51)
  }, 0)
}

function wrap(text: string, maxWidth: number, fontSize: number, bold = false): string[] {
  const words = printable(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (textWidth(candidate, fontSize, bold) <= maxWidth) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    let remaining = word
    while (textWidth(remaining, fontSize, bold) > maxWidth && remaining.length > 1) {
      let end = 1
      while (end < remaining.length && textWidth(remaining.slice(0, end + 1), fontSize, bold) <= maxWidth) end++
      lines.push(remaining.slice(0, end))
      remaining = remaining.slice(end)
    }
    line = remaining
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function percent(value: number | null): string {
  return value === null ? 'Sem dados' : `${number(value).replace('.', ',')}%`
}

function dateLabel(value: string): string {
  const [year = '', month = '', day = ''] = value.split('-')
  return `${day}/${month}/${year}`
}

function shortDate(value: string): string {
  const [, month = '', day = ''] = value.split('-')
  return `${day}/${month}`
}

function count(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const KIND_LABELS = {
  class: 'Aulas',
  study: 'Estudos',
  therapy: 'Terapias',
  activity: 'Atividades',
  rest: 'Descanso',
  other: 'Outras',
} as const
const STATUS_LABELS = { completed: 'Concluída', missed: 'Não realizada', upcoming: 'Futura' } as const
const EVALUATION_LABELS = { achieved: 'Alcançado', partial: 'Parcial', 'not-achieved': 'Não alcançado' } as const

class PdfCanvas {
  private readonly pages: Page[] = []
  private page: Page

  constructor() {
    this.page = this.newPage(true)
  }

  private newPage(first: boolean): Page {
    const page: Page = { commands: [], y: first ? 690 : 771 }
    this.pages.push(page)
    this.rect(0, PAGE_HEIGHT - 8, PAGE_WIDTH, 8, 'primary', page)
    if (!first) {
      this.write('HABITUAR', MARGIN, 796, 10, true, 'primary', page)
      this.write('RELATÓRIO PEDAGÓGICO', PAGE_WIDTH - MARGIN, 796, 8, false, 'muted', page, true)
      this.rule(781, page)
    }
    return page
  }

  private command(value: string, page: Page = this.page): void {
    page.commands.push(value)
  }

  private rect(x: number, y: number, width: number, height: number, paint: Paint, page: Page = this.page): void {
    if (width <= 0 || height <= 0) return
    this.command(`${color(paint)} rg ${number(x)} ${number(y)} ${number(width)} ${number(height)} re f`, page)
  }

  private write(text: string, x: number, y: number, size: number, bold = false, paint: Paint = 'ink', page: Page = this.page, right = false): void {
    const position = right ? x - textWidth(text, size, bold) : x
    this.command(`${color(paint)} rg BT /${bold ? 'F2' : 'F1'} ${number(size)} Tf ${number(position)} ${number(y)} Td (${pdfString(text)}) Tj ET`, page)
  }

  private rule(y: number, page: Page = this.page): void {
    this.rect(MARGIN, y, CONTENT_WIDTH, 0.8, 'line', page)
  }

  private ensure(height: number): boolean {
    if (this.page.y - height >= BOTTOM) return false
    this.page = this.newPage(false)
    return true
  }

  header(report: Report): void {
    const nameLines = wrap(report.institution.name, CONTENT_WIDTH, 9.5)
    const extra = (nameLines.length - 1) * 12
    this.rect(0, 712 - extra, PAGE_WIDTH, 130 + extra, 'ink')
    this.rect(MARGIN, 797, 33, 3, 'completed')
    this.write('HABITUAR', MARGIN, 813, 12, true, 'paper')
    this.write('RELATÓRIO DE ACOMPANHAMENTO', MARGIN, 770, 18, true, 'paper')
    this.write('PEDAGÓGICO', MARGIN, 747, 18, true, 'paper')
    for (const [index, line] of nameLines.entries()) this.write(line, MARGIN, 728 - index * 12, 9.5, false, 'paper')
    this.write(`${dateLabel(report.range.from)} a ${dateLabel(report.range.to)}`, MARGIN, 695 - extra, 8.5, true, 'muted')
    this.write(`Gerado em ${dateLabel(report.generatedAt.slice(0, 10))}  |  ${report.timeZone}`, PAGE_WIDTH - MARGIN, 695 - extra, 8, false, 'muted', this.page, true)
    this.page.y -= extra
  }

  heading(title: string, hint?: string, contentHeight = 0): void {
    this.ensure(53 + contentHeight)
    this.write(title, MARGIN, this.page.y - 15, 13, true)
    this.page.y -= 30
    if (hint) {
      for (const line of wrap(hint, CONTENT_WIDTH, 8)) {
        this.write(line, MARGIN, this.page.y, 8, false, 'muted')
        this.page.y -= 13
      }
    }
    this.page.y -= 10
  }

  cards(items: readonly Readonly<{ label: string; value: string; detail: string; accent: Paint }>[]): void {
    this.ensure(103)
    const gap = 8
    const width = (CONTENT_WIDTH - gap * 3) / 4
    for (const [index, item] of items.entries()) {
      const x = MARGIN + index * (width + gap)
      const y = this.page.y - 78
      this.rect(x, y, width, 78, 'surface')
      this.rect(x, y + 74, width, 4, item.accent)
      this.write(item.label, x + 11, y + 55, 8, true, 'muted')
      this.write(item.value, x + 11, y + 29, item.value.length > 8 ? 15 : 22, true)
      this.write(item.detail, x + 11, y + 12, 7.5, false, 'muted')
    }
    this.page.y -= 102
  }

  legend(y: number, x = MARGIN): void {
    const entries: readonly [Paint, string][] = [['completed', 'Concluídas'], ['missed', 'Não realizadas'], ['upcoming', 'Futuras']]
    let position = x
    for (const [paint, label] of entries) {
      this.rect(position, y - 1, 8, 8, paint)
      this.write(label, position + 13, y, 8, false, 'muted')
      position += textWidth(label, 8) + 33
    }
  }

  overview(completed: number, missed: number, upcoming: number): void {
    this.heading('Distribuição das ocorrências', 'Cada segmento mostra a quantidade de atividades no período.', 55)
    const total = completed + missed + upcoming
    const y = this.page.y - 17
    this.rect(MARGIN, y, CONTENT_WIDTH, 15, 'empty')
    let x = MARGIN
    for (const [value, paint] of [[completed, 'completed'], [missed, 'missed'], [upcoming, 'upcoming']] as const) {
      const width = total === 0 ? 0 : CONTENT_WIDTH * value / total
      this.rect(x, y, width, 15, paint)
      x += width
    }
    this.legend(y - 21)
    this.page.y -= 67
  }

  stackedRows(rows: readonly GroupedCount[]): void {
    const height = rows.length * 26 + 8
    this.heading('Atividades por dia da semana', 'Concluídas, não realizadas e futuras, agrupadas pelo dia previsto.', height)
    const max = Math.max(1, ...rows.map(row => row.completed + row.missed + row.upcoming))
    const barX = MARGIN + 102
    const barWidth = CONTENT_WIDTH - 153
    for (const row of rows) {
      const y = this.page.y - 3
      this.write(row.label, MARGIN + 2, y + 2, 9)
      this.rect(barX, y, barWidth, 10, 'surface')
      let x = barX
      for (const [value, paint] of [[row.completed, 'completed'], [row.missed, 'missed'], [row.upcoming, 'upcoming']] as const) {
        const width = barWidth * value / max
        this.rect(x, y, width, 10, paint)
        x += width
      }
      this.write(count(row.completed + row.missed + row.upcoming), MARGIN + CONTENT_WIDTH - 1, y + 2, 9, true, 'ink', this.page, true)
      this.page.y -= 26
    }
    this.page.y -= 9
  }

  categories(rows: readonly GroupedCount[]): void {
    this.heading('Tipos de atividade', 'Distribuição das ocorrências por categoria.', rows.length * 25 + 15)
    const max = Math.max(1, ...rows.map(row => row.completed + row.missed + row.upcoming))
    const barX = MARGIN + 103
    const barWidth = CONTENT_WIDTH - 153
    for (const row of rows) {
      const y = this.page.y - 3
      this.write(row.label, MARGIN + 2, y + 2, 9)
      this.rect(barX, y, barWidth, 10, 'surface')
      let x = barX
      for (const [value, paint] of [[row.completed, 'completed'], [row.missed, 'missed'], [row.upcoming, 'upcoming']] as const) {
        const width = barWidth * value / max
        this.rect(x, y, width, 10, paint)
        x += width
      }
      this.write(count(row.completed + row.missed + row.upcoming), MARGIN + CONTENT_WIDTH - 1, y + 2, 9, true, 'ink', this.page, true)
      this.page.y -= 25
    }
    this.page.y -= 15
  }

  timeline(days: Report['byDay']): void {
    const bucketCount = Math.min(26, Math.max(1, days.length))
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const start = Math.floor(index * days.length / bucketCount)
      const end = Math.floor((index + 1) * days.length / bucketCount)
      const values = days.slice(start, end)
      return {
        completed: values.reduce((sum, day) => sum + day.completed, 0),
        missed: values.reduce((sum, day) => sum + day.missed, 0),
        upcoming: values.reduce((sum, day) => sum + day.upcoming, 0),
      }
    })
    const interval = Math.ceil(days.length / bucketCount)
    this.heading('Evolução no período', interval > 1 ? `Cada coluna reúne até ${String(interval)} dias consecutivos.` : 'Cada coluna representa um dia.', 150)
    const max = Math.max(1, ...buckets.map(bucket => bucket.completed + bucket.missed + bucket.upcoming))
    const base = this.page.y - 112
    const chartHeight = 106
    const slot = CONTENT_WIDTH / bucketCount
    this.rect(MARGIN, base, CONTENT_WIDTH, 0.7, 'line')
    for (const [index, bucket] of buckets.entries()) {
      const x = MARGIN + index * slot + slot * 0.16
      const width = slot * 0.68
      let y = base
      for (const [value, paint] of [[bucket.completed, 'completed'], [bucket.missed, 'missed'], [bucket.upcoming, 'upcoming']] as const) {
        const height = chartHeight * value / max
        this.rect(x, y, width, height, paint)
        y += height
      }
    }
    if (days.length > 0) {
      this.write(shortDate(days[0]?.date ?? ''), MARGIN, base - 16, 8, false, 'muted')
      this.write(shortDate(days[Math.floor((days.length - 1) / 2)]?.date ?? ''), MARGIN + CONTENT_WIDTH / 2, base - 16, 8, false, 'muted', this.page, true)
      this.write(shortDate(days[days.length - 1]?.date ?? ''), MARGIN + CONTENT_WIDTH, base - 16, 8, false, 'muted', this.page, true)
    }
    this.legend(base - 34)
    this.page.y = base - 61
  }

  private studentHeader(): void {
    const y = this.page.y - 19
    this.rect(MARGIN, y - 6, CONTENT_WIDTH, 29, 'primaryLight')
    this.write('ESTUDANTE', MARGIN + 10, y + 5, 8, true, 'primary')
    this.write('CONCLUÍDAS', MARGIN + 275, y + 5, 8, true, 'primary', this.page, true)
    this.write('NÃO FEITAS', MARGIN + 353, y + 5, 8, true, 'primary', this.page, true)
    this.write('FUTURAS', MARGIN + 423, y + 5, 8, true, 'primary', this.page, true)
    this.write('TAXA', MARGIN + CONTENT_WIDTH - 10, y + 5, 8, true, 'primary', this.page, true)
    this.page.y -= 35
  }

  studentTable(students: readonly ReportStudent[]): void {
    this.heading('Acompanhamento por estudante', 'Indicadores do período, sem avaliação de desempenho individual.', 66)
    this.studentHeader()
    if (students.length === 0) {
      this.write('Nenhum estudante no escopo selecionado.', MARGIN + 10, this.page.y - 14, 9, false, 'muted')
      this.page.y -= 44
      return
    }
    for (const [index, student] of students.entries()) {
      const nameLines = wrap(student.name, 188, 9.5, true)
      const height = Math.max(42, nameLines.length * 13 + 23)
      if (this.ensure(height + 7)) this.studentHeader()
      const top = this.page.y
      if (index % 2 === 0) this.rect(MARGIN, top - height, CONTENT_WIDTH, height, 'surface')
      for (const [lineIndex, line] of nameLines.entries()) this.write(line, MARGIN + 10, top - 16 - lineIndex * 13, 9.5, true)
      const barY = top - height + 10
      this.rect(MARGIN + 10, barY, 172, 4, 'empty')
      if (student.completionRate !== null) this.rect(MARGIN + 10, barY, 172 * student.completionRate / 100, 4, 'completed')
      this.write(count(student.completed), MARGIN + 275, top - 22, 10, false, 'ink', this.page, true)
      this.write(count(student.missed), MARGIN + 353, top - 22, 10, false, 'ink', this.page, true)
      this.write(count(student.upcoming), MARGIN + 423, top - 22, 10, false, 'ink', this.page, true)
      this.write(percent(student.completionRate), MARGIN + CONTENT_WIDTH - 10, top - 22, 9, true, 'primary', this.page, true)
      this.page.y -= height + 2
    }
    this.page.y -= 16
  }

  private activityHeader(): void {
    const y = this.page.y - 17
    this.rect(MARGIN, y - 6, CONTENT_WIDTH, 28, 'primaryLight')
    this.write('DATA', MARGIN + 8, y + 4, 8, true, 'primary')
    this.write('ESTUDANTE', MARGIN + 79, y + 4, 8, true, 'primary')
    this.write('ATIVIDADE', MARGIN + 190, y + 4, 8, true, 'primary')
    this.write('SITUAÇÃO', MARGIN + 361, y + 4, 8, true, 'primary')
    this.page.y -= 33
  }

  activityTable(activities: readonly ReportActivity[], studentNames: ReadonlyMap<string, string>): void {
    this.heading('Detalhamento das atividades', 'Canceladas não entram no total; reagendadas usam a data efetiva.', 65)
    this.activityHeader()
    if (activities.length === 0) {
      this.write('Nenhuma atividade prevista para o período.', MARGIN + 8, this.page.y - 16, 9, false, 'muted')
      this.page.y -= 42
      return
    }
    for (const [index, activity] of activities.entries()) {
      const student = wrap(studentNames.get(activity.studentId) ?? 'Estudante', 100, 8.5)
      const title = wrap(activity.title, 155, 8.8, true)
      const kind = activity.kind === null ? 'Sem categoria' : KIND_LABELS[activity.kind]
      const evaluation = activity.evaluation === null ? '' : `Avaliação: ${EVALUATION_LABELS[activity.evaluation]}`
      const status = STATUS_LABELS[activity.status]
      const statusLines = wrap(status, 107, 8.5, true)
      const height = Math.max(46, 19 + Math.max(student.length * 12, title.length * 12 + 11, statusLines.length * 12 + (evaluation ? 13 : 0)))
      if (this.ensure(height + 8)) this.activityHeader()
      const top = this.page.y
      if (index % 2 === 0) this.rect(MARGIN, top - height, CONTENT_WIDTH, height, 'surface')
      this.write(dateLabel(activity.date), MARGIN + 8, top - 16, 8.5)
      for (const [lineIndex, line] of student.entries()) this.write(line, MARGIN + 79, top - 16 - lineIndex * 12, 8.5)
      for (const [lineIndex, line] of title.entries()) this.write(line, MARGIN + 190, top - 16 - lineIndex * 12, 8.8, true)
      this.write(kind, MARGIN + 190, top - 16 - title.length * 12, 7.8, false, 'muted')
      const statusPaint = activity.status === 'completed' ? 'completed' : activity.status === 'missed' ? 'missed' : 'upcoming'
      this.rect(MARGIN + 353, top - 20, 3, 12, statusPaint)
      for (const [lineIndex, line] of statusLines.entries()) this.write(line, MARGIN + 361, top - 16 - lineIndex * 12, 8.5, true)
      if (evaluation) {
        for (const [lineIndex, line] of wrap(evaluation, 111, 7.8).entries()) this.write(line, MARGIN + 361, top - 16 - statusLines.length * 12 - lineIndex * 10, 7.8, false, 'muted')
      }
      this.page.y -= height + 2
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
      this.rect(0, 0, PAGE_WIDTH, 1, 'line', page)
      this.write('HABITUAR  |  Acompanhamento pedagógico', MARGIN, 32, 8, false, 'muted', page)
      this.write(`Página ${String(index + 1)} de ${String(this.pages.length)}`, PAGE_WIDTH - MARGIN, 32, 8, false, 'muted', page, true)
      const contentId = 6 + index * 2
      const stream = Buffer.from(page.commands.join('\n') + '\n', 'latin1')
      add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${String(PAGE_WIDTH)} ${String(PAGE_HEIGHT)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${String(contentId)} 0 R >>`)
      add(Buffer.concat([Buffer.from(`<< /Length ${String(stream.length)} >>\nstream\n`, 'ascii'), stream, Buffer.from('endstream', 'ascii')]))
    }
    const header = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')
    const chunks: Buffer[] = [header]
    const offsets: number[] = [0]
    let position = header.length
    for (const [index, object] of objects.entries()) {
      offsets.push(position)
      const chunk = Buffer.concat([Buffer.from(`${String(index + 1)} 0 obj\n`, 'ascii'), object, Buffer.from('\nendobj\n', 'ascii')])
      chunks.push(chunk)
      position += chunk.length
    }
    chunks.push(Buffer.from(`xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(position)}\n%%EOF\n`, 'ascii'))
    return Buffer.concat(chunks)
  }
}

@Injectable()
export class ReportsPdfService {
  render(report: Report): ReportPdf {
    const canvas = new PdfCanvas()
    canvas.header(report)
    canvas.cards([
      { label: 'CONCLUÍDAS', value: count(report.summary.completed), detail: 'No período', accent: 'completed' },
      { label: 'NÃO REALIZADAS', value: count(report.summary.missed), detail: 'Dias encerrados', accent: 'missed' },
      { label: 'FUTURAS', value: count(report.summary.upcoming), detail: 'Inclui hoje', accent: 'upcoming' },
      { label: 'TAXA DE CONCLUSÃO', value: percent(report.summary.completionRate), detail: `${count(report.students.length)} estudante(s)`, accent: 'primary' },
    ])
    canvas.overview(report.summary.completed, report.summary.missed, report.summary.upcoming)
    canvas.stackedRows(report.byWeekday.map(row => ({ label: WEEKDAYS[row.weekday - 1] ?? '', completed: row.completed, missed: row.missed, upcoming: row.upcoming })))
    canvas.categories(report.byKind.map(row => ({ label: row.kind === null ? 'Sem categoria' : KIND_LABELS[row.kind], completed: row.completed, missed: row.missed, upcoming: row.upcoming })))
    canvas.timeline(report.byDay)
    canvas.studentTable(report.students)
    const names = new Map(report.students.map(student => [student.id, student.name]))
    canvas.activityTable(report.activities, names)
    const bytes = canvas.finalize()
    return { filename: `habituar-relatorio-${report.range.from}-${report.range.to}.pdf`, mediaType: 'application/pdf', base64: bytes.toString('base64') }
  }
}
