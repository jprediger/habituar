/* eslint-disable habituar/filename-kebab-case -- O TanStack Router exige o nome do parâmetro de rota no arquivo. */
import { studentIdSchema } from '@habituar/core/identity/ids'
import { createFileRoute } from '@tanstack/react-router'
import { StudentDetailScreen } from '../../../students/student-detail-screen.js'
import { StudentRecordScreen } from '../../../professional/student-record-screen.js'
import { useInstitutionSession } from '../../../session/institution-session.js'

export const Route = createFileRoute('/professional/students/$studentId')({
  params: {
    parse: ({ studentId }) => ({ studentId: studentIdSchema.parse(studentId) }),
    stringify: ({ studentId }) => ({ studentId }),
  },
  component: StudentDetailRoute,
})

function StudentDetailRoute() {
  const { studentId } = Route.useParams()
  const session = useInstitutionSession()
  const canReadRecord = session.membership.permissions.some((permission) => permission.key === 'record.read')
  return <>
    <StudentDetailScreen studentId={studentId} />
    {canReadRecord && <StudentRecordScreen studentId={studentId} />}
  </>
}
