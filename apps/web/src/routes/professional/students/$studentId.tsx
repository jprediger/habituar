/* eslint-disable habituar/filename-kebab-case -- O TanStack Router exige o nome do parâmetro de rota no arquivo. */
import { studentIdSchema } from '@habituar/core/identity/ids'
import { parseStudentRecordSearch } from '@habituar/react-client/student-record-navigation'
import { createFileRoute } from '@tanstack/react-router'
import { StudentRecordOverviewScreen } from '../../../professional/student-record-overview-screen.js'

export const Route = createFileRoute('/professional/students/$studentId')({
  validateSearch: parseStudentRecordSearch,
  params: {
    parse: ({ studentId }) => ({ studentId: studentIdSchema.parse(studentId) }),
    stringify: ({ studentId }) => ({ studentId }),
  },
  component: StudentDetailRoute,
})

function StudentDetailRoute() {
  const { studentId } = Route.useParams()
  return <StudentRecordOverviewScreen key={studentId} studentId={studentId} />
}
