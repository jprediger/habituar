import type { RoutineBlock, RoutineDay, Weekday } from '@habituar/core/routines'
import { WEEKDAY_LABEL_KEYS } from '@habituar/react-client/routine-forms'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ListDivider } from './ui/list-divider'
import { ListRow } from './ui/list-row'
import { ListSection } from './ui/list-section'

/**
 * Desenho da semana de rotina no app: um grupo por dia, de segunda a domingo, com o dia de
 * hoje marcado no título. Dono só do visual; tocar num bloco e a ação do dia vêm de quem usa.
 */
export function RoutineWeek({
  days,
  today,
  onBlockPress,
  renderDayAction,
}: Readonly<{
  days: readonly RoutineDay[]
  today: Weekday
  onBlockPress?: ((block: RoutineBlock) => void) | undefined
  renderDayAction?: ((day: RoutineDay) => ReactNode) | undefined
}>) {
  const { t } = useTranslation()

  return (
    <>
      {days.map((day, index) => {
        const dayName = t(WEEKDAY_LABEL_KEYS[day.weekday])
        return (
          <ListSection key={day.weekday} title={day.weekday === today ? t('routine.todayTitle', { day: dayName }) : dayName}>
            {day.blocks.length === 0 && <ListRow title={t('routine.emptyDay')} />}
            {day.blocks.map((block) => (
              <ListRow
                key={block.id}
                title={block.title}
                description={block.notes === null ? t(`routine.kinds.${block.kind}`) : t('routine.kindWithNotes', { kind: t(`routine.kinds.${block.kind}`), notes: block.notes })}
                value={t('routine.time', { start: block.startsAt, end: block.endsAt })}
                onPress={onBlockPress === undefined ? undefined : () => { onBlockPress(block) }}
              />
            ))}
            {renderDayAction?.(day)}
            {index < days.length - 1 && <ListDivider />}
          </ListSection>
        )
      })}
    </>
  )
}
