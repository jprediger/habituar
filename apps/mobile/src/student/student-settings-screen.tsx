import { useTranslation } from 'react-i18next'
import type { StudentId } from '@habituar/core/identity/ids'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import { habituar } from '../client/habituar-client'
import { ReminderSettings } from '../notifications/reminder-settings'
import { useRoutineReminders } from '../notifications/use-routine-reminders'
import type { InstitutionSession } from '../session/session-screen'

/** Configurações do ambiente de aluno: por ora, só os lembretes locais de rotina. */
export function StudentSettingsScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  const { state } = habituar.useAccessibleStudents(session.membership)
  const ownStudent = state.status === 'ready' && state.students.length === 1 ? state.students[0] : undefined

  return (
    <Page>
      <PageHeader eyebrow={t('navigation.settings')} title={t('settings.title')} />
      {ownStudent !== undefined && <RemindersSection session={session} studentId={ownStudent.id} />}
    </Page>
  )
}

function RemindersSection({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const reminders = useRoutineReminders(session.membership, studentId)
  return (
    <ReminderSettings
      leadMinutesList={reminders.leadMinutesList}
      onAddLeadMinutes={(value) => { void reminders.addLeadMinutes(value) }}
      onRemoveLeadMinutes={(value) => { void reminders.removeLeadMinutes(value) }}
      permission={reminders.permission}
      onRequestPermission={() => { void reminders.requestPermission() }}
    />
  )
}