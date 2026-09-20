import { createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { InstitutionSessionRoute } from '../session-route.js'
import { StudentHomeScreen } from '../student-home-screen.js'

export const Route = createFileRoute('/student')({ component: StudentRoute })

/** Ambiente do aluno; a sessão só chega aqui depois de aprovada pelo guard. */
export function StudentRoute(): ReactElement {
  return (
    <InstitutionSessionRoute route="/student">
      {(session) => <StudentHomeScreen session={session} />}
    </InstitutionSessionRoute>
  )
}
