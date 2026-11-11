import { assertNever } from '@habituar/core/assert-never'
import type { StudentId } from '@habituar/core/identity/ids'
import type { StudentConsultation } from '@habituar/core/student-records'
import { SPACING } from '@habituar/design-tokens/spacing'
import type { StudentConsultationsAccess, StudentConsultationsState } from '@habituar/react-client/react-client'
import { useConsultationForm } from '@habituar/react-client/student-record-forms'
import type { ConsultationField } from '@habituar/react-client/student-record-forms'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { ListSectionSkeleton } from '../components/skeletons/list-section-skeleton'
import { Skeleton } from '../components/skeletons/skeleton'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { ConfirmationSheet } from '../components/ui/confirmation-sheet'
import { DateTimeField } from '../components/ui/date-time-field'
import { EmptyState } from '../components/ui/empty-state'
import { FormField } from '../components/ui/form-field'
import { InlineNotice } from '../components/ui/inline-notice'
import { Input } from '../components/ui/input'
import { ListDivider } from '../components/ui/list-divider'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { Text } from '../components/ui/text'
import { Textarea } from '../components/ui/textarea'
import { useToast } from '../components/ui/toast'
import type { InstitutionSession } from '../session/session-screen'
import { readCurrentTime } from '../time/current-time'
import { formatRecordDate, formatRecordTime } from './student-record-format'
import { StudentRecordWriteGate } from './student-record-gate'

/** Consultas já realizadas, da mais recente para a mais antiga; registrar abre tela própria pela barra. */
export function StudentConsultationsScreen({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const access = habituar.useStudentConsultations(session.membership, studentId)

  return (
    <StackPage
      title={t('students.consultations.title')}
      action={access.canWrite
        ? { icon: 'plus', label: t('students.consultations.open'), onPress: () => { router.push({ pathname: '/professional/students/[student-id]/consultations/new', params: { 'student-id': studentId } }) } }
        : undefined}
    >
      <ConsultationList consultations={access.consultations} />
    </StackPage>
  )
}

function ConsultationList({ consultations }: Readonly<{ consultations: StudentConsultationsState }>) {
  const { t } = useTranslation()

  switch (consultations.status) {
    case 'loading':
      return <Skeleton><ListSectionSkeleton rows={2} /></Skeleton>
    case 'failed':
      return <Text accessibilityRole="alert" tone="danger">{t('students.consultations.failed')}</Text>
    case 'ready':
      // O aviso fala do registro, então só aparece quando há lista, mesmo vazia: no
      // carregamento e na falha ele disputaria atenção com o que a pessoa precisa ver.
      return (
        <>
          <InlineNotice message={t('students.consultations.finalNotice')} />
          {consultations.consultations.length === 0
            ? <EmptyState title={t('students.consultations.emptyTitle')} description={t('students.consultations.emptyDescription')} />
            : (
              <View accessibilityRole="list" style={styles.cards}>
                {consultations.consultations.map((consultation) => <ConsultationCard key={consultation.id} consultation={consultation} />)}
              </View>
            )}
        </>
      )
    default:
      return assertNever(consultations)
  }
}

// Cartão em vez de linha de lista: a consulta não leva a outra tela, e a anotação é texto
// longo que pede leitura, não escolha. Data e duração ficam no topo para achar o atendimento.
function ConsultationCard({ consultation }: Readonly<{ consultation: StudentConsultation }>) {
  const { t } = useTranslation()

  return (
    <View testID={`consultation-${consultation.id}`}>
      <Card>
        <View style={styles.cardHeader}>
          <Text weight="bold">{t('students.consultations.when', { date: formatRecordDate(consultation.occurredAt), time: formatRecordTime(consultation.occurredAt) })}</Text>
          <Text tone="muted">{t('students.consultations.duration', { minutes: consultation.durationMinutes })}</Text>
        </View>
        <Text>{consultation.notes}</Text>
        <Text size="caption" tone="muted">{t('students.consultations.recordedBy', { name: consultation.recordedBy.name })}</Text>
      </Card>
    </View>
  )
}

/**
 * Registro de uma consulta que já aconteceu, em tela própria. A gravação é definitiva, então
 * passa por confirmação; depois avisa por toast e volta para a lista.
 */
export function NewConsultationScreen({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation()
  const overview = habituar.useStudentRecordOverview(session.membership, studentId)
  const access = habituar.useStudentConsultations(session.membership, studentId)
  const title = t('students.consultations.newTitle')

  return (
    <StudentRecordWriteGate title={title} overview={overview}>
      {() => <StackPage title={title}><ConsultationForm record={access.recordConsultation} /></StackPage>}
    </StudentRecordWriteGate>
  )
}

function ConsultationForm({ record }: Readonly<{ record: StudentConsultationsAccess['recordConsultation'] }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const form = useConsultationForm({ record })
  const errorFor = (field: ConsultationField) => form.invalidFields.has(field)
    ? t(`students.consultations.invalid.${field}`, { maximum: field === 'notes' ? form.notesMaxLength : form.maxDurationMinutes })
    : undefined

  async function confirm(): Promise<void> {
    if (await form.confirm() === 'saved') {
      toast({ type: 'success', title: t('toast.studentRecord.consultationSaved.title'), subtitle: t('toast.studentRecord.consultationSaved.description') })
      router.back()
    }
  }

  return (
    <>
      <ListSection title={t('students.consultations.topics.when')}>
        <View style={styles.stack}>
          <FormField id="consultation-occurredAt" label={t('students.consultations.fields.occurredAt')} isRequired error={errorFor('occurredAt')}>
            {(control) => (
              <DateTimeField
                {...control}
                mode="datetime"
                value={form.values.occurredAt}
                maximumDate={readCurrentTime()}
                isDisabled={form.isConfirming}
                onChange={(value) => { form.change('occurredAt', value) }}
              />
            )}
          </FormField>
          <FormField id="consultation-durationMinutes" label={t('students.consultations.fields.durationMinutes')} isRequired error={errorFor('durationMinutes')}>
            {(control) => (
              <Input {...control} keyboardType="number-pad" editable={!form.isConfirming} value={form.values.durationMinutes} onChangeText={(value) => { form.change('durationMinutes', value) }} />
            )}
          </FormField>
        </View>
      </ListSection>
      <ListDivider />

      <ListSection title={t('students.consultations.fields.notes')}>
        <FormField id="consultation-notes" label={t('students.consultations.fields.notes')} isRequired hint={t('students.consultations.notesHint')} error={errorFor('notes')}>
          {(control) => (
            <Textarea {...control} maxLength={form.notesMaxLength} editable={!form.isConfirming} value={form.values.notes} onChangeText={(value) => { form.change('notes', value) }} />
          )}
        </FormField>
      </ListSection>

      <View style={styles.stack}>
        {form.failure !== undefined && form.failure !== 'invalid' && (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" tone="danger">{t(`students.consultations.failure.${form.failure}`)}</Text>
        )}
        <Button label={t('students.consultations.submit')} onPress={form.request} />
      </View>
      {form.isConfirming && (
        <ConfirmationSheet
          title={t('students.consultations.confirmTitle')}
          message={t('students.consultations.confirmDescription')}
          confirmLabel={t('students.consultations.confirm')}
          cancelLabel={t('students.consultations.keepEditing')}
          confirmVariant="primary"
          isBusy={form.isSaving}
          onConfirm={() => { void confirm() }}
          onCancel={form.cancel}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  cards: { gap: SPACING.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: SPACING.sm },
  stack: { gap: SPACING.sm },
})
