import { reportFilterSchema } from '@habituar/core/reports'
import type { Report, ReportCounters, ReportFilter } from '@habituar/core/reports'
import { SPACING } from '@habituar/design-tokens/spacing'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { ChoiceList } from '../components/ui/choice-list'
import { DateTimeField } from '../components/ui/date-time-field'
import { EmptyState } from '../components/ui/empty-state'
import { InlineNotice } from '../components/ui/inline-notice'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import { Section } from '../components/ui/section'
import { SummaryCard } from '../components/ui/summary-card'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { useThemeTokens } from '../theme/tokens'
import { readCurrentTime } from '../time/current-time'
import { formatReportDate, formatReportRate, initialReportFilter } from './report-format'
import { shareReportPdf } from './report-sharing'

/** O cliente compartilhado fornece o relatório autorizado e o PDF; o app só apresenta os dados. */
export function ProfessionalReportsScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation('reports')
  const institutionId = session.membership.institution.id
  const [filter, setFilter] = useState<ReportFilter>(() => initialReportFilter(institutionId, readCurrentTime()))
  const [from, setFrom] = useState<string>(filter.from)
  const [to, setTo] = useState<string>(filter.to)
  const [studentId, setStudentId] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportFailure, setExportFailure] = useState(false)

  const overview = habituar.useReport(session.membership, {
    institutionId, from: filter.from, to: filter.to,
  })
  const selected = habituar.useReport(session.membership, filter, filter.studentId !== undefined)
  const current = filter.studentId === undefined ? overview : selected

  function applyFilters(): void {
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
      await shareReportPdf(pdf)
    } catch {
      setExportFailure(true)
    } finally {
      setExporting(false)
    }
  }

  const choices = [
    { value: '', label: t('allStudents') },
    ...(overview.state.status === 'ready'
      ? overview.state.report.students.map((student) => ({ value: student.id, label: student.name }))
      : []),
  ]
  const exportScopeNarrower = current.canExport
    && session.membership.permissions.some((permission) => permission.key === 'report.read' && permission.scope === 'institution')
    && !session.membership.permissions.some((permission) => permission.key === 'report.export' && permission.scope === 'institution')

  return (
    <Page>
      <PageHeader eyebrow={session.membership.institution.name} title={t('title')} />
      <Section title={t('period')}>
        <View style={styles.filters}>
          <View style={styles.field}>
            <Text weight="medium">{t('from')}</Text>
            <DateTimeField
              mode="date" value={from} initialDate={new Date()}
              onChange={(value) => { setFrom(value); setInvalid(false) }}
              accessibilityLabel={t('from')} accessibilityHint={t('filterHelp')} hasError={invalid}
            />
          </View>
          <View style={styles.field}>
            <Text weight="medium">{t('to')}</Text>
            <DateTimeField
              mode="date" value={to} initialDate={new Date()}
              onChange={(value) => { setTo(value); setInvalid(false) }}
              accessibilityLabel={t('to')} accessibilityHint={t('filterHelp')} hasError={invalid}
            />
          </View>
          <ChoiceList label={t('student')} choices={choices} value={studentId} onChange={setStudentId} />
          <Text size="caption" tone="muted">{t('filterHelp')}</Text>
          {invalid && <Text accessibilityRole="alert" tone="danger">{t('invalidPeriod')}</Text>}
          <Button label={t('apply')} onPress={applyFilters} />
        </View>
      </Section>

      {current.canExport ? (
        <Button
          label={exporting ? t('exporting') : t('exportPdf')}
          icon="clipboard-text"
          variant="outline"
          isDisabled={current.state.status !== 'ready' || exporting}
          isBusy={exporting}
          onPress={() => { void exportPdf() }}
        />
      ) : <InlineNotice message={t('exportPermission')} />}
      {exportScopeNarrower && <InlineNotice message={t('exportScopeNarrower')} />}
      {exportFailure && <Text accessibilityRole="alert" tone="danger">{t('exportFailed')}</Text>}

      {current.state.status === 'loading' && <Text accessibilityRole="text" tone="muted">{t('loading')}</Text>}
      {current.state.status === 'failed' && (
        <View style={styles.filters}>
          <Text accessibilityRole="alert" tone="danger">
            {t(current.state.failure === 'forbidden' ? 'forbidden' : current.state.failure === 'not-found' ? 'notFound' : 'failed')}
          </Text>
          <Button variant="outline" label={t('retry')} onPress={() => { void current.refresh() }} />
        </View>
      )}
      {current.state.status === 'ready' && <ReportContent report={current.state.report} />}
    </Page>
  )
}

