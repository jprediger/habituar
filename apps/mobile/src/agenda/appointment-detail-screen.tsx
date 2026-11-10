import type { AppointmentOccurrence } from '@habituar/core/appointments'
import { assertNever } from '@habituar/core/assert-never'
import type { LocalDate } from '@habituar/core/calendar'
import type { AppointmentId, StudentId } from '@habituar/core/identity/ids'
import type { AgendaWriteResult, AppointmentDetail } from '@habituar/react-client/react-client'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import { ConfirmationSheet } from '../components/ui/confirmation-sheet'
import { ListDivider } from '../components/ui/list-divider'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { Text } from '../components/ui/text'
import { useToast } from '../components/ui/toast'
import type { InstitutionSession } from '../session/session-screen'
import { useAgendaLabels } from './agenda-labels'

type Confirmation = 'none' | 'occurrence' | 'series'

/**
 * Detalhe de uma ocorrência de atendimento, aberto da agenda. Quem tem `appointment.write`
 * edita a série, cancela só este dia ou exclui; os demais, incluindo aluno e responsável,
 * só leem. Ação que encerra o assunto mostra o toast e volta para a agenda.
 */
export function AppointmentDetailScreen({
  session,
  studentId,
  appointmentId,
  date,
  onEdit,
}: Readonly<{ session: InstitutionSession; studentId: StudentId; appointmentId: AppointmentId; date: LocalDate; onEdit?: (() => void) | undefined }>) {
  const { t } = useTranslation('agenda')
  const detail = habituar.useAppointmentDetail(session.membership, studentId, appointmentId, date)

  return (
    <StackPage title={t('appointment')}>
      {(() => {
        switch (detail.state.status) {
          case 'loading':
            return <Text tone="muted" accessibilityLiveRegion="polite">{t('loading')}</Text>
          case 'failed':
            return <Text accessibilityRole="alert" tone="danger">{t(detail.state.failure === 'forbidden' ? 'forbidden' : 'failed')}</Text>
          case 'ready':
            return <OccurrenceDetail occurrence={detail.state.occurrence} detail={detail} onEdit={onEdit} />
          default:
            return assertNever(detail.state)
        }
      })()}
    </StackPage>
  )
}

function OccurrenceDetail({ occurrence, detail, onEdit }: Readonly<{ occurrence: AppointmentOccurrence; detail: AppointmentDetail; onEdit: (() => void) | undefined }>) {
  const { t } = useTranslation('agenda')
  const router = useRouter()
  const toast = useToast()
  const labels = useAgendaLabels()
  const [confirmation, setConfirmation] = useState<Confirmation>('none')
  const [isBusy, setIsBusy] = useState(false)
  const [failure, setFailure] = useState<Exclude<AgendaWriteResult, 'saved'> | undefined>(undefined)
  const { appointment } = occurrence
  const recurrence = labels.formatRecurrence(appointment)

  function run(send: () => Promise<AgendaWriteResult>, toastKey: 'appointmentRemoved' | 'occurrenceCancelled'): void {
    setIsBusy(true)
    void send().then((result) => {
      setIsBusy(false)
      setConfirmation('none')
      if (result !== 'saved') {
        setFailure(result)
        return
      }
      toast({ type: 'success', title: t(`toast.${toastKey}.title`), subtitle: t(`toast.${toastKey}.description`) })
      router.back()
    })
  }

  return (
    <>
      <ListSection>
        <ListRow title={t('fields.student')} value={appointment.studentName} />
        <ListRow title={t('fields.professional')} value={appointment.professionalName} />
        <ListRow title={t('fields.startsOn')} value={labels.formatShortDate(occurrence.date)} />
        <ListRow title={t('fields.startsAt')} value={t('time', { start: occurrence.startsAt, end: occurrence.endsAt })} />
        {recurrence !== undefined && <ListRow title={t('sections.recurrence')} value={recurrence} />}
      </ListSection>
      {appointment.notes !== null && (
        <ListSection title={t('fields.notes')}>
          <Text>{appointment.notes}</Text>
        </ListSection>
      )}
      {detail.canSchedule && (
        <>
          <ListDivider />
          <ListSection>
            {onEdit !== undefined && <ListRow icon="pencil-simple" title={t('edit')} onPress={onEdit} />}
            {appointment.recurrence.kind === 'weekly' && <ListRow icon="warning-circle" title={t('cancelOccurrence')} onPress={() => { setFailure(undefined); setConfirmation('occurrence') }} />}
            <ListRow icon="trash" title={t('remove')} onPress={() => { setFailure(undefined); setConfirmation('series') }} />
          </ListSection>
        </>
      )}
      {failure !== undefined && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" tone="danger">{t(failure === 'conflict' ? 'conflict' : 'writeFailed')}</Text>}
      {confirmation === 'occurrence' && (
        <ConfirmationSheet
          title={t('cancelOccurrence')}
          message={t('cancelOccurrenceQuestion', { date: labels.formatShortDate(occurrence.date) })}
          confirmLabel={t('confirmCancelOccurrence')}
          cancelLabel={t('cancel')}
          confirmVariant="danger"
          isBusy={isBusy}
          onConfirm={() => { run(() => detail.cancelOccurrence(appointment, occurrence.date), 'occurrenceCancelled') }}
          onCancel={() => { setConfirmation('none') }}
        />
      )}
      {confirmation === 'series' && (
        <ConfirmationSheet
          title={t('remove')}
          message={appointment.recurrence.kind === 'weekly' ? t('removeSeriesQuestion') : t('removeSingleQuestion', { date: labels.formatShortDate(occurrence.date) })}
          confirmLabel={t('confirmRemove')}
          cancelLabel={t('cancel')}
          confirmVariant="danger"
          isBusy={isBusy}
          onConfirm={() => { run(() => detail.remove(appointment), 'appointmentRemoved') }}
          onCancel={() => { setConfirmation('none') }}
        />
      )}
    </>
  )
}
