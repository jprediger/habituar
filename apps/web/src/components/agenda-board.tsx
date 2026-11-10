import type { LocalDate } from '@habituar/core/calendar'
import type { AgendaCursor, AgendaDay, AgendaItem } from '@habituar/react-client/react-client'
import type { ReactElement } from 'react'
import { AgendaMonthGrid } from './agenda-month-grid.js'
import type { AgendaItemText } from './agenda-time-grid.js'
import { AgendaTimeGrid } from './agenda-time-grid.js'
import { AgendaToolbar } from './agenda-toolbar.js'

/**
 * Agenda inteira de uma tela: barra e a grade da visão escolhida. Clicar num dia do mês
 * abre esse dia, como no Google Agenda; o resto das ações vem de quem usa.
 */
export function AgendaBoard({
  cursor,
  days,
  today,
  nowMinute,
  describeItem,
  onItemSelect,
  onSlotSelect,
}: Readonly<{
  cursor: AgendaCursor
  days: readonly AgendaDay[]
  today: LocalDate
  nowMinute: number
  describeItem: (item: AgendaItem) => AgendaItemText
  onItemSelect: (item: AgendaItem) => void
  onSlotSelect?: ((date: LocalDate, time: string) => void) | undefined
}>): ReactElement {
  return (
    <div className="flex flex-col gap-md">
      <AgendaToolbar cursor={cursor} />
      {cursor.view === 'month'
        ? (
            <AgendaMonthGrid
              focusedDate={cursor.date}
              days={days}
              today={today}
              describeItem={describeItem}
              onItemSelect={onItemSelect}
              onDaySelect={(date) => { cursor.select(date); cursor.changeView('day') }}
            />
          )
        : <AgendaTimeGrid days={days} today={today} nowMinute={nowMinute} describeItem={describeItem} onItemSelect={onItemSelect} onSlotSelect={onSlotSelect} />}
    </div>
  )
}
