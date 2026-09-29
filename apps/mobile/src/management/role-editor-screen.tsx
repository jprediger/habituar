import { SPACING } from '@habituar/design-tokens/spacing'
import type { RoleEditorTarget } from '@habituar/react-client/staff-management'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { getFieldErrorText } from '../authentication/form-messages'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { CheckboxRow } from '../components/ui/checkbox-row'
import { ChoiceList } from '../components/ui/choice-list'
import { FormField } from '../components/ui/form-field'
import { Input } from '../components/ui/input'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { useThemeTokens } from '../theme/tokens'
import { toStaffContext } from './staff-context'
import { ConfirmationPanel, FailureNotice, ResultAnnouncement, getRoleName } from './staff-feedback'

/**
 * Editor de papel no app: clone a partir de um modelo do sistema ou edição de papel
 * personalizado, com o impacto apresentado antes de gravar. Mesmo hook da web.
 */
export function RoleEditorScreen({ session, target, onDone }: Readonly<{ session: InstitutionSession; target: RoleEditorTarget; onDone: () => void }>) {
  const { t } = useTranslation()
  const { colors, radius } = useThemeTokens()
  const editor = habituar.useRoleEditor(toStaffContext(session), target)
  const { state, operation } = editor
  const isBusy = operation.status === 'saving' || operation.status === 'deleting'
  const loadedRole = state.status === 'ready' ? state.role : undefined
  const roleName = loadedRole === undefined ? '' : getRoleName(loadedRole, t)
  const title = target.mode === 'create' ? t('staff.roles.createTitle') : t('staff.roles.editTitle', { name: roleName })

  if (operation.status === 'deleted') {
    return (
      <Page>
        <PageHeader eyebrow={t('staff.sections.roles')} title={title} />
        <ResultAnnouncement><Text>{t('staff.roles.deleted')}</Text></ResultAnnouncement>
        <Button label={t('staff.close')} onPress={onDone} />
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader eyebrow={t('staff.sections.roles')} title={title} />
      <Text tone="muted">{target.mode === 'create' ? t('staff.roles.createDescription') : t('staff.roles.editDescription')}</Text>
      {state.status === 'loading' && <Text accessibilityLiveRegion="polite" tone="muted">{t('staff.loading')}</Text>}
      {state.status === 'failed' && <FailureNotice failure={state.failure} onRetry={editor.reload} actionLabel={t('staff.reload')} />}

      {state.status === 'ready' && (
        <View style={styles.stack}>
          {state.readOnlyReason !== undefined && <Text>{t(`staff.roles.readOnly.${state.readOnlyReason}`)}</Text>}

          {state.mode === 'create' && (
            <ChoiceList
              label={t('staff.roles.template')}
              choices={state.templates.map((template) => ({ value: template.id, label: getRoleName(template, t), description: t(`staff.environments.${template.environment}`) }))}
              value={state.templateRoleId}
              onChange={editor.chooseTemplate}
            />
          )}

          <FormField
            id="role-name"
            label={t('staff.roles.name')}
            isRequired
            error={editor.nameError === undefined ? undefined : getFieldErrorText(editor.nameError, t)}
          >
            {(control) => (
              <Input
                {...control}
                hasError={control.hasError}
                editable={state.readOnlyReason === undefined && !isBusy}
                maxLength={80}
                value={editor.name}
                onChangeText={editor.setName}
                onBlur={editor.leaveName}
              />
            )}
          </FormField>

          <Text accessibilityRole="header" weight="medium">{t('staff.roles.bundles')}</Text>
          <Text size="caption" tone="muted">{t('staff.roles.bundlesHint')}</Text>
          {state.bundleOptions.map((option) => {
            const label = t(option.labelKey)
            return (
              <View key={option.key} style={styles.bundle}>
                <CheckboxRow
                  label={label}
                  isChecked={option.isSelected}
                  isDisabled={state.readOnlyReason !== undefined || isBusy}
                  onChange={(isChecked) => { editor.setBundleSelected(option.key, isChecked) }}
                />
                {/* Alcance só vira escolha quando existe mais de uma opção válida. */}
                {option.isSelected && option.hasScopeChoice && (
                  <ChoiceList
                    label={t('staff.roles.scope', { bundle: label })}
                    choices={option.scopes.map((scopeOption) => ({ value: scopeOption.scope, label: t(`staff.scopes.${scopeOption.scope}`) }))}
                    value={option.scopes.find((scopeOption) => scopeOption.isSelected)?.scope}
                    onChange={(scope) => { editor.chooseScope(option.key, scope) }}
                  />
                )}
              </View>
            )
          })}
          {editor.bundlesError !== undefined && (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" size="caption" tone="danger">{t('staff.roles.chooseBundle')}</Text>
          )}

          {operation.status === 'failed' && (
            <FailureNotice failure={operation.failure} onRetry={operation.failure === 'configuration-conflict' ? editor.reload : undefined} actionLabel={t('staff.reload')} />
          )}
          {operation.status === 'saved' && (
            <ResultAnnouncement>
              <Text>{operation.revokedInvitationCount > 0 ? t('staff.roles.savedWithRevocations', { count: operation.revokedInvitationCount }) : t('staff.roles.saved')}</Text>
            </ResultAnnouncement>
          )}

          {operation.status === 'confirming-impact' && (
            <View style={[styles.impact, { borderColor: colors.danger, borderRadius: radius.field }]}>
              <Text accessibilityRole="header" weight="medium">{t('staff.roles.impactTitle')}</Text>
              <Text accessibilityLiveRegion="polite">{t('staff.roles.impactMembers', { count: operation.impact.activeMemberCount })}</Text>
              {operation.impact.revokesInvitations && <Text>{t('staff.roles.impactInvitations', { count: operation.impact.pendingInvitationCount })}</Text>}
              <Button label={t('staff.roles.confirmSave')} onPress={() => { void editor.confirmSave() }} />
              <Button variant="outline" label={t('staff.cancel')} onPress={editor.cancel} />
            </View>
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
            <View style={styles.stack}>
              <Button
                label={operation.status === 'saving' ? t('staff.roles.saving') : t('staff.roles.save')}
                isDisabled={isBusy}
                isBusy={operation.status === 'saving'}
                onPress={() => { void editor.save() }}
              />
              {state.canDelete && <Button variant="outline" label={t('staff.roles.delete')} isDisabled={isBusy} onPress={editor.requestDeletion} />}
            </View>
          )}
        </View>
      )}
    </Page>
  )
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.md },
  bundle: { gap: SPACING.xs },
  impact: { gap: SPACING.sm, borderWidth: 1, padding: SPACING.lg },
})
