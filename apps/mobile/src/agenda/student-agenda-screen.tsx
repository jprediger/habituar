import { assertNever } from '@habituar/core/assert-never'
import { readLocalDateTime } from '@habituar/core/calendar'
import type { StudentId } from '@habituar/core/identity/ids'
import { readTaskProgress } from '@habituar/react-client/react-client'
import type { AgendaItem } from '@habituar/react-client/react-client'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import { AgendaDayList } from '../components/agenda-day-list'
import { AgendaWeekStrip } from '../components/agenda-week-strip'
import { ChoiceList } from '../components/ui/choice-list'
import { EmptyState } from '../components/ui/empty-state'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { readCurrentTime } from '../time/current-time'

/**
 * Aba Agenda do ambiente de aluno: as tarefas da rotina e os atendimentos de cada dia. O
 * aluno abre a tarefa para registrar observação e fotos; o responsável escolhe de qual
 * estudante é a agenda e vê o mesmo, só para leitura.
 */
export function StudentAgendaScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation('agenda')
  const { t: tc } = useTranslation()
  const { state } = habituar.useAccessibleStudents(session.membership)
  const [selectedId, setSelectedId] = useState<StudentId | undefined>(undefined)

  return (
    <Page>
      <PageHeader eyebrow={tc('navigation.agenda')} title={t('title')} />
      {(() => {
        switch (state.status) {
          case 'loading':
            return <Text tone="muted" accessibilityLiveRegion="polite">{t('loading')}</Text>
          case 'failed':
            return <Text accessibilityRole="alert" tone="danger">{t('failed')}</Text>
          case 'ready': {
            const student = state.students.find(candidate => candidate.id === selectedId) ?? state.students[0]
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
                <StudentAgenda key={student.id} session={session} studentId={student.id} />
              </>
            )
          }
          default:
            return assertNever(state)
        }
      })()}
    </Page>
  )
}

function StudentAgenda({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation('agenda')
  const { t: tc } = useTranslation()
  const router = useRouter()
  const now = readLocalDateTime(readCurrentTime())
  const cursor = habituar.useAgendaCursor(now.date, 'week')
  const agenda = habituar.useStudentAgenda(session.membership, studentId, cursor.range)

  function describeItem(item: AgendaItem) {
    switch (item.kind) {
      case 'task': {
        const progress = readTaskProgress(item.entry)
        if (progress !== 'open') return { title: item.block.title, description: t(`task.progress.${progress}`) }
        const photoCount = item.entry?.photos.length ?? 0
        if (photoCount > 0) return { title: item.block.title, description: t('task.photoCount', { count: photoCount }) }
        if (item.entry?.notes !== undefined && item.entry.notes !== null) return { title: item.block.title, description: t('task.hasNote') }
        return { title: item.block.title, description: tc(`routine.kinds.${item.block.kind}`) }
      }
      case 'appointment':
        return { title: t('appointment'), description: item.occurrence.appointment.professionalName }
      default:
        return assertNever(item)
    }
  }

  function openItem(item: AgendaItem): void {
    switch (item.kind) {
      case 'task':
        router.push({ pathname: '/student/agenda/task/[routine-block-id]', params: { 'routine-block-id': item.block.id, student: studentId, date: item.date } })
        return
      case 'appointment':
        router.push({ pathname: '/student/agenda/appointment/[appointment-id]', params: { 'appointment-id': item.occurrence.appointment.id, student: studentId, date: item.date } })
        return
      default:
        assertNever(item)
    }
  }

  switch (agenda.state.status) {
    case 'loading':
      return <Text tone="muted" accessibilityLiveRegion="polite">{t('loading')}</Text>
    case 'failed':
      return <Text accessibilityRole="alert" tone="danger">{t(agenda.state.failure === 'forbidden' ? 'forbidden' : 'failed')}</Text>
    case 'ready': {
      const busyDates = new Set(agenda.state.days.filter(day => day.items.length > 0).map(day => day.date))
      const day = agenda.state.days.find(candidate => candidate.date === cursor.date) ?? { date: cursor.date, items: [] }
      return (
        <>
          <AgendaWeekStrip cursor={cursor} today={now.date} busyDates={busyDates} />
          <AgendaDayList day={day} describeItem={describeItem} onItemPress={openItem} />
        </>
      )
    }
    default:
      return assertNever(agenda.state)
  }
}
