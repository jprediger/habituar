import type { PropsWithChildren, ReactElement } from 'react'
import { createContext, useContext } from 'react'
import type { InstitutionSession } from './session-route.js'

const ProfessionalSessionContext = createContext<InstitutionSession | undefined>(undefined)

/**
 * Entrega às telas filhas do ambiente profissional a sessão que o layout já aprovou. Não
 * guarda cópia nem consulta estado: é a mesma sessão do cliente, passada adiante porque o
 * `<Outlet />` do roteador não repassa props.
 */
export function ProfessionalSessionProvider({
  session,
  children,
}: PropsWithChildren<Readonly<{ session: InstitutionSession }>>): ReactElement {
  return <ProfessionalSessionContext.Provider value={session}>{children}</ProfessionalSessionContext.Provider>
}

/** Sessão aprovada do ambiente profissional; fora do layout é erro de montagem, não estado. */
export function useProfessionalSession(): InstitutionSession {
  const session = useContext(ProfessionalSessionContext)

  if (session === undefined) {
    throw new Error('useProfessionalSession() must be used inside the professional layout route.')
  }

  return session
}
