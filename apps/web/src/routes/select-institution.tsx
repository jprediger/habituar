import { Navigate, createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { getWebAuthenticationGuard } from '../authentication-guard.js'
import { habituar } from '../habituar-client.js'
import { InstitutionSelectionScreen } from '../institution-selection-screen.js'

export const Route = createFileRoute('/select-institution')({ component: SelectInstitutionRoute })

/** Passo entre autenticar e chegar a um ambiente, quando a conta tem mais de um vínculo. */
export function SelectInstitutionRoute(): ReactElement | null {
  const { state } = habituar.useAuthentication()
  const guard = getWebAuthenticationGuard(state, '/select-institution')

  if (guard.action === 'redirect') return <Navigate to={guard.route} replace />
  if (state.status !== 'selecting-membership') return null

  return <InstitutionSelectionScreen memberships={state.memberships} />
}
