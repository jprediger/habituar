import type { MembershipContext } from '@habituar/react-client/react-client'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { CenteredPage } from './components/ui/centered-page.js'
import { Button } from './components/ui/button.js'
import { habituar } from './habituar-client.js'

/** Escolha do vínculo ativo quando a conta tem mais de um; não decide destino algum. */
export function InstitutionSelectionScreen({
  memberships,
}: Readonly<{ memberships: readonly MembershipContext[] }>): ReactElement {
  const { t } = useTranslation()
  const { actions } = habituar.useAuthentication()

  return (
    <CenteredPage title={t('authentication.selection.title')}>
      <p className="text-caption text-text-muted">{t('authentication.selection.description')}</p>
      <ul className="flex flex-col gap-sm">
        {memberships.map((membership) => (
          <li key={membership.institution.id}>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between"
              onClick={() => {
                void actions.selectMembership(membership.institution.id)
              }}
            >
              <span>{membership.institution.name}</span>
              <span className="text-caption text-text-muted">{membership.role.name}</span>
            </Button>
          </li>
        ))}
      </ul>
    </CenteredPage>
  )
}
