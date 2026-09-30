import { Outlet, createFileRoute, Navigate } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { useInstitutionSession } from '../../session/institution-session.js'

export const Route = createFileRoute('/professional/students')({ component: StudentsLayoutRoute })

/** Fronteira web da área de estudantes para acessos por URL direta. */
function StudentsLayoutRoute(): ReactElement {
  const session = useInstitutionSession()
  if (!session.membership.permissions.some((permission) => permission.key === 'student.read')) {
    return <Navigate to="/professional" replace />
  }
  return <Outlet />
}
