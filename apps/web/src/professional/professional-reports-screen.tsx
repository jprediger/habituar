import { addDays, readLocalDateTime } from '@habituar/core/calendar'
import { reportFilterSchema } from '@habituar/core/reports'
import type { Report, ReportActivity, ReportFilter, ReportPdf } from '@habituar/core/reports'
import type { TaskKind } from '@habituar/core/tasks'
import type { TFunction } from 'i18next'
import { BarChart3, Download, RefreshCw } from 'lucide-react'
import { useId, useState } from 'react'
import type { ReactElement, SyntheticEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import { EmptyState } from '../components/ui/empty-state.js'
import { Input } from '../components/ui/input.js'
import { MetricTiles } from '../components/ui/metric-tiles.js'
import { PageHeader } from '../components/ui/page-header.js'
import { Section } from '../components/ui/section.js'
import { useInstitutionSession } from '../session/institution-session.js'
import { readCurrentTime } from '../time/current-time.js'
import { formatReportDate, formatReportRate, ReportsDailyChart, ReportsWeekdayChart } from './reports-charts.js'

function defaultRange(institutionId: ReportFilter['institutionId']): ReportFilter {
  const today = readLocalDateTime(readCurrentTime()).date
  return reportFilterSchema.parse({ institutionId, from: addDays(today, -29), to: today })
}

/** Inicia o download apenas após ação explícita, sem persistir dados de alunos no navegador. */
export function downloadReportPdf(pdf: ReportPdf): void {
  const binary = atob(pdf.base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: pdf.mediaType }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = pdf.filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => { URL.revokeObjectURL(url) }, 60_000)
}

/** Indicadores calculados pela API, com recorte por aluno e permissões por vínculo. */
export function ProfessionalReportsScreen(): ReactElement {
  const { t } = useTranslation('reports')
  const session = useInstitutionSession()
  const institutionId = session.membership.institution.id
  const [filter, setFilter] = useState<ReportFilter>(() => defaultRange(institutionId))
  const [from, setFrom] = useState<string>(filter.from)
  const [to, setTo] = useState<string>(filter.to)
  const [studentId, setStudentId] = useState<string>('')
  const [invalid, setInvalid] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportFailure, setExportFailure] = useState(false)
  const formId = useId()
  const studentSelectId = useId()
  const fromId = useId()
  const toId = useId()

  const allFilter: ReportFilter = { institutionId, from: filter.from, to: filter.to }
  const overview = habituar.useReport(session.membership, allFilter)
  const selected = habituar.useReport(session.membership, filter, filter.studentId !== undefined)
  const current = filter.studentId === undefined ? overview : selected

  function apply(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault()
    const parsed = reportFilterSchema.safeParse({
      institutionId,
      from,
      to,
      ...(studentId === '' ? {} : { studentId }),
    })
    if (!parsed.success) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setExportFailure(false)
    setFilter(parsed.data)
  }

  async function exportPdf(): Promise<void> {
    setExportFailure(false)
    setExporting(true)
    try {
      const pdf = await current.exportPdf()
      downloadReportPdf(pdf)
    } catch {
      setExportFailure(true)
    } finally {
      setExporting(false)
    }
  }

  const options = overview.state.status === 'ready' ? overview.state.report.students : []
  const exportScopeNarrower = current.canExport && session.membership.permissions.some(permission => permission.key === 'report.read' && permission.scope === 'institution') && !session.membership.permissions.some(permission => permission.key === 'report.export' && permission.scope === 'institution')

  return (
    <div className="flex flex-col gap-xxl">
      <div className="flex flex-wrap items-end justify-between gap-md">
        <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
        {current.canExport && (
          <Button type="button" disabled={current.state.status !== 'ready' || exporting} onClick={() => { void exportPdf() }}>
            <Download aria-hidden="true" className="size-4" />
            {exporting ? t('exporting') : t('exportPdf')}
          </Button>
        )}
      </div>

      <form id={formId} onSubmit={apply} className="rounded-field border border-hairline bg-surface p-lg flex flex-col gap-md" noValidate>
        <h2 className="text-body font-semibold text-text">{t('period')}</h2>
        <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-xs">
            <label htmlFor={fromId} className="text-caption font-medium text-text">{t('from')}</label>
            <Input id={fromId} type="date" value={from} required aria-invalid={invalid} onChange={(event) => { setFrom(event.target.value); setInvalid(false) }} />
          </div>
          <div className="flex flex-col gap-xs">
            <label htmlFor={toId} className="text-caption font-medium text-text">{t('to')}</label>
            <Input id={toId} type="date" value={to} required aria-invalid={invalid} onChange={(event) => { setTo(event.target.value); setInvalid(false) }} />
          </div>
          <div className="flex flex-col gap-xs">
            <label htmlFor={studentSelectId} className="text-caption font-medium text-text">{t('student')}</label>
            <select id={studentSelectId} className="min-h-tap-target w-full rounded-field border border-border bg-surface px-sm py-xs text-body text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring" value={studentId} onChange={(event) => { setStudentId(event.target.value) }}>
              <option value="">{t('allStudents')}</option>
              {options.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-md">
          <p className="text-caption text-text-muted">{t('filterHelp')}</p>
          <Button type="submit">{t('apply')}</Button>
        </div>
        {invalid && <p role="alert" className="text-caption text-danger">{t('invalidPeriod')}</p>}
      </form>

      {exportFailure && <p role="alert" className="text-body text-danger">{t('exportFailed')}</p>}
      {!current.canExport && <p className="text-caption text-text-muted">{t('exportPermission')}</p>}
      {exportScopeNarrower && <p role="note" className="text-caption text-text-muted">{t('exportScopeNarrower')}</p>}
      {(() => {
        switch (current.state.status) {
          case 'loading':
            return <p role="status" className="text-body text-text-muted">{t('loading')}</p>
          case 'failed':
            return (
              <div className="flex flex-col items-start gap-sm">
                <p role="alert" className="text-body text-danger">{t(current.state.failure === 'forbidden' ? 'forbidden' : current.state.failure === 'not-found' ? 'notFound' : 'failed')}</p>
                <Button variant="outline" type="button" onClick={() => { void current.refresh() }}><RefreshCw aria-hidden="true" className="size-4" />{t('retry')}</Button>
              </div>
            )
          case 'ready':
            return <ReportsContent report={current.state.report} />
        }
      })()}
    </div>
  )
}

