import { Navigate, createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { ClassesScreen } from '../../classes/classes-screen.js'
import { useInstitutionSession } from '../../session/institution-session.js'

export const Route = createFileRoute('/professional/classes')({ component: ProfessionalClassesRoute })

/** A URL direta é protegida; a API valida cada leitura e alteração por instituição. */
function ProfessionalClassesRoute(): ReactElement {
  const { membership } = useInstitutionSession()
  const allowed = membership.permissions.some(permission =>
    (permission.key === 'class.read' && permission.scope !== 'own') ||
    (permission.key === 'class.create' && permission.scope === 'institution'),
  )
  if (!allowed) return <Navigate to="/professional" replace />
  return <ClassesScreen key={membership.institution.id} />
}
