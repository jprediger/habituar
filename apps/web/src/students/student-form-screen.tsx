import { CONSENT_TERMS, createStudentInputSchema, updateStudentInputSchema } from '@habituar/core/students'
import type { ConsentDocumentInput, StudentDetail } from '@habituar/core/students'
import { useNavigate } from '@tanstack/react-router'
import { useId, useState } from 'react'
import type { ReactElement, SyntheticEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import { FormField } from '../components/ui/form-field.js'
import { Input } from '../components/ui/input.js'
import { PageHeader } from '../components/ui/page-header.js'
import { Section } from '../components/ui/section.js'
import { useInstitutionSession } from '../session/institution-session.js'

type StudentFormProps = Readonly<{ student?: StudentDetail; onClose?: () => void }>

/** Formulário de dados básicos, responsável inicial e registro do termo institucional. */
export function StudentFormScreen({ student, onClose }: StudentFormProps): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()
  const navigate = useNavigate()
  const form = habituar.useStudentForm(session.membership.institution.id, student?.id)
  const [fullName, setFullName] = useState(student?.fullName ?? '')
  const [socialName, setSocialName] = useState(student?.socialName ?? '')
  const [birthDate, setBirthDate] = useState(student?.birthDate ?? '')
  const [guardianName, setGuardianName] = useState('')
  const [guardianRelationship, setGuardianRelationship] = useState<'mother' | 'father' | 'grandparent' | 'legal-guardian' | 'other'>('mother')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [hasConsent, setHasConsent] = useState(false)
  const [signedOn, setSignedOn] = useState('')
  const [document, setDocument] = useState<ConsentDocumentInput | undefined>()
  const [error, setError] = useState('')
  const fieldPrefix = useId()

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError('')
    if (student === undefined && hasConsent && document === undefined) { setError(t('students.documentRequired')); return }
    const basic = { institutionId: session.membership.institution.id, fullName, socialName: socialName.trim() || null, birthDate }
    const result = student === undefined
      ? createStudentInputSchema.safeParse({ ...basic,
          ...(guardianName.trim() ? { guardian: { fullName: guardianName, relationship: guardianRelationship, email: guardianEmail.trim() || null, phone: guardianPhone.trim() || null } } : {}),
          ...(hasConsent ? { institutionalConsent: { signedOn, termVersion: CONSENT_TERMS.institutionRecord, document } } : {}),
        })
      : updateStudentInputSchema.safeParse({ ...basic, studentId: student.id, expectedVersion: student.version })
    if (!result.success) { setError(t('students.invalid')); return }
    try {
      // Os dois schemas preservam a discriminação do modo; o hook aplica o contrato respectivo.
      const saved = student === undefined
        ? await form.submit(createStudentInputSchema.parse(result.data))
        : await form.submit(updateStudentInputSchema.parse(result.data))
      if (onClose !== undefined) onClose()
      else await navigate({ to: '/professional/students/$studentId', params: { studentId: saved.id } })
    } catch { setError(t('students.saveError')) }
  }

  return <div className="flex max-w-[48rem] flex-col gap-xxl">
    <PageHeader eyebrow={session.membership.institution.name} title={student === undefined ? t('students.new') : t('students.edit')} description={t('students.formDescription')} />
    <form className="flex flex-col gap-xxl" onSubmit={(event) => { void submit(event) }}>
      <Section title={t('students.dataSection')}><div className="grid gap-md sm:grid-cols-2">
        <FormField id={`${fieldPrefix}-name`} label={t('students.fullName')} isRequired requiredMarkLabel={t('students.required')}>
          {(control) => <Input {...control} value={fullName} onChange={(event) => { setFullName(event.target.value) }} maxLength={200} />}
        </FormField>
        <FormField id={`${fieldPrefix}-social`} label={t('students.socialName')} isRequired={false} requiredMarkLabel={t('students.required')}>
          {(control) => <Input {...control} value={socialName} onChange={(event) => { setSocialName(event.target.value) }} maxLength={200} />}
        </FormField>
        <FormField id={`${fieldPrefix}-birth`} label={t('students.birthDate')} isRequired requiredMarkLabel={t('students.required')}>
          {(control) => <Input {...control} type="date" value={birthDate} onChange={(event) => { setBirthDate(event.target.value) }} />}
        </FormField>
      </div></Section>
      {student === undefined && <>
        <Section title={t('students.guardiansSection')} description={t('students.initialGuardianHint')}><div className="grid gap-md sm:grid-cols-2">
          <FormField id={`${fieldPrefix}-guardian`} label={t('students.guardianName')} isRequired={false} requiredMarkLabel={t('students.required')}>
            {(control) => <Input {...control} value={guardianName} onChange={(event) => { setGuardianName(event.target.value) }} maxLength={200} />}
          </FormField>
          <div className="flex flex-col gap-xs"><label htmlFor={`${fieldPrefix}-relationship`} className="text-body font-medium">{t('students.relationship')}</label>
            <select id={`${fieldPrefix}-relationship`} className="min-h-tap-target rounded-field border border-border bg-surface px-sm text-body" value={guardianRelationship} onChange={(event) => { setGuardianRelationship(event.target.value === 'father' ? 'father' : event.target.value === 'grandparent' ? 'grandparent' : event.target.value === 'legal-guardian' ? 'legal-guardian' : event.target.value === 'other' ? 'other' : 'mother') }}>
              {(['mother', 'father', 'grandparent', 'legal-guardian', 'other'] as const).map((relationship) => <option key={relationship} value={relationship}>{t(`students.relationships.${relationship}`)}</option>)}
            </select>
          </div>
          <FormField id={`${fieldPrefix}-email`} label={t('students.email')} isRequired={false} requiredMarkLabel={t('students.required')}>
            {(control) => <Input {...control} type="email" value={guardianEmail} onChange={(event) => { setGuardianEmail(event.target.value) }} />}
          </FormField>
          <FormField id={`${fieldPrefix}-phone`} label={t('students.phone')} isRequired={false} requiredMarkLabel={t('students.required')}>
            {(control) => <Input {...control} type="tel" value={guardianPhone} onChange={(event) => { setGuardianPhone(event.target.value) }} maxLength={40} />}
          </FormField>
        </div></Section>
        <Section title={t('students.consentSection')} description={t('students.consentHint')}>
          <label className="flex items-center gap-sm text-body"><input type="checkbox" checked={hasConsent} onChange={(event) => { setHasConsent(event.target.checked); if (!event.target.checked) { setDocument(undefined); setSignedOn('') } }} />{t('students.institutionConsent')}</label>
          {hasConsent && <div className="flex flex-col gap-xs">
            <label className="text-body font-medium" htmlFor={`${fieldPrefix}-document`}>{t('students.consentDocument')}</label>
            <input id={`${fieldPrefix}-document`} type="file" accept="application/pdf,image/*" required onChange={(event) => {
              const file = event.target.files?.[0]
              setDocument(undefined)
              if (file === undefined) return
              if (file.size > 2_000_000 || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'].includes(file.type)) { setError(t('students.invalidDocument')); return }
              const reader = new FileReader()
              reader.onload = () => {
                const data = reader.result
                if (typeof data !== 'string') { setError(t('students.invalidDocument')); return }
                setDocument({ fileName: file.name, mediaType: file.type === 'application/pdf' ? 'application/pdf' : file.type === 'image/jpeg' ? 'image/jpeg' : file.type === 'image/png' ? 'image/png' : file.type === 'image/gif' ? 'image/gif' : file.type === 'image/heic' ? 'image/heic' : file.type === 'image/heif' ? 'image/heif' : 'image/webp', base64: data.slice(data.indexOf(',') + 1) })
              }
              reader.onerror = () => { setError(t('students.invalidDocument')) }
              reader.readAsDataURL(file)
            }} />
          </div>}
          {hasConsent && <FormField id={`${fieldPrefix}-signed`} label={t('students.signedOn')} isRequired requiredMarkLabel={t('students.required')}>
            {(control) => <Input {...control} type="date" value={signedOn} onChange={(event) => { setSignedOn(event.target.value) }} />}
          </FormField>}
        </Section>
      </>}
      {(error || form.failure) && <p role="alert" className="text-body text-danger">{error || t('students.saveError')}</p>}
      <div className="flex flex-wrap gap-sm"><Button type="submit" disabled={form.pending}>{form.pending ? t('students.saving') : t('students.save')}</Button><Button type="button" variant="outline" onClick={() => { if (onClose !== undefined) onClose(); else void navigate({ to: '/professional/students' }) }}>{t('students.cancel')}</Button></div>
    </form>
  </div>
}
