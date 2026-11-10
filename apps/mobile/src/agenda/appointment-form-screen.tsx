import type { Appointment } from '@habituar/core/appointments'
import { assertNever } from '@habituar/core/assert-never'
import { type LocalDate, readLocalDateParts } from '@habituar/core/calendar'
import type { AppointmentId, StudentId } from '@habituar/core/identity/ids'
import { SPACING } from '@habituar/design-tokens/spacing'
import { APPOINTMENT_DURATION_OPTIONS, useAppointmentForm } from '@habituar/react-client/agenda-forms'
import type { AppointmentField } from '@habituar/react-client/agenda-forms'
import type { AgendaWriteResult } from '@habituar/react-client/react-client'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { ChoiceList } from '../components/ui/choice-list'
import { DateTimeField } from '../components/ui/date-time-field'
import { FormField } from '../components/ui/form-field'
import { ListDivider } from '../components/ui/list-divider'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { SwitchRow } from '../components/ui/switch-row'
import { Text } from '../components/ui/text'
import { Textarea } from '../components/ui/textarea'
import { useToast } from '../components/ui/toast'
import type { InstitutionSession } from '../session/session-screen'

function toPickerDate(date: LocalDate): Date {
  const parts = readLocalDateParts(date)
  return new Date(parts.year, parts.month - 1, parts.day)
}

/** Novo atendimento, a partir do dia escolhido na agenda. */
export function NewAppointmentScreen({ session, date }: Readonly<{ session: InstitutionSession; date: LocalDate }>) {
  const { t } = useTranslation('agenda')
  const agenda = habituar.useProfessionalAgenda(session.membership, { from: date, to: date })
  return (
    <StackPage title={t('new')}>
      <AppointmentForm session={session} date={date} save={(studentId, input) => agenda.create(studentId, input)} />
    </StackPage>
  )
}

/** Edição da série de um atendimento existente; o aluno fica fixo. */
export function EditAppointmentScreen({ session, studentId, appointmentId, date }: Readonly<{ session: InstitutionSession; studentId: StudentId; appointmentId: AppointmentId; date: LocalDate }>) {
  const { t } = useTranslation('agenda')
  const detail = habituar.useAppointmentDetail(session.membership, studentId, appointmentId, date)
  return (
    <StackPage title={t('edit')}>
      {(() => {
        switch (detail.state.status) {
          case 'loading':
            return <Text tone="muted" accessibilityLiveRegion="polite">{t('loading')}</Text>
          case 'failed':
            return <Text accessibilityRole="alert" tone="danger">{t('failed')}</Text>
          case 'ready': {
            const appointment = detail.state.occurrence.appointment
            return <AppointmentForm session={session} appointment={appointment} date={appointment.startsOn} save={(_studentId, input) => detail.update(appointment, input)} />
          }
          default:
            return assertNever(detail.state)
        }
      })()}
    </StackPage>
  )
}

function AppointmentForm({
  session,
  appointment,
  date,
  save,
}: Readonly<{ session: InstitutionSession; appointment?: Appointment; date: LocalDate; save: Parameters<typeof useAppointmentForm>[0]['save'] }>) {
  const { t } = useTranslation('agenda')
  const router = useRouter()
  const toast = useToast()
  const students = habituar.useAccessibleStudents(session.membership)
  const form = useAppointmentForm({ appointment, date, save })
  const [failure, setFailure] = useState<Exclude<AgendaWriteResult, 'saved'> | undefined>(undefined)
  const errorFor = (field: AppointmentField) => form.invalidFields.has(field) ? t(`invalid.${field}`, { maximum: form.notesMaxLength }) : undefined
  const studentChoices = form.isStudentLocked && appointment !== undefined
    ? [{ value: appointment.studentId, label: appointment.studentName }]
    : students.state.status === 'ready' ? students.state.students.map(student => ({ value: student.id, label: student.socialName ?? student.fullName })) : []

  return (
    <View style={styles.stack}>
      <ListSection title={t('sections.student')}>
        {studentChoices.length === 0
          ? <Text tone="muted">{t('noStudentsToSchedule')}</Text>
          : (
              <ChoiceList
                label={t('fields.student')}
                isLabelVisible={false}
                choices={studentChoices}
                value={form.values.studentId}
                isDisabled={form.isStudentLocked}
                onChange={(value) => { form.change('studentId', studentChoices.find(choice => choice.value === value)?.value) }}
              />
            )}
        {errorFor('studentId') !== undefined && <Text accessibilityRole="alert" tone="danger">{errorFor('studentId')}</Text>}
      </ListSection>
      <ListDivider />
      <ListSection title={t('sections.schedule')}>
        <View style={styles.fields}>
          <FormField id="appointment-starts-on" label={t('fields.startsOn')} isRequired error={errorFor('startsOn')}>
            {(control) => <DateTimeField mode="date" value={form.values.startsOn} initialDate={toPickerDate(date)} onChange={(value) => { form.change('startsOn', value) }} {...control} />}
          </FormField>
          <FormField id="appointment-starts-at" label={t('fields.startsAt')} isRequired error={errorFor('startsAt')}>
            {(control) => <DateTimeField mode="time" value={form.values.startsAt} initialDate={toPickerDate(date)} onChange={(value) => { form.change('startsAt', value) }} {...control} />}
          </FormField>
        </View>
        <ChoiceList
          label={t('fields.duration')}
          choices={APPOINTMENT_DURATION_OPTIONS.map(minutes => ({ value: String(minutes), label: t('durationOption', { minutes }) }))}
          value={String(form.values.durationMinutes)}
          onChange={(value) => { form.change('durationMinutes', Number(value)) }}
        />
        {errorFor('durationMinutes') !== undefined && <Text accessibilityRole="alert" tone="danger">{errorFor('durationMinutes')}</Text>}
      </ListSection>
      <ListDivider />
      <ListSection title={t('sections.recurrence')} footer={form.values.isWeekly ? t('untilHint') : undefined}>
        <SwitchRow label={t('fields.weekly')} isOn={form.values.isWeekly} onChange={(isOn) => { form.change('isWeekly', isOn) }} />
        {form.values.isWeekly && (
          <View style={styles.indented}>
            <FormField id="appointment-until" label={t('fields.until')} isRequired={false} error={errorFor('until')}>
              {(control) => <DateTimeField mode="date" value={form.values.until} initialDate={toPickerDate(date)} onChange={(value) => { form.change('until', value) }} onClear={() => { form.change('until', '') }} {...control} />}
            </FormField>
          </View>
        )}
      </ListSection>
      <ListDivider />
      <ListSection title={t('sections.notes')}>
        <FormField id="appointment-notes" label={t('fields.notes')} isRequired={false} error={errorFor('notes')}>
          {(control) => <Textarea maxLength={form.notesMaxLength} value={form.values.notes} onChangeText={(value) => { form.change('notes', value) }} {...control} />}
        </FormField>
      </ListSection>
      {failure !== undefined && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" tone="danger">{t(failure === 'conflict' ? 'conflict' : 'writeFailed')}</Text>}
      <Button
        label={form.isSaving ? t('saving') : t('save')}
        isBusy={form.isSaving}
        onPress={() => {
          setFailure(undefined)
          void form.submit().then((result) => {
            if (result === 'invalid') return
            if (result !== 'saved') {
              setFailure(result)
              return
            }
            toast({ type: 'success', title: t('toast.appointmentSaved.title'), subtitle: t('toast.appointmentSaved.description') })
            router.back()
          })
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.xl },
  fields: { gap: SPACING.md },
  indented: { paddingLeft: SPACING.lg },
})
