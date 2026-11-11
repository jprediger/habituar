/* eslint-disable habituar/filename-kebab-case -- O TanStack Router exige o nome do parâmetro de rota no arquivo. */
import { studentIdSchema } from '@habituar/core/identity/ids'
import { parseStudentRecordSearch } from '@habituar/react-client/student-record-navigation'
import { createFileRoute } from '@tanstack/react-router'
import { StudentTasksScreen } from '../../../professional/student-tasks-screen.js'

// O `_` tira a rota de dentro da ficha: a ficha não tem `Outlet`, e o acompanhamento é página própria.
export const Route = createFileRoute('/professional/students/$studentId_/tasks')({
  validateSearch: parseStudentRecordSearch,
  params: {
    parse: ({ studentId }) => ({ studentId: studentIdSchema.parse(studentId) }),
    stringify: ({ studentId }) => ({ studentId }),
  },
  component: StudentTasksRoute,
})

function StudentTasksRoute() {
  const { studentId } = Route.useParams()
  return <StudentTasksScreen studentId={studentId} />
}
