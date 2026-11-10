import type { AgendaDay, AgendaItem } from '@habituar/react-client/react-client'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAgendaLabels } from '../agenda/agenda-labels'
import { ListRow } from './ui/list-row'
import { ListSection } from './ui/list-section'

export type AgendaRowText = Readonly<{ title: string; description: string }>

/**
 * Lista do dia escolhido na agenda: um item por linha, título, apoio e horário à direita,
 * em ordem de início. Dono só do visual; o texto de cada item e o destino do toque vêm de
 * quem usa, e `footer` recebe a ação de criar do dia, quando existe.
 */
export function AgendaDayList({
  day,
  describeItem,
  onItemPress,
  footer,
}: Readonly<{ day: AgendaDay; describeItem: (item: AgendaItem) => AgendaRowText; onItemPress: (item: AgendaItem) => void; footer?: ReactNode }>) {
  const { t } = useTranslation('agenda')
  const labels = useAgendaLabels()

  return (
    <ListSection title={labels.formatLongDate(day.date)}>
      {day.items.length === 0 && <ListRow title={t('emptyDay')} />}
      {day.items.map(item => {
        const text = describeItem(item)
        return (
          <ListRow
            key={item.key}
            title={text.title}
            description={text.description}
            value={item.startsAt}
            accessibilityLabel={`${text.title}, ${t('time', { start: item.startsAt, end: item.endsAt })}`}
            onPress={() => { onItemPress(item) }}
          />
        )
      })}
      {footer}
    </ListSection>
  )
}
