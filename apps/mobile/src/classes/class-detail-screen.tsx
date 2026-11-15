import type { ClassDetail } from '@habituar/core/classes'
import type { ClassId, MembershipId, StudentId } from '@habituar/core/identity/ids'
import { SPACING } from '@habituar/design-tokens/spacing'
import { getClassCapabilities } from '@habituar/react-client/class-hooks'
import type { ClassCapabilities } from '@habituar/react-client/class-hooks'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { ConfirmationSheet } from '../components/ui/confirmation-sheet'
import { ListDivider } from '../components/ui/list-divider'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { ClassCandidatePicker } from './class-candidate-picker'

type Confirmation =
  | Readonly<{ kind: 'enroll'; studentId: StudentId; name: string }>
  | Readonly<{ kind: 'remove-student'; studentId: StudentId; name: string }>
  | Readonly<{ kind: 'remove-staff'; membershipId: MembershipId; name: string }>
  | Readonly<{ kind: 'archive' | 'unarchive' }>

function formatDay(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))
}

/** Visualização institucional; vínculos da turma não alteram acompanhamentos individuais. */
export function ClassDetailScreen({ session, classId }: Readonly<{ session: InstitutionSession; classId: ClassId }>) {
  const { t } = useTranslation('classes')
  const state = habituar.useClassDetail(session.membership, classId)
  const capabilities = getClassCapabilities(session.membership)
  const detail = state.state.status === 'ready' ? state.state.detail : undefined

  return <StackPage title={detail?.name ?? t('detailTitle')}>
    {state.state.status === 'loading' && <Text>{t('loading')}</Text>}
    {state.state.status === 'failed' && <>
      <Text accessibilityRole="alert" tone="danger">{t(state.state.failure === 'forbidden' ? 'errors.forbidden' : 'errors.loadDetail')}</Text>
      <Button variant="outline" label={t('retry')} onPress={() => { void state.refresh() }} />
    </>}
    {detail !== undefined && <ClassDetails key={detail.id} session={session} detail={detail} capabilities={capabilities} onRefresh={() => { void state.refresh() }} />}
  </StackPage>
}

