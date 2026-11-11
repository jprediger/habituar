import { listRangeDays, monthGridRange, type LocalDate } from '@habituar/core/calendar'
import { SPACING } from '@habituar/design-tokens/spacing'
import { StyleSheet, View } from 'react-native'
import { Skeleton } from './skeletons/skeleton'
import { SkeletonBlock } from './skeletons/skeleton-block'
import { ListSectionSkeleton } from './skeletons/list-section-skeleton'
import { useThemeTokens } from '../theme/tokens'

/** Reserva a forma da visão escolhida enquanto os dias desse período são buscados. */
export function AgendaViewSkeleton({ view, date }: Readonly<{ view: 'month' | 'day' | 'schedule'; date: LocalDate }>) {
  switch (view) {
    case 'month': {
      const range = monthGridRange(date)
      const weekCount = listRangeDays(range).length / 7
      return (
        <Skeleton delayMs={0} style={[styles.fill, styles.month]}>
          <View style={styles.week}>
            {Array.from({ length: 7 }, (_, day) => <View key={day} style={styles.cell}><SkeletonBlock width="55%" height={12} /></View>)}
          </View>
          <View style={styles.weeks}>
            {Array.from({ length: weekCount }, (_, week) => (
              <View key={week} style={[styles.week, styles.weekRow]}>
                {Array.from({ length: 7 }, (_, day) => (
                  <View key={day} style={styles.cell}>
                    <SkeletonBlock width={20} height={16} />
                    {(week + day) % 3 !== 0 && <SkeletonBlock height={13} />}
                    {(week + day) % 4 === 0 && <SkeletonBlock width="75%" height={13} />}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </Skeleton>
      )
    }
    case 'day':
      return (
        <Skeleton delayMs={0} style={styles.fill}>
          <SkeletonBlock width="35%" height={16} />
          <View style={styles.hours}>
            {Array.from({ length: 8 }, (_, hour) => (
              <View key={hour} style={styles.hour}>
                <SkeletonBlock width={38} height={12} />
                <View style={styles.hourContent}>
                  <SkeletonBlock height={1} />
                  {(hour === 2 || hour === 5) && <View style={styles.event}><SkeletonBlock width={hour === 2 ? '75%' : '55%'} height={40} /></View>}
                </View>
              </View>
            ))}
          </View>
        </Skeleton>
      )
    case 'schedule':
      return <Skeleton delayMs={0}><ListSectionSkeleton hasTitle rows={2} /><ListSectionSkeleton hasTitle rows={2} /><ListSectionSkeleton hasTitle rows={1} /></Skeleton>
  }
}

const styles = StyleSheet.create({
  page: { flex: 1, gap: SPACING.lg },
  fill: { flex: 1 },
  month: { marginHorizontal: -SPACING.lg },
  week: { flexDirection: 'row', gap: SPACING.xs },
  weekRow: { flex: 1 },
  weeks: { flex: 1, gap: SPACING.xs },
  cell: { flex: 1, alignItems: 'center', gap: SPACING.xs },
  hours: { flex: 1, gap: SPACING.lg },
  hour: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  hourContent: { flex: 1, gap: SPACING.sm },
  event: { paddingHorizontal: SPACING.sm },
})

/** Mesmo enquadramento desde a abertura da aba até os dados do calendário chegarem. */
export function AgendaPageSkeleton({ date }: Readonly<{ date: LocalDate }>) {
  const { minimumTouchTarget, lineHeight } = useThemeTokens()
  const headerHeight = Math.max(minimumTouchTarget, lineHeight.title.normal)
  return (
    <View style={styles.page}>
      <Skeleton delayMs={0}><SkeletonBlock width="45%" height={headerHeight} /></Skeleton>
      <AgendaViewSkeleton view="month" date={date} />
    </View>
  )
}
