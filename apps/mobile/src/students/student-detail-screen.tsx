import type { StudentId } from '@habituar/core/identity/ids'
import { getStudentRecordCapabilities } from '@habituar/react-client/student-record-navigation'
import type { StudentDetail } from '@habituar/core/students'
import { SPACING } from '@habituar/design-tokens/spacing'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import * as Sharing from 'expo-sharing'
import { cacheDirectory, deleteAsync, writeAsStringAsync } from 'expo-file-system/legacy'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { ListSectionSkeleton } from '../components/skeletons/list-section-skeleton'
import { Skeleton } from '../components/skeletons/skeleton'
import { Button } from '../components/ui/button'
import { CheckboxRow } from '../components/ui/checkbox-row'
import { ConfirmationSheet } from '../components/ui/confirmation-sheet'
import { FormField } from '../components/ui/form-field'
import { Input } from '../components/ui/input'
import { ListRow } from '../components/ui/list-row'
import { ListDivider } from '../components/ui/list-divider'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { Text } from '../components/ui/text'
import { formatCalendarDate } from '../professional/student-record-format'
import { useToast } from '../components/ui/toast'
import type { InstitutionSession } from '../session/session-screen'
import { toStaffContext } from '../management/staff-context'

/** Exibe os dados cadastrais e vínculos que a API autorizou para este aluno. */
export function StudentDetailScreen({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const detail = habituar.useStudentDetail(session.membership.institution.id, studentId)
  const canEdit = session.membership.permissions.some((permission) => permission.key === 'student.update')
  const student = detail.state.status === 'ready' ? detail.state.student : undefined
  return <StackPage title={t('students.record.registration.title')} action={canEdit && student !== undefined && student.archivedAt === null ? { icon: 'pencil-simple', label: t('students.edit'), onPress: () => { router.push({ pathname: '/professional/students/[student-id]/edit', params: { 'student-id': studentId } }) } } : undefined}>
    {detail.state.status === 'loading' && <Skeleton><ListSectionSkeleton hasTitle rows={5} row={{ hasDescription: false, hasValue: true }} /><ListSectionSkeleton hasTitle rows={1} /></Skeleton>}
    {detail.state.status === 'error' && <><Text accessibilityRole="alert">{t('students.loadFailed')}</Text><Button variant="outline" label={t('students.retry')} onPress={() => { void detail.refresh() }} /></>}
    {student !== undefined && <View style={styles.stack}>
      <ListSection title={t('students.data')}>
        <ListRow title={t('students.fullName')} value={student.fullName} />
        {student.socialName !== null && <ListRow title={t('students.socialName')} value={student.socialName} />}
        <ListRow title={t('students.birthDate')} value={formatCalendarDate(student.birthDate)} />
        <ListRow title={t('students.ageRangeLabel')} value={t(`students.ageRange.${student.ageRange}`)} />
        <ListRow title={t('students.accountStatusLabel')} value={t(`students.accountStatus.${student.accountStatus}`)} />
      </ListSection>
      <ListDivider />
      <StudentGuardians session={session} student={student} />
      <ListDivider />
      <ListSection title={t('students.consent')}>
        <ListRow title={t('students.consentStatusLabel')} value={t(`students.consentStatus.${student.consentStatus}`)} />
        {student.institutionalDocumentId !== null && <ConsentDocumentRow session={session} student={student} />}
      </ListSection>
    </View>}
  </StackPage>
}

function ConsentDocumentRow({ session, student }: Readonly<{ session: InstitutionSession; student: StudentDetail }>) {
  const { t } = useTranslation()
  const actions = habituar.useStudentActions(session.membership.institution.id, student.id)
  const [hasError, setHasError] = useState(false)
  const open = async () => {
    if (student.institutionalDocumentId === null || cacheDirectory === null) { setHasError(true); return }
    try {
      const document = await actions.getConsentDocument({ institutionId: session.membership.institution.id, studentId: student.id, consentId: student.institutionalDocumentId })
      const extension = document.mediaType === 'application/pdf' ? 'pdf' : document.mediaType === 'image/png' ? 'png' : document.mediaType === 'image/webp' ? 'webp' : document.mediaType === 'image/gif' ? 'gif' : document.mediaType === 'image/heic' ? 'heic' : document.mediaType === 'image/heif' ? 'heif' : 'jpg'
      const uri = `${cacheDirectory}${student.institutionalDocumentId}.${extension}`
      await writeAsStringAsync(uri, document.base64, { encoding: 'base64' })
      try { await Sharing.shareAsync(uri, { mimeType: document.mediaType }) } finally { await deleteAsync(uri, { idempotent: true }) }
      setHasError(false)
    } catch { setHasError(true) }
  }
  return <><ListRow title={t('students.consentDocument')} value={student.institutionalDocumentName ?? undefined} onPress={() => { void open() }} />
    {hasError && <Text accessibilityRole="alert" tone="danger">{t('students.documentLoadFailed')}</Text>}</>
}

function StudentGuardians({ session, student }: Readonly<{ session: InstitutionSession; student: StudentDetail }>) {
  const { t } = useTranslation()
  const toast = useToast()
  const institutionId = session.membership.institution.id
  const actions = habituar.useStudentActions(institutionId, student.id)
  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | undefined>()
  const [isAddingGuardian, setIsAddingGuardian] = useState(false)
  const { canInvite: canLink, canUnlinkGuardian: canUnlink } = getStudentRecordCapabilities(session.membership.permissions)


  const addGuardian = async () => {
    if (guardianName.trim().length === 0) return
    try {
      await actions.addGuardian({ institutionId, studentId: student.id, guardian: { fullName: guardianName, relationship: 'other', email: guardianEmail.trim() || null, phone: null } })
      setIsAddingGuardian(false); setGuardianName(''); setGuardianEmail('')
      toast({ type: 'success', title: t('students.guardianAdded'), subtitle: guardianName })
    } catch { return }
  }

  return <ListSection title={t('students.guardians')}>
    {student.guardians.length === 0 && <Text tone="muted">{t('students.noGuardians')}</Text>}
    {canLink && student.archivedAt === null && <>
      <Button variant="outline" label={t('students.addGuardian')} onPress={() => { setIsAddingGuardian(!isAddingGuardian) }} />
      {isAddingGuardian && <>
        <FormField id="new-guardian-name" label={t('students.guardianName')} isRequired>{(control) => <Input {...control} value={guardianName} onChangeText={setGuardianName} />}</FormField>
        <FormField id="new-guardian-email" label={t('students.guardianEmail')} isRequired={false}>{(control) => <Input {...control} value={guardianEmail} onChangeText={setGuardianEmail} keyboardType="email-address" autoCapitalize="none" />}</FormField>
        <Button label={t('students.addGuardian')} isBusy={actions.pending} isDisabled={actions.pending || guardianName.trim().length === 0} onPress={() => { void addGuardian() }} />
      </>}
    </>}
      {student.guardians.map((guardian) => <ListRow key={guardian.id} title={guardian.fullName} description={[t(`students.relationship.${guardian.relationship}`), guardian.phone, guardian.email].filter((value) => value !== null).join(' · ')}>
        {canLink && student.archivedAt === null && guardian.email !== null && <Button variant="link" size="inline" label={t('students.inviteGuardian')} onPress={() => { void actions.invite({ institutionId, studentId: student.id, target: 'guardian', guardianId: guardian.id, email: guardian.email ?? '' }).then((result) => { setInviteUrl(result.inviteUrl) }).catch(keepSurfacedFailure) }} />}
        {canUnlink && student.archivedAt === null && <Button variant="dangerOutline" size="inline" label={t('students.removeGuardian')} onPress={() => { void actions.removeGuardian({ institutionId, studentId: student.id, guardianId: guardian.id }).then(() => { toast({ type: 'success', title: t('students.guardianRemoved'), subtitle: guardian.fullName }) }).catch(keepSurfacedFailure) }} />}
      </ListRow>)}
      {inviteUrl !== undefined && <Text selectable>{inviteUrl}</Text>}
      {actions.failure !== undefined && <Text accessibilityRole="alert" tone="danger">{t('students.actionFailed')}</Text>}
  </ListSection>
}


/** Ações administrativas isoladas das informações de acompanhamento. */
export function StudentManagementScreen({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation()
  const detail = habituar.useStudentDetail(session.membership.institution.id, studentId)
  const capabilities = getStudentRecordCapabilities(session.membership.permissions)
  return <StackPage title={t('students.record.management.title')}>
    {!capabilities.canManage ? <Text accessibilityRole="alert">{t('students.record.management.forbidden')}</Text>
      : detail.state.status === 'loading' ? <Skeleton><ListSectionSkeleton rows={3} /></Skeleton>
      : detail.state.status === 'error' ? <><Text accessibilityRole="alert">{t('students.loadFailed')}</Text><Button label={t('students.retry')} onPress={() => { void detail.refresh() }} /></>
      : <StudentManagement session={session} student={detail.state.student} />}
  </StackPage>
}

function StudentManagement({ session, student }: Readonly<{ session: InstitutionSession; student: StudentDetail }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const actions = habituar.useStudentActions(session.membership.institution.id, student.id)
  const [isArchiving, setIsArchiving] = useState(false)
  const { canManageAssignments, canArchive, canInvite } = getStudentRecordCapabilities(session.membership.permissions)
  return <>
    <ListSection title={t('students.assignments')}>
      {student.assignments.length === 0 && <Text tone="muted">{t('students.noAssignments')}</Text>}
      {student.assignments.map((assignment) => <ListRow key={assignment.id} title={assignment.name} description={t(`students.environment.${assignment.environment}`)} />)}
    </ListSection>
    {canManageAssignments && student.archivedAt === null && <AssignmentEditor session={session} student={student} />}
    {canInvite && student.archivedAt === null && <StudentInvitation session={session} student={student} />}
    {canArchive && <><ListDivider /><ListSection title={t('students.archiveSection')}>
      <Button variant="dangerOutline" label={student.archivedAt === null ? t('students.archive') : t('students.unarchive')} onPress={() => { setIsArchiving(true) }} />
      {isArchiving && <ConfirmationSheet title={t('students.archiveSection')} message={t(student.archivedAt === null ? 'students.archiveConfirm' : 'students.unarchiveConfirm', { name: student.fullName })} confirmLabel={t(student.archivedAt === null ? 'students.archive' : 'students.unarchive')} cancelLabel={t('students.cancel')} confirmVariant={student.archivedAt === null ? 'danger' : 'primary'} isBusy={actions.pending} onCancel={() => { setIsArchiving(false) }} onConfirm={() => { void (student.archivedAt === null ? actions.archive() : actions.unarchive()).then(() => { toast({ type: 'success', title: t(student.archivedAt === null ? 'students.archived' : 'students.unarchived'), subtitle: student.fullName }); router.back() }).catch(() => { setIsArchiving(false) }) }} />}
    </ListSection></>}
    {actions.failure !== undefined && <Text accessibilityRole="alert" tone="danger">{t('students.actionFailed')}</Text>}
  </>
}

const styles = StyleSheet.create({ stack: { gap: SPACING.lg } })

function AssignmentEditor({ session, student }: Readonly<{ session: InstitutionSession; student: StudentDetail }>) {
  const { t } = useTranslation()
  const toast = useToast()
  const team = habituar.useTeam(toStaffContext(session))
  const actions = habituar.useStudentActions(session.membership.institution.id, student.id)
  const [selectedIds, setSelectedIds] = useState(() => student.assignments.map((assignment) => assignment.membershipId))
  const [isEditing, setIsEditing] = useState(false)
  const save = async () => {
    try {
      await actions.replaceAssignments({ institutionId: session.membership.institution.id, studentId: student.id, membershipIds: selectedIds })
      setIsEditing(false)
      toast({ type: 'success', title: t('students.assignmentsSaved'), subtitle: student.fullName })
    } catch { return }
  }
  return <ListSection title={t('students.manageAssignments')} footer={t('students.assignmentPageHint')}>
    <Button variant="outline" label={t('students.editAssignments')} onPress={() => { setIsEditing(!isEditing) }} />
    {isEditing && <>
      {team.state.status === 'loading' && <Skeleton><ListSectionSkeleton rows={3} row={{ hasIcon: true, hasDescription: false }} /></Skeleton>}
      {team.state.status === 'failed' && <Text accessibilityRole="alert" tone="danger">{t('students.loadFailed')}</Text>}
      {team.state.status === 'ready' && team.state.items.map((member) => <CheckboxRow key={member.id} label={member.user.name} isChecked={selectedIds.includes(member.id)} onChange={(isChecked) => { setSelectedIds((ids) => isChecked ? [...ids, member.id] : ids.filter((id) => id !== member.id)) }} />)}
      {team.state.status === 'ready' && <>
        {team.pagination.hasPreviousPage && <Button variant="outline" label={t('students.previous')} onPress={team.pagination.goToPreviousPage} />}
        {team.pagination.hasNextPage && <Button variant="outline" label={t('students.next')} onPress={team.pagination.goToNextPage} />}
        <Button label={t('students.save')} isBusy={actions.pending} isDisabled={actions.pending} onPress={() => { void save() }} />
      </>}
      {actions.failure !== undefined && <Text accessibilityRole="alert" tone="danger">{t('students.actionFailed')}</Text>}
    </>}
  </ListSection>
}

function StudentInvitation({ session, student }: Readonly<{ session: InstitutionSession; student: StudentDetail }>) {
  const { t } = useTranslation()
  const actions = habituar.useStudentActions(session.membership.institution.id, student.id)
  const [email, setEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | undefined>()
  if (student.accountStatus !== 'none') return null
  return <ListSection title={t('students.record.management.inviteTitle')}>
    <FormField id="student-invite-email" label={t('students.record.management.email')} isRequired>{(control) => <Input {...control} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />}</FormField>
    <Button label={t('students.record.management.invite')} isDisabled={actions.pending || email.trim().length === 0} isBusy={actions.pending} onPress={() => { void actions.invite({ institutionId: session.membership.institution.id, studentId: student.id, target: 'student', guardianId: null, email: email.trim() }).then((result) => { setInviteUrl(result.inviteUrl) }).catch(keepSurfacedFailure) }} />
    {inviteUrl !== undefined && <Text selectable>{inviteUrl}</Text>}
    {actions.failure !== undefined && <Text accessibilityRole="alert" tone="danger">{t('students.actionFailed')}</Text>}
  </ListSection>
}

// `useStudentActions` já registra a falha em `actions.failure`, que a seção mostra como
// alerta; aqui só se impede que a rejeição relançada vire promessa não tratada.
function keepSurfacedFailure(): void {
  return
}