function ClassDetails({ session, detail, capabilities, onRefresh }: Readonly<{
  session: InstitutionSession
  detail: ClassDetail
  capabilities: ClassCapabilities
  onRefresh: () => void
}>) {
  const { t } = useTranslation('classes')
  const router = useRouter()
  const actions = habituar.useClassActions(session.membership)
  const archived = detail.archivedAt !== null
  const candidates = habituar.useClassCandidates(session.membership, capabilities.canManage && !archived)
  const [picker, setPicker] = useState<'student' | 'staff' | undefined>()
  const [confirmation, setConfirmation] = useState<Confirmation | undefined>()
  const [feedback, setFeedback] = useState<string | undefined>()
  const [failed, setFailed] = useState(false)
  const activeStudents = detail.enrollments.filter(item => item.leftAt === null)
  const pastStudents = detail.enrollments.filter(item => item.leftAt !== null)
  const activeStaff = detail.staff.filter(item => item.leftAt === null)
  const pastStaff = detail.staff.filter(item => item.leftAt !== null)

  async function run(operation: () => Promise<ClassDetail>, success: string): Promise<void> {
    setFeedback(undefined)
    setFailed(false)
    try {
      await operation()
      setFeedback(success)
      setConfirmation(undefined)
      setPicker(undefined)
    } catch {
      setFailed(true)
    }
  }

  async function confirm(): Promise<void> {
    const target = confirmation
    if (target === undefined) return
    switch (target.kind) {
      case 'enroll':
        await run(() => actions.enrollStudent(detail.id, target.studentId), t('messages.enrolled'))
        return
      case 'remove-student':
        await run(() => actions.removeStudent(detail.id, target.studentId), t('messages.studentRemoved'))
        return
      case 'remove-staff':
        await run(() => actions.removeStaff(detail.id, target.membershipId), t('messages.staffRemoved'))
        return
      case 'archive':
        await run(() => actions.archive(detail.id, detail.version), t('messages.archived'))
        return
      case 'unarchive':
        await run(() => actions.unarchive(detail.id, detail.version), t('messages.reopened'))
    }
  }

  const confirmationText = confirmation === undefined ? '' : confirmation.kind === 'enroll'
    ? t('confirm.enroll', { name: confirmation.name })
    : confirmation.kind === 'remove-student' ? t('confirm.removeStudent', { name: confirmation.name })
      : confirmation.kind === 'remove-staff' ? t('confirm.removeStaff', { name: confirmation.name })
        : t(confirmation.kind === 'archive' ? 'confirm.archive' : 'confirm.unarchive')
  const confirmationLabel = confirmation?.kind === 'archive' ? t('actions.archive')
    : confirmation?.kind === 'unarchive' ? t('actions.reopen') : t('actions.confirm')

  return <View style={styles.stack}>
    <Text tone="muted">{t(archived ? 'status.archived' : 'status.active')}</Text>
    {detail.description !== null && <Text>{detail.description}</Text>}
    <Text tone="muted">{t('memberCounts', { students: detail.studentCount, staff: detail.staffCount })}</Text>
    <Button variant="outline" label={t('refresh')} onPress={onRefresh} />
    {capabilities.canManage && <>
      {!archived && <Button variant="outline" label={t('actions.edit')} onPress={() => { router.push({ pathname: '/professional/management/classes/[class-id]/edit', params: { 'class-id': detail.id } }) }} />}
      <Button variant={archived ? 'outline' : 'dangerOutline'} label={t(archived ? 'actions.reopen' : 'actions.archive')} onPress={() => { setConfirmation({ kind: archived ? 'unarchive' : 'archive' }) }} />
    </>}
    {feedback !== undefined && <Text accessibilityLiveRegion="polite">{feedback}</Text>}
    {failed && <Text accessibilityRole="alert" tone="danger">{t(actions.failure === 'conflict' ? 'errors.conflict' : 'errors.action')}</Text>}

    <ListDivider />
    <ListSection title={t('students.title')} footer={t('students.info')}>
      {activeStudents.length === 0 && <Text tone="muted">{t('students.empty')}</Text>}
      {activeStudents.map(item => <View key={item.studentId} style={styles.row}>
        <ListRow title={item.name} description={t('students.enrolledAt', { date: formatDay(item.enrolledAt) })} />
        {capabilities.canManage && !archived && <Button variant="dangerOutline" size="inlineBody" label={t('actions.remove')} accessibilityLabel={t('actions.removeStudent', { name: item.name })} isDisabled={actions.pending} onPress={() => { setConfirmation({ kind: 'remove-student', studentId: item.studentId, name: item.name }) }} />}
      </View>)}
      {capabilities.canManage && !archived && <>
        {candidates.students.status === 'unavailable' && <Text tone="muted">{t('students.noPermission')}</Text>}
        {candidates.students.status === 'loading' && <Text tone="muted">{t('loadingCandidates')}</Text>}
        {candidates.students.status === 'failed' && <Text accessibilityRole="alert" tone="danger">{t('errors.candidates')}</Text>}
        {candidates.students.status === 'ready' && <Button label={t('students.add')} isDisabled={actions.pending} onPress={() => { setPicker('student') }} />}
      </>}
    </ListSection>
    {pastStudents.length > 0 && <ListSection title={t('students.history', { count: pastStudents.length })}>
      {pastStudents.map((item, index) => <ListRow key={`${item.studentId}:${item.enrolledAt}:${String(index)}`} title={item.name} description={t('historyPeriod', { from: formatDay(item.enrolledAt), to: formatDay(item.leftAt ?? item.enrolledAt) })} />)}
    </ListSection>}

    <ListDivider />
    <ListSection title={t('staff.title')} footer={t('staff.info')}>
      {activeStaff.length === 0 && <Text tone="muted">{t('staff.empty')}</Text>}
      {activeStaff.map(item => <View key={item.membershipId} style={styles.row}>
        <ListRow title={item.name} description={t('staff.linkedAt', { date: formatDay(item.linkedAt), role: t(`staff.environments.${item.environment}`) })} />
        {capabilities.canManage && !archived && <Button variant="dangerOutline" size="inlineBody" label={t('actions.remove')} accessibilityLabel={t('actions.removeStaff', { name: item.name })} isDisabled={actions.pending} onPress={() => { setConfirmation({ kind: 'remove-staff', membershipId: item.membershipId, name: item.name }) }} />}
      </View>)}
      {capabilities.canManage && !archived && <>
        {candidates.staff.status === 'unavailable' && <Text tone="muted">{t('staff.noPermission')}</Text>}
        {candidates.staff.status === 'loading' && <Text tone="muted">{t('loadingCandidates')}</Text>}
        {candidates.staff.status === 'failed' && <Text accessibilityRole="alert" tone="danger">{t('errors.candidates')}</Text>}
        {candidates.staff.status === 'ready' && <Button label={t('staff.add')} isDisabled={actions.pending} onPress={() => { setPicker('staff') }} />}
      </>}
    </ListSection>
    {pastStaff.length > 0 && <ListSection title={t('staff.history', { count: pastStaff.length })}>
      {pastStaff.map((item, index) => <ListRow key={`${item.membershipId}:${item.linkedAt}:${String(index)}`} title={item.name} description={t('historyPeriod', { from: formatDay(item.linkedAt), to: formatDay(item.leftAt ?? item.linkedAt) })} />)}
    </ListSection>}

    {picker === 'student' && candidates.students.status === 'ready' && <ClassCandidatePicker
      title={t('students.choose')}
      items={candidates.students.items.filter(item => !activeStudents.some(active => active.studentId === item.id))}
      onClose={() => { setPicker(undefined) }}
      onSelect={item => { setPicker(undefined); setConfirmation({ kind: 'enroll', studentId: item.id, name: item.name }) }}
    />}
    {picker === 'staff' && candidates.staff.status === 'ready' && <ClassCandidatePicker
      title={t('staff.choose')}
      items={candidates.staff.items.filter(item => !activeStaff.some(active => active.membershipId === item.id)).map(item => ({ ...item, description: t(`staff.environments.${item.environment}`) }))}
      onClose={() => { setPicker(undefined) }}
      onSelect={item => { setPicker(undefined); void run(() => actions.assignStaff(detail.id, item.id), t('messages.staffLinked')) }}
    />}
    {confirmation !== undefined && <ConfirmationSheet
      title={t('confirm.title')}
      message={confirmationText}
      confirmLabel={confirmationLabel}
      cancelLabel={t('cancel')}
      confirmVariant={confirmation.kind === 'archive' || confirmation.kind === 'remove-student' || confirmation.kind === 'remove-staff' ? 'danger' : 'primary'}
      isBusy={actions.pending}
      onConfirm={() => { void confirm() }}
      onCancel={() => { setConfirmation(undefined) }}
    />}
  </View>
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.lg },
  row: { gap: SPACING.xs, paddingBottom: SPACING.sm },
})
