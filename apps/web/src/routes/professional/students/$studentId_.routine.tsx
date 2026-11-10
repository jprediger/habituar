/* eslint-disable habituar/filename-kebab-case -- O TanStack Router exige o nome do parâmetro de rota no arquivo. */
import { studentIdSchema } from '@habituar/core/identity/ids'
import { createFileRoute } from '@tanstack/react-router'
import { StudentRoutineScreen } from '../../../professional/student-routine-screen.js'

// O `_` tira a rota de dentro da ficha: a ficha não tem `Outlet`, e a rotina é página própria.
export const Route = createFileRoute('/professional/students/$studentId_/routine')({
  params: {
    parse: ({ studentId }) => ({ studentId: studentIdSchema.parse(studentId) }),
    stringify: ({ studentId }) => ({ studentId }),
  },
  component: StudentRoutineRoute,
})

function StudentRoutineRoute() {
  const { studentId } = Route.useParams()
  return <StudentRoutineScreen studentId={studentId} />
}
