/* eslint-disable habituar/filename-kebab-case -- O TanStack Router exige o nome do parâmetro de rota no arquivo. */
import { studentIdSchema } from '@habituar/core/identity/ids'
import { createFileRoute } from '@tanstack/react-router'
import { StudentRecordScreen } from '../../../professional/student-record-screen.js'

export const Route = createFileRoute('/professional/students/$studentId')({
  // Parâmetro de URL é entrada externa: vira id tipado aqui, e id inválido não chega à tela.
  params: {
    parse: ({ studentId }) => ({ studentId: studentIdSchema.parse(studentId) }),
    stringify: ({ studentId }) => ({ studentId }),
  },
  component: StudentRecordRoute,
})

function StudentRecordRoute() {
  const { studentId } = Route.useParams()
  return <StudentRecordScreen studentId={studentId} />
}
