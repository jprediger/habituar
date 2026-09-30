import { createFileRoute, Navigate } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { StudentFormScreen } from '../../../students/student-form-screen.js'
import { useInstitutionSession } from '../../../session/institution-session.js'

export const Route = createFileRoute('/professional/students/new')({ component: NewStudentRoute })

/** Cadastro protegido por capacidade antes da montagem do formulário. */
function NewStudentRoute(): ReactElement {
  const session = useInstitutionSession()
  if (!session.membership.permissions.some((permission) => permission.key === 'student.create')) {
    return <Navigate to="/professional/students" replace />
  }
  return <StudentFormScreen />
}