function ReportsContent({ report }: Readonly<{ report: Report }>): ReactElement {
  const { t } = useTranslation('reports')
  const { summary, activities } = report
  const rate = summary.completionRate === null ? t('noRate') : formatReportRate(summary.completionRate)
  const generated = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: report.timeZone }).format(new Date(report.generatedAt))

  return (
    <>
      <Section title={t('summaryTitle')}>
        <MetricTiles items={[
          { label: t('completed'), value: String(summary.completed) },
          { label: t('missed'), value: String(summary.missed) },
          { label: t('completionRate'), value: rate, hint: t('rateHint') },
        ]} />
        <div className="flex flex-wrap gap-md text-caption text-text-muted">
          <span>{t('upcomingCount', { count: summary.upcoming })}</span>
          <span>{t('studentsCountValue', { count: report.students.length })}</span>
        </div>
      </Section>

      {activities.length === 0 ? (
        <EmptyState icon={BarChart3} title={t('noTasks')} description={t('emptyComparison')} />
      ) : (
        <>
          <ReportsWeekdayChart rows={report.byWeekday} />
          <ReportsDailyChart rows={report.byDay} />
          <ReportKinds report={report} />
        </>
      )}
      <ReportStudents report={report} />
      <ReportActivities report={report} />
      <p className="text-caption text-text-muted">{t('generatedMetadata', { date: generated, zone: report.timeZone })}</p>
    </>
  )
}

