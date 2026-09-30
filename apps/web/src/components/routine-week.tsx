import type { RoutineBlock, RoutineDay, Weekday } from '@habituar/core/routines'
import { WEEKDAY_LABEL_KEYS } from '@habituar/react-client/routine-forms'
import type { ReactElement, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../lib/utils.js'

/**
 * Desenho da semana de rotina: um dia por linha, de segunda a domingo, com o dia de hoje
 * marcado. Dono só do visual; quais ações cada dia e cada bloco oferecem vem de quem usa.
 */
export function RoutineWeek({
  days,
  today,
  renderDayAction,
  renderBlockActions,
}: Readonly<{
  days: readonly RoutineDay[]
  today: Weekday
  renderDayAction?: ((day: RoutineDay) => ReactNode) | undefined
  renderBlockActions?: ((block: RoutineBlock, day: RoutineDay) => ReactNode) | undefined
}>): ReactElement {
  const { t } = useTranslation()

  return (
    <ol className="flex flex-col gap-md">
      {days.map((day) => {
        const isToday = day.weekday === today
        const dayName = t(WEEKDAY_LABEL_KEYS[day.weekday])
        return (
          <li
            key={day.weekday}
            aria-current={isToday ? 'date' : undefined}
            className={cn('flex flex-col gap-sm rounded-field border px-lg py-md', isToday ? 'border-primary bg-surface' : 'border-hairline bg-surface')}
          >
            <div className="flex flex-wrap items-center justify-between gap-sm">
              <h3 className="text-body font-medium text-text">
                {dayName}
                {isToday && <span className="ml-sm text-caption font-medium text-primary">{t('routine.today')}</span>}
              </h3>
              {renderDayAction?.(day)}
            </div>
            {day.blocks.length === 0
              ? <p className="text-caption text-text-muted">{t('routine.emptyDay')}</p>
              : (
                  <ul className="flex flex-col gap-xs">
                    {day.blocks.map((block) => (
                      <li key={block.id} className="flex flex-wrap items-start justify-between gap-sm border-t border-hairline pt-xs first:border-t-0 first:pt-none">
                        <div className="flex min-w-0 flex-col">
                          <p className="text-body text-text">
                            <span className="font-medium">{t('routine.time', { start: block.startsAt, end: block.endsAt })}</span>
                            <span className="ml-sm">{block.title}</span>
                          </p>
                          <p className="text-caption text-text-muted">{t(`routine.kinds.${block.kind}`)}</p>
                          {block.notes !== null && <p className="whitespace-pre-line break-words text-caption text-text-muted">{block.notes}</p>}
                        </div>
                        {renderBlockActions?.(block, day)}
                      </li>
                    ))}
                  </ul>
                )}
          </li>
        )
      })}
    </ol>
  )
}
