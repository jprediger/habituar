import { assertNever } from '@habituar/core/assert-never'
import { readLocalDateTime } from '@habituar/core/calendar'
import type { StudentId } from '@habituar/core/identity/ids'
import { canWriteTaskSeries } from '@habituar/react-client/react-client'
import type { CalendarEntryType } from '@habituar/react-client/react-client'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { OfflineNotice } from './offline-notice'
import { AgendaFab } from '../components/agenda-fab'
import { AgendaPageSkeleton } from '../components/agenda-view-skeleton'
import { ChoiceList } from '../components/ui/choice-list'
import { EmptyState } from '../components/ui/empty-state'
import { FixedPage } from '../components/ui/fixed-page'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { readCurrentTime } from '../time/current-time'
import { useAgendaRoutes } from './agenda-routes'
import { StudentCalendar } from './student-calendar'

const STUDENT_AGENDA_TYPES: readonly CalendarEntryType[] = ['student-task', 'staff-task', 'consultation']

/**
 * Aba Agenda do ambiente de aluno: as tarefas do aluno e da equipe e os atendimentos, no
 * mês, no dia ou em programação. O aluno cria as próprias tarefas pelo botão flutuante; o
 * responsável escolhe de qual estudante é a agenda e só lê, sem botão de criar.
 */
export function StudentAgendaScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation('agenda')
  const routes = useAgendaRoutes('student')
  const { state } = habituar.useAccessibleStudents(session.membership)
  const [selectedId, setSelectedId] = useState<StudentId | undefined>(undefined)
  const student = state.status === 'ready' ? state.students.find(candidate => candidate.id === selectedId) ?? state.students[0] : undefined
  // Só o próprio aluno escreve tarefa de origem aluno: é a permissão, e não o papel, que
  // separa "minhas tarefas" de "tarefas do aluno" para o responsável.
  const canCreate = canWriteTaskSeries(session.membership, 'student')

  return (
    <View style={styles.root}>
      <FixedPage fallback={<AgendaPageSkeleton date={readLocalDateTime(readCurrentTime()).date} />}>
        <OfflineNotice />
        {/* O título do período faz as vezes de cabeçalho visível; o leitor de tela ainda ouve o nome da tela como título. */}
        <View accessible accessibilityRole="header" accessibilityLabel={t('title')} style={styles.screenReaderHeading} />
        {(() => {
          switch (state.status) {
            case 'loading':
              return <AgendaPageSkeleton date={readLocalDateTime(readCurrentTime()).date} />
            case 'failed':
              return <Text accessibilityRole="alert" tone="danger">{t('failed')}</Text>
            case 'ready':
              if (student === undefined) return <EmptyState title={t('noStudentsTitle')} description={t('noStudentsDescription')} />
              return (
                <>
                  {state.students.length > 1 && (
                    <ChoiceList
                      label={t('studentPicker')}
                      choices={state.students.map(candidate => ({ value: candidate.id, label: candidate.socialName ?? candidate.fullName }))}
                      value={student.id}
                      onChange={(value) => { setSelectedId(state.students.find(candidate => candidate.id === value)?.id) }}
                    />
                  )}
                  <StudentCalendar key={student.id} session={session} studentId={student.id} types={STUDENT_AGENDA_TYPES} viewer={canCreate ? 'self' : 'other'} onOpenEntry={(entry) => { routes.openEntry(student.id, entry) }} />
                </>
              )
            default:
              return assertNever(state)
          }
        })()}
      </FixedPage>
      {student !== undefined && canCreate && (
        <AgendaFab actions={[{ key: 'task', label: t('calendar.newTask'), icon: 'list-checks', onPress: () => { routes.newTask(student.id, readLocalDateTime(readCurrentTime()).date) } }]} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screenReaderHeading: { position: 'absolute', width: 1, height: 1, overflow: 'hidden' },
})
