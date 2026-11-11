import { assertNever } from '@habituar/core/assert-never'
import type { StudentId } from '@habituar/core/identity/ids'
import type { StudentProfileState } from '@habituar/core/student-records'
import { useRouter } from 'expo-router'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import type { IconName } from '../components/ui/icon'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { formatRecordDate } from './student-record-format'
import { StudentRecordGate } from './student-record-gate'

type StudentRecordSection = 'registration' | 'profile' | 'agenda' | 'consultations' | 'history'

// Ordem da lista e destino de cada linha, num lugar só: seção nova entra aqui e o
// compilador cobra o título e a descrição em `labelSection`.
const SECTIONS = [
  { section: 'registration', icon: 'identification-card', pathname: '/professional/students/[student-id]/registration' },
  { section: 'profile', icon: 'heartbeat', pathname: '/professional/students/[student-id]/profile' },
  { section: 'agenda', icon: 'calendar-blank', pathname: '/professional/students/[student-id]/agenda' },
  { section: 'consultations', icon: 'clipboard-text', pathname: '/professional/students/[student-id]/consultations' },
  { section: 'history', icon: 'clock-counter-clockwise', pathname: '/professional/students/[student-id]/history' },
] as const satisfies readonly Readonly<{ section: StudentRecordSection; icon: IconName; pathname: string }>[]

/**
 * Entrada da ficha do estudante no ambiente profissional: aviso de arquivamento e a lista
 * das seções, cada uma numa tela própria da pilha. Não mostra dado sensível — só o que
 * ajuda a escolher a seção —, e não decide acesso: a API confere a permissão em cada tela.
 */
export function StudentRecordScreen({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation()
  const { t: tAgenda } = useTranslation('agenda')
  const router = useRouter()
  const overview = habituar.useStudentRecordOverview(session.membership, studentId)

  return (
    <StudentRecordGate title={t('students.record.eyebrow')} overview={overview}>
      {({ student, record }) => (
        <StackPage title={student.socialName ?? student.fullName}>
          <Text tone="muted">{t('students.record.description')}</Text>
          {student.archivedAt !== null && <Text accessibilityRole="alert">{t('students.record.archived')}</Text>}
          <ListSection title={t('students.record.sectionsTitle')}>
            {SECTIONS.map(({ section, icon, pathname }) => {
              const label = labelSection(section, record.profile, t, tAgenda)
              return (
                <ListRow
                  key={section}
                  icon={icon}
                  title={label.title}
                  description={label.description}
                  onPress={() => { router.push({ pathname, params: { 'student-id': studentId } }) }}
                />
              )
            })}
          </ListSection>
        </StackPage>
      )}
    </StudentRecordGate>
  )
}

// Só os dados de apoio dizem algo próprio na linha: consultas e histórico precisariam de
// uma busca a mais só para contar, e a entrada existe justamente para não buscar tudo. A
// agenda fala pelo próprio namespace.
function labelSection(section: StudentRecordSection, profile: StudentProfileState, t: TFunction, tAgenda: TFunction<'agenda'>): Readonly<{ title: string; description: string }> {
  switch (section) {
    case 'registration':
      return { title: t('students.record.registration.title'), description: t('students.record.sections.registration') }
    case 'profile':
      return {
        title: t('students.profile.title'),
        description: profile.status === 'filled'
          ? t('students.record.sections.profileUpdated', { date: formatRecordDate(profile.revision.recordedAt) })
          : t('students.record.sections.profileEmpty'),
      }
    case 'agenda':
      return { title: tAgenda('title'), description: tAgenda('calendar.recordDescription') }
    case 'consultations':
      return { title: t('students.consultations.title'), description: t('students.record.sections.consultations') }
    case 'history':
      return { title: t('students.history.title'), description: t('students.record.sections.history') }
    default:
      return assertNever(section)
  }
}
