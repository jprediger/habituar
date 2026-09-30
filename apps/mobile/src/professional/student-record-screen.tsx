import { assertNever } from '@habituar/core/assert-never'
import type { StudentId } from '@habituar/core/identity/ids'
import { STUDENT_CONDITIONS } from '@habituar/core/student-records'
import type { StudentHistoryEntry, StudentProfileState, StudentRecord } from '@habituar/core/student-records'
import type { StudentDetail } from '@habituar/core/students'
import { SPACING } from '@habituar/design-tokens/spacing'
import type { StudentConsultationsState, StudentHistoryState, StudentRecordAccess } from '@habituar/react-client/react-client'
import { useConsultationForm, useObservationForm, useStudentProfileForm } from '@habituar/react-client/student-record-forms'
import type { ConsultationField, StudentProfileForm, StudentProfileTextField } from '@habituar/react-client/student-record-forms'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { CheckboxRow } from '../components/ui/checkbox-row'
import { ConfirmationSheet } from '../components/ui/confirmation-sheet'
import { DateTimeField } from '../components/ui/date-time-field'
import { EmptyState } from '../components/ui/empty-state'
import { FormField } from '../components/ui/form-field'
import { Input } from '../components/ui/input'
import { ListDivider } from '../components/ui/list-divider'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { Text } from '../components/ui/text'
import { Textarea } from '../components/ui/textarea'
import { useToast } from '../components/ui/toast'
import type { InstitutionSession } from '../session/session-screen'
import { readCurrentTime } from '../time/current-time'

/**
 * Ficha do estudante no ambiente profissional: cadastro para consulta, dados de apoio,
 * consultas realizadas, observações e a linha do tempo. Não decide acesso — mostra o que a
 * API devolveu e oferece escrita só como dica, porque a API confere a permissão de novo.
 */
