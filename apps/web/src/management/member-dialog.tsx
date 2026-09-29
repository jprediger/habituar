import type { MembershipId } from '@habituar/core/identity/ids'
import type { StaffManagementContext } from '@habituar/react-client/staff-management'
import { useId } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import { Dialog, DialogClose } from '../components/ui/dialog.js'
import { ConfirmationPanel, FailureNotice, ResultAnnouncement, getRoleName } from './staff-feedback.js'

/**
 * Um membro da equipe em diálogo: troca atômica do conjunto de papéis e remoção do
 * vínculo com confirmação que nomeia pessoa e instituição. O que é permitido vem pronto
 * do hook; o diálogo só decide o visual e devolve o foco a quem o abriu.
 */
export function MemberDialog({
  context,
  institutionName,
  membershipId,
  isOpen,
  onClose,
}: Readonly<{ context: StaffManagementContext; institutionName: string; membershipId: MembershipId; isOpen: boolean; onClose: () => void }>): ReactElement {
  const { t } = useTranslation()
  const editor = habituar.useTeamMember(context, membershipId)
  const { state, operation } = editor
  const legendId = useId()
  const hintId = useId()
  const roleErrorId = useId()
  const name = state.status === 'ready' ? state.member.user.name : t('staff.sections.team')
  const isBusy = operation.status === 'saving' || operation.status === 'removing'

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={name} description={t('staff.member.description', { institution: institutionName })}>
      {state.status === 'loading' && <p role="status">{t('staff.loading')}</p>}
      {state.status === 'failed' && operation.status !== 'removed' && <FailureNotice failure={state.failure} onRetry={editor.reload} actionLabel={t('staff.reload')} />}

      {operation.status === 'removed' && state.status !== 'loading' && (
        <ResultAnnouncement>{t('staff.member.removed', { institution: institutionName })}</ResultAnnouncement>
      )}

      {state.status === 'ready' && operation.status !== 'removed' && (
        <form
          className="flex flex-col gap-lg"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void editor.save()
          }}
        >
          <p className="break-all text-body text-text-muted">{state.member.user.email}{' · '}{t(`staff.environments.${state.member.environment}`)}</p>
          <fieldset
            className="flex flex-col gap-sm"
            aria-describedby={[hintId, editor.roleError === undefined ? '' : roleErrorId].join(' ').trim()}
            disabled={!state.canEditRoles || isBusy}
          >
            <legend id={legendId} className="text-body font-medium">{t('staff.member.rolesLegend')}</legend>
            <p id={hintId} className="text-caption text-text-muted">{state.canEditRoles ? t('staff.member.rolesHint') : t('staff.member.readOnly')}</p>
            {state.roleOptions.map((option) => (
              <label key={option.role.id} className="flex min-h-tap-target items-center gap-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={option.isSelected}
                  disabled={!option.isDelegable}
                  onChange={(event) => { editor.setRoleSelected(option.role.id, event.target.checked) }}
                />
                <span className="flex flex-col">
                  <span>{getRoleName(option.role, t)}</span>
                  {!option.isDelegable && <span className="text-caption text-text-muted">{t('staff.member.notDelegable')}</span>}
                </span>
              </label>
            ))}
            {editor.roleError !== undefined && <p id={roleErrorId} role="alert" className="text-caption text-danger">{t('staff.member.chooseRole')}</p>}
          </fieldset>

          {operation.status === 'failed' && (
            <FailureNotice
              failure={operation.failure}
              onRetry={operation.failure === 'configuration-conflict' ? editor.reload : undefined}
              actionLabel={t('staff.reload')}
            />
          )}
          {operation.status === 'saved' && <ResultAnnouncement>{t('staff.member.saved')}</ResultAnnouncement>}

          {operation.status === 'confirming-removal' || operation.status === 'removing' ? (
            <ConfirmationPanel
              message={state.isSelf
                ? t('staff.member.removeSelfConfirmation', { institution: institutionName })
                : t('staff.member.removeConfirmation', { name, institution: institutionName })}
              confirmLabel={operation.status === 'removing' ? t('staff.member.removing') : t('staff.member.confirmRemove')}
              cancelLabel={t('staff.member.keep')}
              isBusy={operation.status === 'removing'}
              onConfirm={() => { void editor.confirmRemoval() }}
              onCancel={editor.cancel}
            />
          ) : (
            <div className="flex flex-wrap justify-between gap-sm">
              {state.canEditRoles && (
                <Button type="submit" disabled={isBusy || !state.isDirty}>{operation.status === 'saving' ? t('staff.member.saving') : t('staff.member.save')}</Button>
              )}
              {state.canRemove && (
                <Button type="button" variant="outline" disabled={isBusy} onClick={editor.requestRemoval}>{t('staff.member.remove')}</Button>
              )}
            </div>
          )}
        </form>
      )}

      <div className="flex justify-end">
        <DialogClose asChild>
          <Button type="button" variant="ghost">{t('staff.close')}</Button>
        </DialogClose>
      </div>
    </Dialog>
  )
}
