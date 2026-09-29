import type { RoleId } from '@habituar/core/identity/ids'
import type { RoleEditorTarget, RoleSummary, StaffManagementContext } from '@habituar/react-client/staff-management'
import { ROLE_BUNDLE_LABEL_KEYS } from '@habituar/react-client/staff-management'
import { Shapes } from 'lucide-react'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import { EmptyState } from '../components/ui/empty-state.js'
import { Section } from '../components/ui/section.js'
import { RoleEditorDialog } from './role-editor-dialog.js'
import { FailureNotice, getRoleName } from './staff-feedback.js'

/**
 * Seção Papéis: modelos do sistema e papéis personalizados, com resumo do que cada um
 * permite e de quantas pessoas o usam. Criação e edição abrem o editor em diálogo.
 */
export function RolesPanel({ context }: Readonly<{ context: StaffManagementContext }>): ReactElement {
  const { t } = useTranslation()
  const roles = habituar.useRoles(context)
  // O diálogo fecha sem desmontar: é no fechamento que o Radix devolve o foco a quem o abriu.
  const [editor, setEditor] = useState<Readonly<{ target: RoleEditorTarget; isOpen: boolean }> | undefined>(undefined)
  const openRole = (roleId: RoleId): void => { setEditor({ target: { mode: 'edit', roleId }, isOpen: true }) }

  return (
    <div className="flex flex-col gap-xxl">
      {roles.state.status === 'loading' && <p role="status">{t('staff.loading')}</p>}
      {roles.state.status === 'failed' && <FailureNotice failure={roles.state.failure} onRetry={roles.retry} actionLabel={t('staff.retry')} />}

      {roles.state.status === 'ready' && (
        <>
          <Section title={t('staff.roles.customTitle')}>
            {roles.capabilities.canManageRoles && (
              <div><Button type="button" onClick={() => { setEditor({ target: { mode: 'create' }, isOpen: true }) }}>{t('staff.roles.new')}</Button></div>
            )}
            {roles.state.custom.length === 0
              ? <EmptyState icon={Shapes} title={t('staff.roles.customEmptyTitle')} description={t('staff.roles.customEmptyDescription')} />
              : <RoleList summaries={roles.state.custom} onOpen={openRole} />}
          </Section>
          <Section title={t('staff.roles.templatesTitle')} description={t('staff.roles.templatesDescription')}>
            <RoleList summaries={roles.state.templates} onOpen={openRole} />
          </Section>
        </>
      )}

      {editor !== undefined && (
        <RoleEditorDialog context={context} target={editor.target} isOpen={editor.isOpen} onClose={() => { setEditor({ ...editor, isOpen: false }) }} />
      )}
    </div>
  )
}

function RoleList({ summaries, onOpen }: Readonly<{ summaries: readonly RoleSummary[]; onOpen: (roleId: RoleId) => void }>): ReactElement {
  const { t } = useTranslation()
  return (
    <ul className="flex flex-col gap-sm">
      {summaries.map(({ role }) => {
        const name = getRoleName(role, t)
        return (
          <li key={role.id} className="flex flex-col gap-xs rounded-field border border-hairline px-lg py-md">
            <div className="flex flex-wrap items-baseline justify-between gap-sm">
              <span className="font-medium">{name}</span>
              <span className="text-caption font-medium uppercase tracking-widest text-text-muted">{t(`staff.environments.${role.environment}`)}</span>
            </div>
            <p className="text-caption text-text-muted">
              {role.bundles === null
                ? t('staff.roles.notRepresentable')
                : role.bundles.map((selection) => `${t(ROLE_BUNDLE_LABEL_KEYS[selection.bundle])} (${t(`staff.scopes.${selection.scope}`)})`).join(' · ')}
            </p>
            <p className="text-caption text-text-muted">
              {t('staff.roles.activeMembers', { count: role.activeMemberCount })}
              {' · '}
              {t('staff.roles.pendingInvitations', { count: role.pendingInvitationCount })}
            </p>
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => { onOpen(role.id) }}>{t('staff.roles.open', { name })}</Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