function ReportKinds({ report }: Readonly<{ report: Report }>): ReactElement {
  const { t } = useTranslation('reports')
  return (
    <Section title={t('kindsTitle')} description={t('kindsDescription')}>
      <div className="grid gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {report.byKind.filter((row) => row.total > 0).map((row) => (
          <div key={row.kind ?? 'none'} className="rounded-field border border-hairline bg-surface p-md">
            <p className="text-caption text-text-muted">{row.kind === null ? t('noKind') : taskKindLabel(row.kind, t)}</p>
            <p className="text-title font-semibold tabular-nums text-text">{row.total}</p>
            <p className="text-caption text-text-muted">{t('countSummary', row)}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

function taskKindLabel(kind: TaskKind, t: TFunction<'reports'>): string {
  switch (kind) {
    case 'class': return t('kindLabels.class')
    case 'study': return t('kindLabels.study')
    case 'therapy': return t('kindLabels.therapy')
    case 'activity': return t('kindLabels.activity')
    case 'rest': return t('kindLabels.rest')
    case 'other': return t('kindLabels.other')
  }
}

function ReportStudents({ report }: Readonly<{ report: Report }>): ReactElement {
  const { t } = useTranslation('reports')
  return (
    <Section title={t('comparisonTitle')} description={t('comparisonDescription')}>
      {report.students.length === 0 ? <p className="text-body text-text-muted">{t('emptyStudents')}</p> : (
        <div className="overflow-x-auto rounded-field border border-hairline bg-surface">
          <table className="w-full min-w-[35rem] border-collapse text-left text-body">
            <thead className="bg-surface-muted text-caption text-text-muted">
              <tr><th scope="col" className="px-md py-sm font-medium">{t('name')}</th><th scope="col" className="px-md py-sm text-right font-medium">{t('completed')}</th><th scope="col" className="px-md py-sm text-right font-medium">{t('missed')}</th><th scope="col" className="px-md py-sm text-right font-medium">{t('upcoming')}</th><th scope="col" className="px-md py-sm text-right font-medium">{t('completionRate')}</th></tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {report.students.map((student) => (
                <tr key={student.id}>
                  <th scope="row" className="px-md py-sm font-medium text-text">{student.name}</th>
                  <td className="px-md py-sm text-right tabular-nums">{student.completed}</td>
                  <td className="px-md py-sm text-right tabular-nums">{student.missed}</td>
                  <td className="px-md py-sm text-right tabular-nums">{student.upcoming}</td>
                  <td className="px-md py-sm text-right tabular-nums">{formatReportRate(student.completionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

function ReportActivities({ report }: Readonly<{ report: Report }>): ReactElement {
  const { t } = useTranslation('reports')
  const students = new Map(report.students.map((student) => [student.id, student.name]))
  const visible = report.activities.slice(0, 20)
  return (
    <Section title={t('detailsTitle')} description={t('detailsDescription')}>
      {visible.length === 0 ? <p className="text-body text-text-muted">{t('emptyActivities')}</p> : (
        <div className="overflow-x-auto rounded-field border border-hairline bg-surface">
          <table className="w-full min-w-[42rem] border-collapse text-left text-caption">
            <thead className="bg-surface-muted text-text-muted">
              <tr><th scope="col" className="px-md py-sm font-medium">{t('date')}</th><th scope="col" className="px-md py-sm font-medium">{t('student')}</th><th scope="col" className="px-md py-sm font-medium">{t('activity')}</th><th scope="col" className="px-md py-sm font-medium">{t('status')}</th><th scope="col" className="px-md py-sm font-medium">{t('evaluation')}</th></tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {visible.map((activity: ReportActivity) => (
                <tr key={`${activity.studentId}-${activity.taskId}-${activity.originalDate}`}>
                  <td className="px-md py-sm tabular-nums whitespace-nowrap">{formatReportDate(activity.date)}</td>
                  <td className="px-md py-sm">{students.get(activity.studentId) ?? t('student')}</td>
                  <th scope="row" className="px-md py-sm font-medium">{activity.title}</th>
                  <td className="px-md py-sm">{t(`statusLabels.${activity.status}`)}</td>
                  <td className="px-md py-sm">{activity.evaluation === null ? t('noEvaluation') : t(`evaluations.${activity.evaluation}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {report.activities.length > visible.length && <p className="text-caption text-text-muted">{t('limitedActivities', { count: report.activities.length })}</p>}
    </Section>
  )
}
