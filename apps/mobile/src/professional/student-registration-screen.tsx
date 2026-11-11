import type { StudentId } from '@habituar/core/identity/ids'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import type { InstitutionSession } from '../session/session-screen'
import { formatCalendarDate } from './student-record-format'
import { StudentRecordGate } from './student-record-gate'

/**
 * Cadastro do estudante dentro da ficha, só para leitura: corrigir é de quem gerencia os
 * cadastros. Contato de responsável só chega a quem pode vinculá-lo, então lista sem
 * contato também cobre quem não tem esse acesso.
 */
export function StudentRegistrationScreen({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation()
  const overview = habituar.useStudentRecordOverview(session.membership, studentId)
  const title = t('students.record.registration.title')

  return (
    <StudentRecordGate title={title} overview={overview}>
      {({ student }) => (
        <StackPage title={title}>
          <ListSection footer={t('students.record.registration.description')}>
            <ListRow title={t('students.record.registration.birthDate')} value={formatCalendarDate(student.birthDate)} />
            {student.socialName !== null && <ListRow title={t('students.record.registration.socialName')} value={student.socialName} />}
          </ListSection>
          <ListSection title={t('students.record.registration.guardians')}>
            {student.guardians.length === 0
              ? <ListRow title={t('students.record.registration.noGuardians')} />
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
        </StackPage>
      )}
    </StudentRecordGate>
  )
}
