import { readLocalDateTime } from '@habituar/core/calendar'
import type { StudentId } from '@habituar/core/identity/ids'
import { canWriteTaskSeries } from '@habituar/react-client/react-client'
import type { CalendarEntryType } from '@habituar/react-client/react-client'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { useAgendaRoutes } from '../agenda/agenda-routes'
import { StudentCalendar } from '../agenda/student-calendar'
import { AgendaFab } from '../components/agenda-fab'
import { FixedStackPage } from '../components/ui/stack-page'
import type { InstitutionSession } from '../session/session-screen'
import { readCurrentTime } from '../time/current-time'

const PROFESSIONAL_VIEW_TYPES: readonly CalendarEntryType[] = ['student-task', 'staff-task', 'consultation']

/**
 * Agenda de um aluno vista pela equipe, dentro da ficha: as mesmas visões do aluno, com as
 * tarefas dele só para leitura. Quem tem `task.write` cria tarefa da equipe pelo botão
 * flutuante, exceção documentada à ação na barra.
 */
export function ProfessionalStudentAgendaScreen({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation('agenda')
  const routes = useAgendaRoutes('professional')

  return (
    <View style={styles.root}>
      <FixedStackPage title={t('title')}>
        <StudentCalendar session={session} studentId={studentId} types={PROFESSIONAL_VIEW_TYPES} viewer="other" onOpenEntry={(entry) => { routes.openEntry(studentId, entry) }} />
      </FixedStackPage>
      {canWriteTaskSeries(session.membership, 'staff') && (
        <AgendaFab actions={[{ key: 'task', label: t('calendar.newTask'), icon: 'list-checks', onPress: () => { routes.newTask(studentId, readLocalDateTime(readCurrentTime()).date) } }]} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
