// Campos explícitos em vez de `dateStyle`: o Intl do Hermes não garante as opções de estilo
// em todo Android, e as partes numéricas dão o mesmo resultado em pt-BR.
const DATE_TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const DAY_MONTH_TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const DAY_LABEL_FORMAT = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' })
const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })

/** Dia e hora sem o ano, para quando o ano já está no título do grupo. */
export function formatRecordDayAndTime(iso: string): string {
  return DAY_MONTH_TIME_FORMAT.format(new Date(iso))
}

/** Dia de calendário local por extenso ("4 de novembro"), para título de grupo. */
export function formatCalendarDayLabel(year: number, month: number, day: number): string {
  return DAY_LABEL_FORMAT.format(new Date(year, month - 1, day))
}

/** Mês de calendário local por extenso ("Outubro de 2026"), para título de grupo. */
export function formatCalendarMonthLabel(year: number, month: number): string {
  const label = MONTH_LABEL_FORMAT.format(new Date(year, month - 1, 1))
  // Em pt-BR o nome do mês é minúsculo no meio da frase, mas aqui ele abre o título.
  return label.charAt(0).toLocaleUpperCase('pt-BR') + label.slice(1)
}

/** Instante gravado pela API (UTC), mostrado com hora no fuso de quem lê. */
export function formatRecordDateTime(iso: string): string {
  return DATE_TIME_FORMAT.format(new Date(iso))
}

/** Dia de um instante gravado pela API, no fuso de quem lê. */
export function formatRecordDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso))
}

/** Hora de um instante gravado pela API, no fuso de quem lê. */
export function formatRecordTime(iso: string): string {
  return TIME_FORMAT.format(new Date(iso))
}

/** Data de calendário sem fuso: passar por `Date` a deslocaria um dia a oeste de UTC. */
export function formatCalendarDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`
}