export function StudentRecordScreen({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation()
  const access = habituar.useStudentRecord(session.membership, studentId)

  switch (access.record.status) {
    case 'loading':
      return <StackPage title={t('students.record.eyebrow')}><Text tone="muted" accessibilityLiveRegion="polite">{t('students.record.loading')}</Text></StackPage>
    case 'failed':
      return (
        <StackPage title={t('students.record.eyebrow')}>
          {access.record.failure === 'failed'
            ? <Text accessibilityRole="alert" tone="danger">{t('students.record.failed')}</Text>
            : <EmptyState title={t(`students.record.${access.record.failure}.title`)} description={t(`students.record.${access.record.failure}.description`)} />}
        </StackPage>
      )
    case 'ready':
      return <StudentRecordView student={access.record.student} record={access.record.record} access={access} />
    default:
      return assertNever(access.record)
  }
}

function StudentRecordView({ student, record, access }: Readonly<{ student: StudentDetail; record: StudentRecord; access: StudentRecordAccess }>) {
  const { t } = useTranslation()
  const toast = useToast()
  const form = useStudentProfileForm({ profile: record.profile, save: access.recordProfile })

  async function saveProfile(): Promise<void> {
    if (await form.submit() === 'saved') {
      toast({ type: 'success', title: t('toast.studentRecord.profileSaved.title'), subtitle: t('toast.studentRecord.profileSaved.description') })
    }
  }

  return (
    <StackPage title={student.socialName ?? student.fullName}>
      <Text tone="muted">{t('students.record.description')}</Text>
      {student.archivedAt !== null && <Text accessibilityRole="alert">{t('students.record.archived')}</Text>}

      <StudentRegistration student={student} />
      <ListDivider />

      {form.isEditing
        ? <StudentProfileEditor form={form} onSave={() => { void saveProfile() }} />
        : <StudentProfileSummary profile={record.profile} canWrite={access.canWrite} onEdit={form.startEditing} />}
      <ListDivider />

      <ListSection title={t('students.consultations.title')} footer={t('students.consultations.description')}>
        {access.canWrite && <ConsultationComposer record={access.recordConsultation} />}
        <ConsultationList consultations={access.consultations} />
      </ListSection>
      <ListDivider />

      <ListSection title={t('students.history.title')} footer={t('students.history.description')}>
        {access.canWrite && <ObservationComposer add={access.addObservation} />}
        <StudentHistory history={access.history} />
      </ListSection>
    </StackPage>
  )
}

// Cadastro é da instituição: aqui só se lê. Contato de responsável só chega a quem pode
// vinculá-lo, então lista vazia também cobre quem não tem esse acesso.
function StudentRegistration({ student }: Readonly<{ student: StudentDetail }>) {
  const { t } = useTranslation()

  return (
    <ListSection title={t('students.record.registration.title')} footer={t('students.record.registration.description')}>
      <ListRow title={t('students.record.registration.birthDate')} value={formatCalendarDate(student.birthDate)} />
      {student.socialName !== null && <ListRow title={t('students.record.registration.socialName')} value={student.socialName} />}
      {student.guardians.length === 0
        ? <ListRow title={t('students.record.registration.guardians')} description={t('students.record.registration.noGuardians')} />
        : student.guardians.map((guardian) => (
            <ListRow
              key={guardian.id}
              title={guardian.fullName}
              description={t('students.record.registration.guardianContact', {
                relationship: t(`students.relationship.${guardian.relationship}`),
                contact: [guardian.phone, guardian.email].filter((value) => value !== null).join(' · '),
              })}
            />
          ))}
    </ListSection>
  )
}

function StudentProfileSummary({ profile, canWrite, onEdit }: Readonly<{ profile: StudentProfileState; canWrite: boolean; onEdit: () => void }>) {
  const { t } = useTranslation()

  if (profile.status === 'empty') {
    return (
      <ListSection title={t('students.profile.title')}>
        <EmptyState title={t('students.profile.emptyTitle')} description={t(canWrite ? 'students.profile.emptyDescription' : 'students.profile.emptyReadOnly')} />
        {canWrite && <Button label={t('students.profile.fill')} onPress={onEdit} />}
      </ListSection>
    )
  }

  const revision = profile.revision
  const conditions = revision.conditions.map((condition) => t(`students.conditions.${condition}`)).join(', ')
  return (
    <ListSection
      title={t('students.profile.title')}
      footer={t('students.profile.lastUpdate', { name: revision.recordedBy.name, date: formatDateTime(revision.recordedAt) })}
    >
      <ListRow title={t('students.profile.fields.schoolGrade')} value={revision.schoolGrade ?? t('students.profile.notInformed')} />
      <ListRow title={t('students.profile.fields.conditions')} description={conditions === '' ? t('students.profile.notInformed') : conditions} />
      <ListRow title={t('students.profile.fields.supportNeeds')} description={revision.supportNeeds ?? t('students.profile.notInformed')} />
      {canWrite && <Button label={t('students.profile.edit')} variant="outline" onPress={onEdit} />}
    </ListSection>
  )
}

function StudentProfileEditor({ form, onSave }: Readonly<{ form: StudentProfileForm; onSave: () => void }>) {
  const { t } = useTranslation()
  const errorFor = (field: StudentProfileTextField) => form.invalidFields.has(field) ? t(`students.profile.invalid.${field}`) : undefined

  return (
    <View style={styles.stack}>
      <ListSection title={t('students.profile.fields.schoolGrade')} footer={t('students.profile.editorHint')}>
        <FormField id="student-profile-schoolGrade" label={t('students.profile.fields.schoolGrade')} isRequired={false} error={errorFor('schoolGrade')}>
          {(control) => <Input {...control} autoCorrect={false} editable={!form.isSaving} value={form.values.schoolGrade} onChangeText={(value) => { form.change('schoolGrade', value) }} />}
        </FormField>
      </ListSection>
      <ListDivider />

      <ListSection title={t('students.profile.fields.conditions')} footer={t('students.profile.conditionsHint')}>
        {STUDENT_CONDITIONS.map((condition) => (
          <CheckboxRow
            key={condition}
            label={t(`students.conditions.${condition}`)}
            isChecked={form.values.conditions.includes(condition)}
            isDisabled={form.isSaving}
            onChange={(isChecked) => { form.setCondition(condition, isChecked) }}
          />
        ))}
      </ListSection>
      <ListDivider />

      <ListSection title={t('students.profile.fields.supportNeeds')}>
        <FormField id="student-profile-supportNeeds" label={t('students.profile.fields.supportNeeds')} isRequired={false} hint={t('students.profile.supportNeedsHint')} error={errorFor('supportNeeds')}>
          {(control) => <Textarea {...control} editable={!form.isSaving} value={form.values.supportNeeds} onChangeText={(value) => { form.change('supportNeeds', value) }} />}
        </FormField>
      </ListSection>

      {form.failure !== undefined && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" tone="danger">{t(`students.profile.failure.${form.failure}`)}</Text>}
      <Button
        label={form.isSaving ? t('students.profile.saving') : t(form.failure === 'conflict' ? 'students.profile.saveReplacing' : 'students.profile.save')}
        isBusy={form.isSaving}
        isDisabled={form.isSaving}
        onPress={onSave}
      />
      <Button label={t('students.profile.cancel')} variant="outline" isDisabled={form.isSaving} onPress={form.cancel} />
    </View>
  )
}

function ObservationComposer({ add }: Readonly<{ add: StudentRecordAccess['addObservation'] }>) {
  const { t } = useTranslation()
  const toast = useToast()
  const form = useObservationForm({ add })

  async function confirm(): Promise<void> {
    if (await form.confirm() === 'saved') {
      toast({ type: 'success', title: t('toast.studentRecord.observationSaved.title'), subtitle: t('toast.studentRecord.observationSaved.description') })
    }
  }

  return (
    <View style={styles.stackTight}>
      <FormField
        id="student-observation"
        label={t('students.observation.label')}
        isRequired
        hint={t('students.observation.hint', { maximum: form.maxLength })}
        error={form.failure === 'invalid' ? t('students.observation.invalid', { maximum: form.maxLength }) : undefined}
      >
        {(control) => <Textarea {...control} maxLength={form.maxLength} editable={!form.isConfirming} value={form.body} onChangeText={form.setBody} />}
      </FormField>
      <Button label={t('students.observation.submit')} variant="outline" onPress={form.request} />
      {form.failure === 'server' && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" tone="danger">{t('students.observation.failed')}</Text>}
      {form.isConfirming && (
        <ConfirmationSheet
          title={t('students.observation.confirmTitle')}
          message={t('students.observation.confirmDescription')}
          confirmLabel={t('students.observation.confirm')}
          cancelLabel={t('students.observation.keepEditing')}
          confirmVariant="primary"
          isBusy={form.isSaving}
          onConfirm={() => { void confirm() }}
          onCancel={form.cancel}
        />
      )}
    </View>
  )
}

function ConsultationComposer({ record }: Readonly<{ record: StudentRecordAccess['recordConsultation'] }>) {
  const { t } = useTranslation()
  const toast = useToast()
  const form = useConsultationForm({ record })
  // Aberto/fechado é estado de tela, não de dado: o formulário fica recolhido para a ficha
  // não abrir com três campos vazios na frente do que já foi registrado.
  const [isOpen, setIsOpen] = useState(false)
  const errorFor = (field: ConsultationField) => form.invalidFields.has(field)
    ? t(`students.consultations.invalid.${field}`, { maximum: field === 'notes' ? form.notesMaxLength : form.maxDurationMinutes })
    : undefined

  async function confirm(): Promise<void> {
    if (await form.confirm() === 'saved') {
      setIsOpen(false)
      toast({ type: 'success', title: t('toast.studentRecord.consultationSaved.title'), subtitle: t('toast.studentRecord.consultationSaved.description') })
    }
  }

  if (!isOpen) return <Button label={t('students.consultations.open')} variant="outline" onPress={() => { setIsOpen(true) }} />

  return (
    <View style={styles.stackTight}>
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
      <FormField id="consultation-notes" label={t('students.consultations.fields.notes')} isRequired hint={t('students.consultations.notesHint')} error={errorFor('notes')}>
        {(control) => (
          <Textarea {...control} maxLength={form.notesMaxLength} editable={!form.isConfirming} value={form.values.notes} onChangeText={(value) => { form.change('notes', value) }} />
        )}
      </FormField>
      <Button label={t('students.consultations.submit')} onPress={form.request} />
      <Button label={t('students.consultations.close')} variant="outline" onPress={() => { setIsOpen(false) }} />
      {form.failure !== undefined && form.failure !== 'invalid' && (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" tone="danger">{t(`students.consultations.failure.${form.failure}`)}</Text>
      )}
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
    </View>
  )
}

function ConsultationList({ consultations }: Readonly<{ consultations: StudentConsultationsState }>) {
  const { t } = useTranslation()

  switch (consultations.status) {
    case 'loading':
      return <Text tone="muted" accessibilityLiveRegion="polite">{t('students.consultations.loading')}</Text>
    case 'failed':
      return <Text accessibilityRole="alert" tone="danger">{t('students.consultations.failed')}</Text>
    case 'ready':
      if (consultations.consultations.length === 0) {
        return <EmptyState title={t('students.consultations.emptyTitle')} description={t('students.consultations.emptyDescription')} />
      }
      return (
        <View accessibilityRole="list">
          {consultations.consultations.map((consultation) => (
            <ListRow
              key={consultation.id}
              title={t('students.consultations.summary', { date: formatDateTime(consultation.occurredAt), minutes: consultation.durationMinutes })}
              description={t('students.consultations.recordedBy', { name: consultation.recordedBy.name })}
            >
              <Text>{consultation.notes}</Text>
            </ListRow>
          ))}
        </View>
      )
    default:
      return assertNever(consultations)
  }
}

function StudentHistory({ history }: Readonly<{ history: StudentHistoryState }>) {
  const { t } = useTranslation()

  switch (history.status) {
    case 'loading':
      return <Text tone="muted" accessibilityLiveRegion="polite">{t('students.history.loading')}</Text>
    case 'failed':
      return <Text accessibilityRole="alert" tone="danger">{t('students.history.failed')}</Text>
    case 'ready':
      if (history.entries.length === 0) return <EmptyState title={t('students.history.emptyTitle')} description={t('students.history.emptyDescription')} />
      return (
        <View accessibilityRole="list">
          {history.entries.map((entry) => <HistoryItem key={`${entry.kind}-${entry.id}`} entry={entry} />)}
        </View>
      )
    default:
      return assertNever(history)
  }
}

function HistoryItem({ entry }: Readonly<{ entry: StudentHistoryEntry }>) {
  const { t } = useTranslation()

  return (
    <ListRow
      title={t(`students.history.kind.${entry.kind}`)}
      description={t('students.history.meta', { name: entry.recordedBy.name, date: formatDateTime(entry.recordedAt) })}
    >
      <Text>
        {entry.kind === 'observation'
          ? entry.body
          : t('students.history.changedFields', { fields: entry.changedFields.map((field) => t(`students.profile.fields.${field}`)).join(', ') })}
      </Text>
    </ListRow>
  )
}

// Campos explícitos em vez de `dateStyle`: o Intl do Hermes não garante as opções de estilo
// em todo Android, e as partes numéricas dão o mesmo resultado em pt-BR.
const DATE_TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// Instante gravado pela API (UTC), mostrado no fuso de quem lê.
function formatDateTime(iso: string): string {
  return DATE_TIME_FORMAT.format(new Date(iso))
}

// Data de calendário sem fuso: passar por `Date` a deslocaria um dia a oeste de UTC.
function formatCalendarDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.lg },
  stackTight: { gap: SPACING.sm },
})
