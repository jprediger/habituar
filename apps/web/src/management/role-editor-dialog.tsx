import type { RoleEditorTarget, StaffManagementContext } from '@habituar/react-client/staff-management'
import { useId } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { getFieldErrorText } from '../authentication/form-messages.js'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import { Dialog, DialogClose } from '../components/ui/dialog.js'
import { FormField } from '../components/ui/form-field.js'
import { Input } from '../components/ui/input.js'
import { ConfirmationPanel, FailureNotice, ResultAnnouncement, getRoleName } from './staff-feedback.js'

const SELECT_CLASS = 'min-h-tap-target rounded-field border border-border bg-surface px-sm text-body text-text'

/**
 * Editor de papel em diálogo: clone a partir de um modelo do sistema, ou edição de um
 * papel personalizado com o impacto apresentado antes de gravar. Bundles e alcances
 * chegam já recortados ao que o ator pode conceder.
 */
export function RoleEditorDialog({
  context,
  target,
  isOpen,
  onClose,
}: Readonly<{ context: StaffManagementContext; target: RoleEditorTarget; isOpen: boolean; onClose: () => void }>): ReactElement {
  const { t } = useTranslation()
  const editor = habituar.useRoleEditor(context, target)
  const { state, operation } = editor
  const nameId = useId()
  const templateId = useId()
  const bundlesHintId = useId()
  const bundlesErrorId = useId()
  const isBusy = operation.status === 'saving' || operation.status === 'deleting'
  const loadedRole = state.status === 'ready' ? state.role : undefined
  const roleName = loadedRole === undefined ? '' : getRoleName(loadedRole, t)
  const title = target.mode === 'create' ? t('staff.roles.createTitle') : t('staff.roles.editTitle', { name: roleName })
  const description = target.mode === 'create' ? t('staff.roles.createDescription') : t('staff.roles.editDescription')
  const isDone = operation.status === 'deleted'

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title} description={description}>
      {state.status === 'loading' && <p role="status">{t('staff.loading')}</p>}
      {state.status === 'failed' && !isDone && <FailureNotice failure={state.failure} onRetry={editor.reload} actionLabel={t('staff.reload')} />}
      {isDone && <ResultAnnouncement>{t('staff.roles.deleted')}</ResultAnnouncement>}

      {state.status === 'ready' && !isDone && (
        <form
          className="flex flex-col gap-lg"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void editor.save()
          }}
        >
          {state.readOnlyReason !== undefined && (
            <p role="note" className="rounded-field border border-hairline px-lg py-md text-body">{t(`staff.roles.readOnly.${state.readOnlyReason}`)}</p>
          )}

          <fieldset className="flex flex-col gap-lg" disabled={state.readOnlyReason !== undefined || isBusy}>
            {state.mode === 'create' && (
              <div className="flex flex-col gap-xs">
                <label htmlFor={templateId} className="text-body font-medium">
                  {t('staff.roles.template')}
                  <span className="text-danger" title={t('form.requiredMark')} aria-hidden="true">{' *'}</span>
                </label>
                <select id={templateId} required className={SELECT_CLASS} value={state.templateRoleId ?? ''} onChange={(event) => { editor.chooseTemplate(event.target.value) }}>
                  {state.templates.map((template) => (
                    <option key={template.id} value={template.id}>{`${getRoleName(template, t)} · ${t(`staff.environments.${template.environment}`)}`}</option>
                  ))}
                </select>
              </div>
            )}

            <FormField
              id={nameId}
              label={t('staff.roles.name')}
              isRequired
              requiredMarkLabel={t('form.requiredMark')}
              error={editor.nameError === undefined ? undefined : getFieldErrorText(editor.nameError, t)}
            >
              {(control) => (
                <Input {...control} maxLength={80} value={editor.name} onChange={(event) => { editor.setName(event.target.value) }} onBlur={editor.leaveName} />
              )}
            </FormField>

            <fieldset className="flex flex-col gap-sm" aria-describedby={[bundlesHintId, editor.bundlesError === undefined ? '' : bundlesErrorId].join(' ').trim()}>
              <legend className="text-body font-medium">
                {t('staff.roles.bundles')}
                <span className="text-danger" title={t('form.requiredMark')} aria-hidden="true">{' *'}</span>
              </legend>
              <p id={bundlesHintId} className="text-caption text-text-muted">{t('staff.roles.bundlesHint')}</p>
              {state.bundleOptions.map((option) => {
                const label = t(option.labelKey)
                return (
                  <div key={option.key} className="flex flex-col gap-xs">
                    <label className="flex min-h-tap-target items-center gap-sm">
                      <input type="checkbox" className="size-5" checked={option.isSelected} onChange={(event) => { editor.setBundleSelected(option.key, event.target.checked) }} />
                      <span>{label}</span>
                    </label>
                    {/* Alcance só vira escolha quando existe mais de uma opção válida. */}
                    {option.isSelected && option.hasScopeChoice && (
                      <fieldset className="ml-xl flex flex-wrap gap-md">
                        <legend className="sr-only">{t('staff.roles.scope', { bundle: label })}</legend>
                        {option.scopes.map((scopeOption) => (
                          <label key={scopeOption.scope} className="flex min-h-tap-target items-center gap-xs">
                            <input type="radio" name={`${nameId}-${option.key}`} checked={scopeOption.isSelected} onChange={() => { editor.chooseScope(option.key, scopeOption.scope) }} />
                            <span className="text-caption">{t(`staff.scopes.${scopeOption.scope}`)}</span>
                          </label>
                        ))}
                      </fieldset>
                    )}
                  </div>
                )
              })}
              {editor.bundlesError !== undefined && <p id={bundlesErrorId} role="alert" className="text-caption text-danger">{t('staff.roles.chooseBundle')}</p>}
            </fieldset>
          </fieldset>

          {operation.status === 'failed' && (
            <FailureNotice failure={operation.failure} onRetry={operation.failure === 'configuration-conflict' ? editor.reload : undefined} actionLabel={t('staff.reload')} />
          )}
          {operation.status === 'saved' && (
            <ResultAnnouncement>
              {operation.revokedInvitationCount > 0
                ? t('staff.roles.savedWithRevocations', { count: operation.revokedInvitationCount })
                : t('staff.roles.saved')}
            </ResultAnnouncement>
          )}

          {operation.status === 'confirming-impact' && (
            <div role="group" aria-label={t('staff.roles.impactTitle')} className="flex flex-col gap-sm rounded-field border border-danger px-lg py-md">
              <p className="font-medium">{t('staff.roles.impactTitle')}</p>
              <p>{t('staff.roles.impactMembers', { count: operation.impact.activeMemberCount })}</p>
              {operation.impact.revokesInvitations && <p>{t('staff.roles.impactInvitations', { count: operation.impact.pendingInvitationCount })}</p>}
              <div className="flex flex-wrap gap-sm">
                <Button type="button" autoFocus onClick={() => { void editor.confirmSave() }}>{t('staff.roles.confirmSave')}</Button>
                <Button type="button" variant="outline" onClick={editor.cancel}>{t('staff.cancel')}</Button>
              </div>
            </div>
          )}

          {(operation.status === 'confirming-deletion' || operation.status === 'deleting') && (
            <ConfirmationPanel
              message={t('staff.roles.deleteConfirmation', { name: roleName })}
              confirmLabel={operation.status === 'deleting' ? t('staff.roles.deleting') : t('staff.roles.confirmDelete')}
              cancelLabel={t('staff.cancel')}
              isBusy={operation.status === 'deleting'}
              onConfirm={() => { void editor.confirmDeletion() }}
              onCancel={editor.cancel}
            />
          )}

          {state.readOnlyReason === undefined && operation.status !== 'confirming-impact' && operation.status !== 'confirming-deletion' && operation.status !== 'deleting' && (
            <div className="flex flex-wrap justify-between gap-sm">
              <Button type="submit" disabled={isBusy}>{operation.status === 'saving' ? t('staff.roles.saving') : t('staff.roles.save')}</Button>
              {state.canDelete && <Button type="button" variant="outline" disabled={isBusy} onClick={editor.requestDeletion}>{t('staff.roles.delete')}</Button>}
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
