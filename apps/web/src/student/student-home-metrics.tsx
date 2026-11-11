import { assertNever } from '@habituar/core/assert-never'
import { readLocalDateTime } from '@habituar/core/calendar'
import type { StudentId } from '@habituar/core/identity/ids'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { MetricTiles } from '../components/ui/metric-tiles.js'
import { Section } from '../components/ui/section.js'
import { useInstitutionSession } from '../session/institution-session.js'
import { readCurrentTime } from '../time/current-time.js'

/**
 * Resumo do aluno no início: progresso de hoje, sequência de dias cumpridos e constância
 * dos últimos sete dias. Só desenha o que o hook calculou.
 */
export function StudentHomeMetrics({ studentId }: Readonly<{ studentId: StudentId }>): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()
  const today = readLocalDateTime(readCurrentTime()).date
  const state = habituar.useStudentHomeMetrics(session.membership, studentId, today)

  return (
    <Section title={t('home.metrics.title')}>
      {(() => {
        switch (state.status) {
          case 'loading':
            return <p role="status" className="text-body text-text-muted">{t('home.metrics.loading')}</p>
          case 'failed':
            return <p role="alert" className="text-body text-danger">{t('home.metrics.failed')}</p>
          case 'ready': {
            const { metrics } = state
            return (
              <MetricTiles
                items={[
                  { label: t('home.metrics.today'), value: metrics.today.total === 0 ? t('home.metrics.todayNone') : t('home.metrics.todayValue', { done: metrics.today.done, total: metrics.today.total }) },
                  { label: t('home.metrics.streak'), value: t('home.metrics.streakValue', { count: metrics.streakDays }), hint: t('home.metrics.streakDescription') },
                  {
                    label: t('home.metrics.week'),
                    value: metrics.weekRate === null ? '—' : t('home.metrics.weekValue', { rate: metrics.weekRate }),
                    hint: metrics.weekRate === null ? t('home.metrics.weekDescriptionNone') : metrics.weekMissing === 0 ? t('home.metrics.weekAllDone') : t('home.metrics.weekMissing', { count: metrics.weekMissing }),
                  },
                ]}
              />
            )
          }
          default:
            return assertNever(state)
        }
      })()}
    </Section>
  )
}
