import type { StudentId } from '@habituar/core/identity/ids'
import { STUDENT_CONDITIONS } from '@habituar/core/student-records'
import type { StudentProfileState } from '@habituar/core/student-records'
import { SPACING } from '@habituar/design-tokens/spacing'
import { useStudentProfileEditor } from '@habituar/react-client/student-record-forms'
import type { StudentProfileTextField } from '@habituar/react-client/student-record-forms'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { CheckboxRow } from '../components/ui/checkbox-row'
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
import { formatRecordDateTime } from './student-record-format'
import { StudentRecordGate, StudentRecordWriteGate } from './student-record-gate'
import type { ReadyStudentRecord } from './student-record-gate'

/**
 * Dados de apoio da ficha para leitura, com quem atualizou por último. Editar abre a tela
 * própria pela barra, só para quem escreve na ficha.
 */
export function StudentProfileScreen({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const overview = habituar.useStudentRecordOverview(session.membership, studentId)
  const title = t('students.profile.title')

  return (
    <StudentRecordGate title={title} overview={overview}>
      {({ record, canWrite }) => (
        <StackPage
          title={title}
          action={canWrite
            ? {
                icon: 'pencil-simple',
                label: t(record.profile.status === 'empty' ? 'students.profile.fill' : 'students.profile.edit'),
                onPress: () => { router.push({ pathname: '/professional/students/[student-id]/profile/edit', params: { 'student-id': studentId } }) },
              }
            : undefined}
        >
          <StudentProfileSummary profile={record.profile} canWrite={canWrite} />
        </StackPage>
      )}
    </StudentRecordGate>
  )
}

function StudentProfileSummary({ profile, canWrite }: Readonly<{ profile: StudentProfileState; canWrite: boolean }>) {
  const { t } = useTranslation()

  if (profile.status === 'empty') {
    return <EmptyState title={t('students.profile.emptyTitle')} description={t(canWrite ? 'students.profile.emptyDescription' : 'students.profile.emptyReadOnly')} />
  }

  const revision = profile.revision
  const conditions = revision.conditions.map((condition) => t(`students.conditions.${condition}`)).join(', ')
  return (
    <ListSection footer={t('students.profile.lastUpdate', { name: revision.recordedBy.name, date: formatRecordDateTime(revision.recordedAt) })}>
      <ListRow title={t('students.profile.fields.schoolGrade')} value={revision.schoolGrade ?? t('students.profile.notInformed')} />
      <ListRow title={t('students.profile.fields.conditions')} description={conditions === '' ? t('students.profile.notInformed') : conditions} />
      <ListRow title={t('students.profile.fields.supportNeeds')} description={revision.supportNeeds ?? t('students.profile.notInformed')} />
    </ListSection>
  )
}

/**
 * Edição dos dados de apoio em tela própria. Salvar grava uma revisão nova, avisa por toast
 * e volta; conflito com outra gravação mantém o rascunho na tela para a pessoa decidir.
 */
export function StudentProfileEditScreen({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation()
  const overview = habituar.useStudentRecordOverview(session.membership, studentId)

  return (
    <StudentRecordWriteGate title={t('students.profile.edit')} overview={overview}>
      {(ready) => <StudentProfileEditor ready={ready} />}
    </StudentRecordWriteGate>
  )
}

// Montado só com a ficha pronta: o editor parte da revisão em tela no primeiro render.
function StudentProfileEditor({ ready }: Readonly<{ ready: ReadyStudentRecord }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const form = useStudentProfileEditor({ profile: ready.record.profile, save: ready.recordProfile })
  const errorFor = (field: StudentProfileTextField) => form.invalidFields.has(field) ? t(`students.profile.invalid.${field}`) : undefined

  async function save(): Promise<void> {
    if (await form.submit() === 'saved') {
      toast({ type: 'success', title: t('toast.studentRecord.profileSaved.title'), subtitle: t('toast.studentRecord.profileSaved.description') })
      router.back()
    }
  }

  return (
    <StackPage title={t(ready.record.profile.status === 'empty' ? 'students.profile.fill' : 'students.profile.edit')}>
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

      <View style={styles.actions}>
        {form.failure !== undefined && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" tone="danger">{t(`students.profile.failure.${form.failure}`)}</Text>}
        <Button
          label={form.isSaving ? t('students.profile.saving') : t(form.failure === 'conflict' ? 'students.profile.saveReplacing' : 'students.profile.save')}
          isBusy={form.isSaving}
          isDisabled={form.isSaving}
          onPress={() => { void save() }}
        />
      </View>
    </StackPage>
  )
}

const styles = StyleSheet.create({
  actions: { gap: SPACING.sm },
})
