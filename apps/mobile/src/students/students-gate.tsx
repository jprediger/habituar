import { Redirect } from 'expo-router'
import type { ReactNode } from 'react'
import type { InstitutionSession } from '../session/session-screen'

/** Protege toda a pilha de estudantes, inclusive links diretos, pelas concessões atuais. */
export function StudentsGate({ session, children }: Readonly<{ session: InstitutionSession; children: ReactNode }>) {
  const canRead = session.membership.permissions.some((permission) => permission.key === 'student.read')
  return canRead ? children : <Redirect href="/professional" />
}
