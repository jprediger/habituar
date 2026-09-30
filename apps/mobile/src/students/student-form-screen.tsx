import { CONSENT_TERMS, createStudentInputSchema, updateStudentInputSchema } from '@habituar/core/students'
import type { StudentId } from '@habituar/core/identity/ids'
import type { ConsentDocumentInput, StudentDetail } from '@habituar/core/students'
import { SPACING } from '@habituar/design-tokens/spacing'
import { useState } from 'react'
import * as DocumentPicker from 'expo-document-picker'
import { readAsStringAsync } from 'expo-file-system/legacy'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { FormField } from '../components/ui/form-field'
import { Input } from '../components/ui/input'
import { ListDivider } from '../components/ui/list-divider'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { SwitchRow } from '../components/ui/switch-row'
import { Text } from '../components/ui/text'
import { useToast } from '../components/ui/toast'
import { DatePickerField } from './date-picker-field'
import type { InstitutionSession } from '../session/session-screen'

/** Formulário de cadastro e edição; valida a entrada pelo contrato antes de enviar. */
export function StudentFormScreen({ session, studentId, onDone }: Readonly<{ session: InstitutionSession; studentId?: StudentId | undefined; onDone: () => void }>) {
  if (studentId === undefined) return <StudentFormContent session={session} onDone={onDone} />
  return <EditStudentForm session={session} studentId={studentId} onDone={onDone} />
}

function EditStudentForm({ session, studentId, onDone }: Readonly<{ session: InstitutionSession; studentId: StudentId; onDone: () => void }>) {
  const { t } = useTranslation()
  const detail = habituar.useStudentDetail(session.membership.institution.id, studentId)
  if (detail.state.status !== 'ready') return <StackPage title={t('students.edit')}>{detail.state.status === 'loading' ? <Text>{t('students.loading')}</Text> : <><Text accessibilityRole="alert">{t('students.loadFailed')}</Text><Button label={t('students.retry')} onPress={() => { void detail.refresh() }} /></>}</StackPage>
  return <StudentFormContent session={session} studentId={studentId} initial={detail.state.student} onDone={onDone} />
}

