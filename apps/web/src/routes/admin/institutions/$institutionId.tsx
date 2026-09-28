/* eslint-disable habituar/filename-kebab-case -- O TanStack Router exige o nome do parâmetro de rota no arquivo. */
import { institutionIdSchema } from '@habituar/core/identity/ids'
import { createFileRoute } from '@tanstack/react-router'
import { InstitutionDetailScreen } from '../../../platform/platform-screens.js'

export const Route = createFileRoute('/admin/institutions/$institutionId')({
  // Parâmetro de URL é entrada externa: vira id tipado aqui, e id inválido não chega à tela.
  params: {
    parse: ({ institutionId }) => ({ institutionId: institutionIdSchema.parse(institutionId) }),
    stringify: ({ institutionId }) => ({ institutionId }),
  },
  component: InstitutionDetailRoute,
})

function InstitutionDetailRoute() {
  const { institutionId } = Route.useParams()
  return <InstitutionDetailScreen institutionId={institutionId} />
}