function ReportContent({ report }: Readonly<{ report: Report }>) {
  const { t } = useTranslation('reports')
  const { summary, activities } = report
  const tiles = [
    { key: 'completed', label: t('completed'), value: String(summary.completed) },
    { key: 'missed', label: t('missed'), value: String(summary.missed) },
    { key: 'upcoming', label: t('upcoming'), value: String(summary.upcoming) },
    { key: 'rate', label: t('completionRate'), value: summary.completionRate === null ? t('noRate') : formatReportRate(summary.completionRate) },
  ]

  return (
    <>
      <Section title={t('summaryTitle')}>
        <View style={styles.tiles}>
          {tiles.map((tile) => (
            <View key={tile.key} style={styles.tile}>
              <Card>
                <Text size="caption" tone="muted">{tile.label}</Text>
                <Text size="title" weight="bold">{tile.value}</Text>
              </Card>
            </View>
          ))}
        </View>
        <Text size="caption" tone="muted">{t('rateHint')}</Text>
        <Text size="caption" tone="muted">{t('studentsCount', { count: report.students.length })}</Text>
      </Section>

      {activities.length === 0 ? (
        <EmptyState title={t('noTasks')} description={t('emptyActivities')} />
      ) : (
        <>
          <ReportBarSection title={t('weekdaysTitle')} rows={report.byWeekday.map((row) => ({
            key: String(row.weekday), label: t(`weekdayNames.${weekdayKey(row.weekday)}`), counters: row,
          }))} />
          <ReportBarSection title={t('dailyTitle')} rows={report.byDay.slice(-14).map((row) => ({
            key: row.date, label: formatReportDate(row.date), counters: row,
          }))} />
          <Section title={t('kindsTitle')}>
            {report.byKind.filter((row) => row.total > 0).map((row) => (
              <SummaryCard key={row.kind ?? 'uncategorized'} items={[
                { label: row.kind === null ? t('noKind') : t(`kindLabels.${row.kind}`), value: t('countSummary', row) },
              ]} />
            ))}
          </Section>
        </>
      )}

      <Section title={t('comparisonTitle')}>
        <Text tone="muted" size="caption">{t('comparisonDescription')}</Text>
        {report.students.length === 0 ? <Text tone="muted">{t('emptyStudents')}</Text> : report.students.map((student) => (
          <SummaryCard key={student.id} items={[
            { label: student.name, value: t('countSummary', student) },
            { label: t('completionRate'), value: student.completionRate === null ? t('noRate') : formatReportRate(student.completionRate) },
          ]} />
        ))}
      </Section>

      <Section title={t('detailsTitle')}>
        <Text size="caption" tone="muted">{t('detailsDescription')}</Text>
        {activities.length === 0 ? <Text tone="muted">{t('emptyActivities')}</Text> : activities.slice(-20).reverse().map((activity) => {
          const student = report.students.find((item) => item.id === activity.studentId)
          return (
            <SummaryCard
              key={`${activity.studentId}-${activity.taskId}-${activity.originalDate}`}
              items={[
                { label: `${formatReportDate(activity.date)} · ${student?.name ?? t('unknownStudent')}`, value: activity.title },
                { label: t(`statusLabels.${activity.status}`), value: activity.evaluation === null ? t('noEvaluation') : t(`evaluations.${activity.evaluation}`) },
              ]}
            />
          )
        })}
        {activities.length > 20 && <Text size="caption" tone="muted">{t('limitedActivities', { count: activities.length })}</Text>}
      </Section>
      <Text size="caption" tone="muted">{t('generatedAt', { date: new Date(report.generatedAt).toLocaleString('pt-BR', { timeZone: report.timeZone }) })}</Text>
      <Text size="caption" tone="muted">{t('timeZone', { zone: report.timeZone })}</Text>
    </>
  )
}

type ReportBarItem = Readonly<{ key: string; label: string; counters: ReportCounters }>

function ReportBarSection({ title, rows }: Readonly<{ title: string; rows: readonly ReportBarItem[] }>) {
  const { t } = useTranslation('reports')
  const { colors, radius } = useThemeTokens()
  const largest = Math.max(1, ...rows.map((row) => row.counters.total))
  return (
    <Section title={title}>
      {rows.map(({ key, label, counters }) => (
        <View key={key} style={styles.barItem}>
          <Text weight="medium" size="caption">{label}</Text>
          <View
            accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
            style={[styles.barTrack, { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill }]}
          >
            {counters.total > 0 && (
              <View style={[styles.bar, { width: percent(counters.total / largest) }]}>
                {counters.completed > 0 && <View style={{ flex: counters.completed, backgroundColor: colors.primary }} />}
                {counters.missed > 0 && <View style={{ flex: counters.missed, backgroundColor: colors.danger }} />}
                {counters.upcoming > 0 && <View style={{ flex: counters.upcoming, backgroundColor: colors.border }} />}
              </View>
            )}
          </View>
          <Text size="caption" tone="muted">{t('countSummary', counters)}</Text>
        </View>
      ))}
    </Section>
  )
}

function percent(fraction: number): `${number}%` {
  const value = `${String(Math.round(fraction * 100))}%`
  return isPercentage(value) ? value : '0%'
}

function isPercentage(value: string): value is `${number}%` {
  return /^\d+%$/.test(value)
}

function weekdayKey(day: number): 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' {
  const keys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
  return keys[day - 1] ?? 'monday'
}

const styles = StyleSheet.create({
  filters: { gap: SPACING.lg },
  field: { gap: SPACING.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  tile: { width: '48%', minWidth: 120, flexGrow: 1 },
  barItem: { gap: SPACING.xs },
  barTrack: { height: SPACING.md, overflow: 'hidden' },
  bar: { flexDirection: 'row', height: '100%' },
})
