import { habituar } from '../habituar-client'
import { InstitutionSelectionScreen } from '../institution-selection-screen'

/** Passo entre autenticar e chegar a um ambiente, quando a conta tem mais de um vínculo. */
export default function SelectInstitutionRoute() {
  const { state } = habituar.useAuthentication()

  // O guard do layout já garante que só `selecting-membership` chega aqui; a checagem
  // existe para estreitar o tipo, não para decidir acesso.
  if (state.status !== 'selecting-membership') return null

  return <InstitutionSelectionScreen memberships={state.memberships} />
}