function StudentFormContent({ session, studentId, initial, onDone }: Readonly<{ session: InstitutionSession; studentId?: StudentId | undefined; initial?: StudentDetail | undefined; onDone: () => void }>) {
  const { t } = useTranslation()
  const institutionId = session.membership.institution.id
  const form = habituar.useStudentForm(institutionId, studentId)
  const showToast = useToast()
  const [fullName, setFullName] = useState<string | undefined>(undefined)
  const [socialName, setSocialName] = useState<string | undefined>(undefined)
  const [birthDate, setBirthDate] = useState<string | undefined>(undefined)
  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [signedOn, setSignedOn] = useState('')
  const [document, setDocument] = useState<ConsentDocumentInput | undefined>()
  const [documentError, setDocumentError] = useState(false)
  const [hasGuardian, setHasGuardian] = useState(false)
  const [hasConsent, setHasConsent] = useState(false)
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false)
  const values = { fullName: fullName ?? initial?.fullName ?? '', socialName: socialName ?? initial?.socialName ?? '', birthDate: birthDate ?? initial?.birthDate ?? '' }
  const isEditing = studentId !== undefined
  const canEdit = session.membership.permissions.some((permission) => permission.key === 'student.update')
  const canCreate = session.membership.permissions.some((permission) => permission.key === 'student.create' && permission.scope === 'institution')
  if ((isEditing && !canEdit) || (!isEditing && !canCreate)) return null

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'], copyToCacheDirectory: true })
    const asset = result.canceled ? undefined : result.assets[0]
    if (asset === undefined) return
    setDocument(undefined)
    if (asset.size !== undefined && asset.size > 2_000_000) { setDocumentError(true); return }
    const mediaType = asset.mimeType
    if (mediaType !== 'application/pdf' && mediaType !== 'image/jpeg' && mediaType !== 'image/png' && mediaType !== 'image/webp' && mediaType !== 'image/gif' && mediaType !== 'image/heic' && mediaType !== 'image/heif') { setDocumentError(true); return }
    try {
      const base64 = asset.base64 ?? await readAsStringAsync(asset.uri, { encoding: 'base64' })
      setDocument({ fileName: asset.name, mediaType, base64 }); setDocumentError(false)
    } catch { setDocumentError(true) }
  }

  const save = async () => {
    setHasTriedSubmit(true)
    if (!isEditing && hasConsent && document === undefined) { setDocumentError(true); return }
    if (isEditing && initial !== undefined) {
      const parsed = updateStudentInputSchema.safeParse({ institutionId, studentId, expectedVersion: initial.version, fullName: values.fullName, socialName: values.socialName || null, birthDate: values.birthDate })
      if (!parsed.success) return
      try {
        const result = await form.submit(parsed.data)
        showToast({ type: 'success', title: t('students.saved'), subtitle: result.fullName }); onDone()
      } catch { return }
      return
    }
    const parsed = createStudentInputSchema.safeParse({
      institutionId, fullName: values.fullName, socialName: values.socialName || null, birthDate: values.birthDate,
      ...(hasGuardian ? { guardian: { fullName: guardianName, relationship: 'other', email: guardianEmail || null, phone: null } } : {}),
      ...(hasConsent ? { institutionalConsent: { signedOn, termVersion: CONSENT_TERMS.institutionRecord, document } } : {}),
    })
    if (!parsed.success) return
    try {
      const result = await form.submit(parsed.data)
      showToast({ type: 'success', title: t('students.created'), subtitle: result.fullName }); onDone()
    } catch { return }
  }

  return <StackPage title={t(isEditing ? 'students.edit' : 'students.create')}>
    {(!isEditing || initial !== undefined) && <View style={styles.stack}>
      <ListSection title={t('students.data')}>
        <FormField id="student-full-name" label={t('students.fullName')} isRequired error={hasTriedSubmit && values.fullName.trim().length === 0 ? t('students.required') : undefined}>{(control) => <Input {...control} value={values.fullName} onChangeText={setFullName} hasError={control.hasError} />}</FormField>
        <FormField id="student-social-name" label={t('students.socialName')} isRequired={false}>{(control) => <Input {...control} value={values.socialName} onChangeText={setSocialName} />}</FormField>
        <DatePickerField id="student-birth-date" label={t('students.birthDate')} value={values.birthDate} onChange={setBirthDate} error={hasTriedSubmit && !values.birthDate ? t('students.invalidDate') : undefined} />
      </ListSection>
      {!isEditing && <>
        <ListDivider />
        <ListSection title={t('students.guardians')}>
          <SwitchRow label={t('students.addGuardian')} isOn={hasGuardian} onChange={setHasGuardian} />
          {hasGuardian && <>
            <FormField id="guardian-name" label={t('students.guardianName')} isRequired error={hasTriedSubmit && guardianName.trim().length === 0 ? t('students.required') : undefined}>{(control) => <Input {...control} value={guardianName} onChangeText={setGuardianName} hasError={control.hasError} />}</FormField>
            <FormField id="guardian-email" label={t('students.guardianEmail')} isRequired={false}>{(control) => <Input {...control} value={guardianEmail} onChangeText={setGuardianEmail} keyboardType="email-address" autoCapitalize="none" />}</FormField>
          </>}
        </ListSection>
        <ListDivider />
        <ListSection title={t('students.consent')} footer={t('students.consentHint')}>
          <SwitchRow label={t('students.termSigned')} isOn={hasConsent} onChange={(value) => { setHasConsent(value); if (!value) { setDocument(undefined); setSignedOn(''); setDocumentError(false) } }} />
          {hasConsent && <><Button variant="outline" label={document?.fileName ?? t('students.selectDocument')} onPress={() => { void pickDocument() }} />
            {documentError && <Text accessibilityRole="alert" tone="danger">{t('students.invalidDocument')}</Text>}
            <DatePickerField id="consent-date" label={t('students.signedOn')} value={signedOn} onChange={setSignedOn} error={hasTriedSubmit && !signedOn ? t('students.invalidDate') : undefined} /></>}
        </ListSection>
      </>}
      {form.failure !== undefined && <Text accessibilityRole="alert" tone="danger">{t('students.saveFailed')}</Text>}
      <Button label={form.pending ? t('students.saving') : t('students.save')} isBusy={form.pending} isDisabled={form.pending} onPress={() => { void save() }} />
    </View>}
  </StackPage>
}

const styles = StyleSheet.create({ stack: { gap: SPACING.lg } })
