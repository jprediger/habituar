import type { StudentId } from '@habituar/core/identity/ids'
import { resolveStudentRecordNavigation } from '@habituar/react-client/student-record-navigation'
import type { StudentRecordOrigin, StudentRecordSection } from '@habituar/react-client/student-record-navigation'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import type { IconName } from '../components/ui/icon'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { StackPageSkeleton } from '../components/skeletons/page-skeleton'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { formatRecordDate } from './student-record-format'

const SECTIONS = {
  registration: { icon: 'identification-card', title: 'students.record.registration.title', description: 'students.record.sections.registration', path: '/professional/students/[student-id]/registration' },
  profile: { icon: 'heartbeat', title: 'students.profile.title', description: 'students.record.sections.profile', path: '/professional/students/[student-id]/profile' },
  agenda: { icon: 'calendar-blank', title: 'students.record.agendaTitle', description: 'students.record.sections.agenda', path: '/professional/students/[student-id]/agenda' },
  consultations: { icon: 'clipboard-text', title: 'students.consultations.title', description: 'students.record.sections.consultations', path: '/professional/students/[student-id]/consultations' },
  history: { icon: 'clock-counter-clockwise', title: 'students.history.title', description: 'students.record.sections.history', path: '/professional/students/[student-id]/history' },
  management: { icon: 'gear', title: 'students.record.management.title', description: 'students.record.sections.management', path: '/professional/students/[student-id]/management' },
} as const satisfies Record<StudentRecordSection, Readonly<{ icon: IconName; title: string; description: string; path: string }>>

const BACK_TARGETS = {
  home: '/professional',
  management: '/professional/management/students',
} as const satisfies Record<StudentRecordOrigin, string>

/** Entrada única do estudante: cadastro acessível sem exigir leitura de dados de acompanhamento. */
export function StudentRecordScreen({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const { origin, sections } = resolveStudentRecordNavigation(session.membership.permissions, useLocalSearchParams())
  const detail = habituar.useStudentDetail(session.membership.institution.id, studentId)
  const student = detail.state.status === 'ready' ? detail.state.student : undefined
  return <StackPage title={student?.socialName ?? student?.fullName ?? t('students.record.eyebrow')} onBack={() => { router.dismissTo(BACK_TARGETS[origin]) }}>
    {detail.state.status === 'loading' && <StackPageSkeleton />}
    {detail.state.status === 'error' && <><Text accessibilityRole="alert" tone="danger">{t('students.loadFailed')}</Text><Button label={t('students.retry')} onPress={() => { void detail.refresh() }} /></>}
    {student !== undefined && <>
      <Text tone="muted">{t('students.record.overviewDescription')}</Text>
      {student.archivedAt !== null && <Text accessibilityRole="alert">{t('students.record.archived')}</Text>}
      <ListSection title={t('students.record.sectionsTitle')}>
        {sections.map((section) => {
          const item = SECTIONS[section]
          const open = () => { router.push({ pathname: item.path, params: { 'student-id': studentId } }) }
          return section === 'profile'
            ? <ProfileSectionRow key={section} session={session} studentId={studentId} onPress={open} />
            : <ListRow key={section} icon={item.icon} title={t(item.title)} description={t(item.description)} onPress={open} />
        })}
      </ListSection>
    </>}
  </StackPage>
}

// Componente próprio porque a visão geral exige `record.read`: só é montado quando a seção
// de perfil aparece, e quem só gerencia não dispara a busca nem recebe erro dela.
function ProfileSectionRow({ session, studentId, onPress }: Readonly<{ session: InstitutionSession; studentId: StudentId; onPress: () => void }>) {
  const { t } = useTranslation()
  const { record } = habituar.useStudentRecordOverview(session.membership, studentId)
  const description = record.status !== 'ready'
    ? t(SECTIONS.profile.description)
    : record.record.profile.status === 'filled'
      ? t('students.record.sections.profileUpdated', { date: formatRecordDate(record.record.profile.revision.recordedAt) })
      : t('students.record.sections.profileEmpty')
  return <ListRow icon={SECTIONS.profile.icon} title={t(SECTIONS.profile.title)} description={description} onPress={onPress} />
}
