import type { PropsWithChildren, ReactElement } from 'react'
import { createContext, useContext } from 'react'
import type { InstitutionSession } from './session-route.js'

const InstitutionSessionContext = createContext<InstitutionSession | undefined>(undefined)

/**
 * Entrega às telas filhas de um ambiente institucional a sessão que o layout já aprovou.
 * Não guarda cópia nem consulta estado: é a mesma sessão do cliente, passada adiante
 * porque o `<Outlet />` do roteador não repassa props.
 */
export function InstitutionSessionProvider({
  session,
  children,
}: PropsWithChildren<Readonly<{ session: InstitutionSession }>>): ReactElement {
  return <InstitutionSessionContext.Provider value={session}>{children}</InstitutionSessionContext.Provider>
}

/** Sessão aprovada do ambiente institucional; fora do layout é erro de montagem, não estado. */
export function useInstitutionSession(): InstitutionSession {
  const session = useContext(InstitutionSessionContext)

  if (session === undefined) {
    throw new Error('useInstitutionSession() must be used inside an institution environment layout route.')
  }

  return session
}
