import { reportFilterSchema } from '@habituar/core/reports'
import type { Report, ReportCounters, ReportFilter } from '@habituar/core/reports'
import { SPACING } from '@habituar/design-tokens/spacing'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { ChoiceList } from '../components/ui/choice-list'
import { DateTimeField } from '../components/ui/date-time-field'
import { EmptyState } from '../components/ui/empty-state'
import { InlineNotice } from '../components/ui/inline-notice'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import { Section } from '../components/ui/section'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { useThemeTokens } from '../theme/tokens'
import { readCurrentTime } from '../time/current-time'
import { formatReportDate, formatReportRate, initialReportFilter } from './report-format'
import { saveReportPdf } from './report-file'

/** O servidor controla indicadores e escopo; o app apresenta o mesmo recorte do PDF. */
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
  const [exportResult, setExportResult] = useState<'saved' | 'file-options' | null>(null)

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
    setExportResult(null)
    setFilter(parsed.data)
  }

  async function exportPdf(): Promise<void> {
    setExportFailure(false)
    setExportResult(null)
    setExporting(true)
    try {
      const pdf = await current.exportPdf()
      const result = await saveReportPdf(pdf)
      if (result !== 'cancelled') setExportResult(result)
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
          <Text tone="muted">{t('filterHelp')}</Text>
          {invalid && <Text accessibilityRole="alert" tone="danger">{t('invalidPeriod')}</Text>}
          <Button label={t('apply')} onPress={applyFilters} />
        </View>
      </Section>

      {current.canExport ? (
        <View style={styles.filters}>
          <Button
            label={exporting ? t('exporting') : Platform.OS === 'android' ? t('savePdf') : t('savePdfIos')}
            isDisabled={current.state.status !== 'ready' || exporting}
            isBusy={exporting}
            onPress={() => { void exportPdf() }}
          />
          <Text tone="muted">{t(Platform.OS === 'android' ? 'saveHelpAndroid' : 'saveHelpIos')}</Text>
        </View>
      ) : <InlineNotice message={t('exportPermission')} />}
      {exportScopeNarrower && <InlineNotice message={t('exportScopeNarrower')} />}
      {exportFailure && <Text accessibilityRole="alert" tone="danger">{t('exportFailed')}</Text>}
      {exportResult !== null && <Text accessibilityRole="alert" tone="primary">{t(exportResult === 'saved' ? 'savedPdf' : 'fileOptionsPdf')}</Text>}

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
  const { colors, radius } = useThemeTokens()
  const { summary, activities } = report
  const tiles = [
    { key: 'completed', label: t('completed'), value: String(summary.completed), accent: colors.primary },
    { key: 'missed', label: t('missed'), value: String(summary.missed), accent: colors.danger },
    { key: 'upcoming', label: t('upcoming'), value: String(summary.upcoming), accent: colors.info },
    { key: 'rate', label: t('completionRate'), value: summary.completionRate === null ? t('noRate') : formatReportRate(summary.completionRate), accent: colors.primary },
  ]

  return (
    <>
      <Section title={t('summaryTitle')}>
        <View style={styles.tiles}>
          {tiles.map((tile) => (
            <View key={tile.key} style={[styles.tile, { backgroundColor: colors.surfaceMuted, borderRadius: radius.surface, borderTopColor: tile.accent }]}>
              <Text weight="medium">{tile.label}</Text>
              <Text size={tile.key === 'rate' && summary.completionRate === null ? 'body' : 'display'} weight="bold">{tile.value}</Text>
            </View>
          ))}
        </View>
        <Text tone="muted">{t('rateHint')}</Text>
        <Text tone="muted">{t('studentsCount', { count: report.students.length })}</Text>
      </Section>

      <Section title={t('distributionTitle')}>
        <Text tone="muted">{t('distributionDescription')}</Text>
        <ReportStatusBar counters={summary} />
        <ReportCounts counters={summary} />
      </Section>

      {activities.length === 0 ? (
        <EmptyState title={t('noTasks')} description={t('emptyActivities')} />
      ) : (
        <>
          <ReportBarSection title={t('weekdaysTitle')} rows={report.byWeekday.map((row) => ({
            key: String(row.weekday), label: t(`weekdayNames.${weekdayKey(row.weekday)}`), counters: row,
          }))} />
          <ReportBarSection title={t('dailyTitle')} description={t('dailyDescription')} rows={report.byDay.slice(-7).map((row) => ({
            key: row.date, label: formatReportDate(row.date), counters: row,
          }))} />
          <ReportBarSection title={t('kindsTitle')} rows={report.byKind.filter((row) => row.total > 0).map((row) => ({
            key: row.kind ?? 'uncategorized',
            label: row.kind === null ? t('noKind') : t(`kindLabels.${row.kind}`),
            counters: row,
          }))} />
        </>
      )}

      <Section title={t('comparisonTitle')}>
        <Text tone="muted">{t('comparisonDescription')}</Text>
        {report.students.length === 0 ? <Text tone="muted">{t('emptyStudents')}</Text> : report.students.map((student) => (
          <View key={student.id} style={[styles.studentCard, { backgroundColor: colors.surfaceMuted, borderRadius: radius.surface }]}>
            <Text weight="bold" size="title">{student.name}</Text>
            <View style={styles.studentRate}>
              <Text>{t('completionRate')}</Text>
              <Text size="title" weight="bold">{formatReportRate(student.completionRate)}</Text>
            </View>
            <ReportStatusBar counters={student} />
            <ReportCounts counters={student} />
          </View>
        ))}
      </Section>

      <Section title={t('detailsTitle')}>
        <Text tone="muted">{t('detailsDescription')}</Text>
        {activities.length === 0 ? <Text tone="muted">{t('emptyActivities')}</Text> : activities.slice(-20).reverse().map((activity) => {
          const student = report.students.find((item) => item.id === activity.studentId)
          const accent = activity.status === 'completed' ? colors.primary : activity.status === 'missed' ? colors.danger : colors.info
          return (
            <View key={`${activity.studentId}-${activity.taskId}-${activity.originalDate}`} style={[styles.activityCard, { backgroundColor: colors.surfaceMuted, borderColor: accent, borderRadius: radius.surface }]}>
              <Text size="title" weight="medium">{activity.title}</Text>
              <Text tone="muted">{t('activityMeta', { date: formatReportDate(activity.date), student: student?.name ?? t('unknownStudent') })}</Text>
              <Text weight="medium">{t(`statusLabels.${activity.status}`)}</Text>
              <Text tone="muted">{activity.evaluation === null ? t('noEvaluation') : t(`evaluations.${activity.evaluation}`)}</Text>
            </View>
          )
        })}
        {activities.length > 20 && <Text tone="muted">{t('limitedActivities', { count: activities.length })}</Text>}
      </Section>
      <Text tone="muted">{t('generatedAt', { date: new Date(report.generatedAt).toLocaleString('pt-BR', { timeZone: report.timeZone }) })}</Text>
      <Text tone="muted">{t('timeZone', { zone: report.timeZone })}</Text>
    </>
  )
}

type ReportBarItem = Readonly<{ key: string; label: string; counters: ReportCounters }>

function ReportBarSection({ title, description, rows }: Readonly<{ title: string; description?: string; rows: readonly ReportBarItem[] }>) {
  const { colors, radius } = useThemeTokens()
  const largest = Math.max(1, ...rows.map((row) => row.counters.total))
  return (
    <Section title={title}>
      {description !== undefined && <Text tone="muted">{description}</Text>}
      {rows.map(({ key, label, counters }) => (
        <View key={key} style={[styles.barItem, { backgroundColor: colors.surfaceMuted, borderRadius: radius.surface }]}>
          <View style={styles.barHeader}>
            <Text weight="medium">{label}</Text>
            <Text weight="bold">{String(counters.total)}</Text>
          </View>
          <ReportStatusBar counters={counters} proportion={counters.total / largest} />
          <ReportCounts counters={counters} />
        </View>
      ))}
    </Section>
  )
}

function ReportStatusBar({ counters, proportion = 1 }: Readonly<{ counters: ReportCounters; proportion?: number }>) {
  const { colors, radius } = useThemeTokens()
  const { t } = useTranslation('reports')
  return (
    <View
      accessible accessibilityLabel={t('countSummary', counters)}
      style={[styles.barTrack, { backgroundColor: colors.divider, borderRadius: radius.pill }]}
    >
      {counters.total > 0 && (
        <View style={[styles.bar, { width: percent(proportion) }]}>
          {counters.completed > 0 && <View style={{ flex: counters.completed, backgroundColor: colors.primary }} />}
          {counters.missed > 0 && <View style={{ flex: counters.missed, backgroundColor: colors.danger }} />}
          {counters.upcoming > 0 && <View style={{ flex: counters.upcoming, backgroundColor: colors.info }} />}
        </View>
      )}
    </View>
  )
}

function ReportCounts({ counters }: Readonly<{ counters: ReportCounters }>) {
  const { t } = useTranslation('reports')
  const { colors } = useThemeTokens()
  const items = [
    { key: 'completed', label: t('completed'), value: counters.completed, color: colors.primary },
    { key: 'missed', label: t('missed'), value: counters.missed, color: colors.danger },
    { key: 'upcoming', label: t('upcoming'), value: counters.upcoming, color: colors.info },
  ]
  return (
    <View style={styles.counts}>
      {items.map((item) => (
        <View key={item.key} style={styles.count}>
          <View style={[styles.countDot, { backgroundColor: item.color }]} accessibilityElementsHidden />
          <Text>{t('statusCount', { label: item.label, value: item.value })}</Text>
        </View>
      ))}
    </View>
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
  tile: { width: '48%', flexGrow: 1, minWidth: 112, padding: SPACING.lg, gap: SPACING.sm, borderTopWidth: 4 },
  barItem: { gap: SPACING.md, padding: SPACING.lg },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm },
  barTrack: { height: 16, overflow: 'hidden' },
  bar: { flexDirection: 'row', height: '100%' },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  count: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  countDot: { width: 10, height: 10, borderRadius: 5 },
  studentCard: { padding: SPACING.lg, gap: SPACING.md },
  studentRate: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  activityCard: { padding: SPACING.lg, gap: SPACING.sm, borderLeftWidth: 4 },
})
