import { SPACING } from '@habituar/design-tokens/spacing'
import type { RoleEditor, RoleEditorTarget, RoleOperation } from '@habituar/react-client/staff-management'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { getFieldErrorText } from '../authentication/form-messages'
import { habituar } from '../client/habituar-client'
import { ListSectionSkeleton } from '../components/skeletons/list-section-skeleton'
import { Skeleton } from '../components/skeletons/skeleton'
import { FormFieldSkeleton } from '../components/skeletons/form-field-skeleton'
import { ConfirmationSheet } from '../components/ui/confirmation-sheet'
import { Button } from '../components/ui/button'
import { ChoiceList } from '../components/ui/choice-list'
import { FormField } from '../components/ui/form-field'
import { Input } from '../components/ui/input'
import { ListDivider } from '../components/ui/list-divider'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { SwitchRow } from '../components/ui/switch-row'
import { useToast } from '../components/ui/toast'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { useThemeTokens } from '../theme/tokens'
import { toStaffContext } from './staff-context'
import { FailureNotice, getRoleName } from './staff-feedback'
import { Icon } from '../components/ui/icon'

/**
 * Editor de papel no app: clone a partir de um modelo do sistema ou edição de papel
 * personalizado, com o impacto apresentado antes de gravar. Mesmo hook da web.
 */
export function RoleEditorScreen({ session, target, onDone }: Readonly<{ session: InstitutionSession; target: RoleEditorTarget; onDone: () => void }>) {
  const { t } = useTranslation()
  const { colors, radius, minimumTouchTarget } = useThemeTokens()
  const editor = habituar.useRoleEditor(toStaffContext(session), target)
  const { state, operation } = editor
  const isBusy = operation.status === 'saving' || operation.status === 'deleting'
  const loadedRole = state.status === 'ready' ? state.role : undefined
  const roleName = loadedRole === undefined ? '' : getRoleName(loadedRole, t)
  const title = target.mode === 'create' ? t('staff.roles.createTitle') : t('staff.roles.detailsTitle')
  // O nome gravado de um modelo do sistema é a chave técnica; o que a pessoa lê é a tradução.
  const nameValue = loadedRole?.templateKey === null || loadedRole === undefined ? editor.name : roleName
  // Estado de tela, não de formulário: o rascunho do nome continua no hook. Erro de nome
  // reabre o campo, senão a mensagem ficaria sem campo ao lado.
  const [isEditingName, setIsEditingName] = useState(false)
  const isNameInputShown = isEditingName || editor.nameError !== undefined

  const showToast = useToast()
  // O aviso reage ao que a ação devolveu, não ao estado: a exclusão fecha a tela antes de
  // qualquer nova renderização, e o aviso precisa sobreviver a isso.
  const finish = (outcome: RoleOperation | undefined) => {
    if (outcome?.status === 'saved') {
      const toastContent = outcome.revokedInvitationCount > 0
        ? { title: t('toast.role.updatedWithRevocations.title'), subtitle: t('toast.role.updatedWithRevocations.description', { count: outcome.revokedInvitationCount }) }
        : target.mode === 'create'
          ? { title: t('toast.role.created.title'), subtitle: t('toast.role.created.description') }
          : { title: t('toast.role.updated.title'), subtitle: t('toast.role.updated.description') }
      showToast({ type: 'success', ...toastContent })
      if (target.mode === 'create') onDone()
    }
    if (outcome?.status === 'deleted') {
      showToast({ type: 'success', title: t('toast.role.deleted.title'), subtitle: t('toast.role.deleted.description') })
      onDone()
    }
  }

  return (
    <StackPage title={title}>
      <View style={[styles.header, isNameInputShown && styles.headerWithInput]}>
        {state.status === 'ready' && target.mode === 'edit' && (
          isNameInputShown
            ? <RoleNameInput editor={editor} value={nameValue} isEditable={!isBusy} shouldFocus={isEditingName} />
            : (
              <View style={styles.nameRow}>
                <View style={styles.nameText}>
                  <Text accessibilityRole="header" size="title" weight="bold">{nameValue}</Text>
                </View>
                {state.readOnlyReason === undefined && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('staff.roles.editName')}
                    onPress={() => { setIsEditingName(true) }}
                    hitSlop={SPACING.sm}
                    style={({ pressed }) => [styles.pencil, { minWidth: minimumTouchTarget, minHeight: minimumTouchTarget, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Icon name="pencil-simple" size={22} color={colors.text} />
                  </Pressable>
                )}
              </View>
            )
        )}
        {state.status === 'ready' && <Text size="caption" tone="muted">{target.mode === 'create' ? t('staff.roles.createDescription') : t('staff.roles.editDescription')}</Text>}
        {state.status === 'ready' && state.readOnlyReason !== undefined && <Text size="caption" tone="muted">{t(`staff.roles.readOnly.${state.readOnlyReason}`)}</Text>}
      </View>
      {state.status === 'loading' && (
        <Skeleton>
          <FormFieldSkeleton />
          <ListSectionSkeleton hasTitle rows={5} />
        </Skeleton>
      )}
      {state.status === 'failed' && <FailureNotice failure={state.failure} onRetry={editor.reload} actionLabel={t('staff.reload')} />}

      {state.status === 'ready' && (
        <>

          {state.mode === 'create' && (
            <>
              <ChoiceList
                label={t('staff.roles.template')}
                choices={state.templates.map((template) => ({ value: template.id, label: getRoleName(template, t), description: t(`staff.environments.${template.environment}`) }))}
                value={state.templateRoleId}
                onChange={editor.chooseTemplate}
              />
              <ListDivider />
            </>
          )}

          {target.mode === 'create' && (
            <RoleNameInput editor={editor} value={nameValue} isEditable={!isBusy} shouldFocus={false} />
          )}

          <ListDivider />

          <ListSection title={t('staff.roles.bundles')} footer={t('staff.roles.bundlesHint')}>
            {state.bundleOptions.map((option) => {
              const label = t(option.labelKey)
              return (
                <View key={option.key}>
                  <SwitchRow
                    label={label}
                    isOn={option.isSelected}
                    isDisabled={state.readOnlyReason !== undefined || isBusy}
                    onChange={(isOn) => { editor.setBundleSelected(option.key, isOn) }}
                  />
                  {/* Alcance só vira escolha quando existe mais de uma opção válida. */}
                  {option.isSelected && option.hasScopeChoice && (
                    <View style={styles.scope}>
                      <ChoiceList
                        label={t('staff.roles.scope', { bundle: label })}
                        choices={option.scopes.map((scopeOption) => ({ value: scopeOption.scope, label: t(`staff.scopes.${scopeOption.scope}`) }))}
                        value={option.scopes.find((scopeOption) => scopeOption.isSelected)?.scope}
                        isDisabled={state.readOnlyReason !== undefined || isBusy}
                        // O recuo sob o interruptor já diz a que permissão o alcance pertence.
                        isLabelVisible={false}
                        // Recuo marca o alcance como parte da permissão acima, não um tópico novo;
                        // vai no conteúdo para o destaque do toque seguir de borda a borda.
                        inset={SPACING.lg}
                        onChange={(scope) => { editor.chooseScope(option.key, scope) }}
                      />
                    </View>
                  )}
                </View>
              )
            })}
          </ListSection>
          {editor.bundlesError !== undefined && (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" size="caption" tone="danger">{t('staff.roles.chooseBundle')}</Text>
          )}

          {operation.status === 'failed' && (
            <FailureNotice failure={operation.failure} onRetry={operation.failure === 'configuration-conflict' ? editor.reload : undefined} actionLabel={t('staff.reload')} />
          )}

          {operation.status === 'confirming-impact' && (
            <View style={[styles.impact, { borderColor: colors.danger, borderRadius: radius.field }]}>
              <Text accessibilityRole="header" weight="medium">{t('staff.roles.impactTitle')}</Text>
              <Text accessibilityLiveRegion="polite">{t('staff.roles.impactMembers', { count: operation.impact.activeMemberCount })}</Text>
              {operation.impact.revokesInvitations && <Text>{t('staff.roles.impactInvitations', { count: operation.impact.pendingInvitationCount })}</Text>}
              <Button label={t('staff.roles.confirmSave')} onPress={() => { void editor.confirmSave().then(finish) }} />
              <Button variant="outline" label={t('staff.cancel')} onPress={editor.cancel} />
            </View>
          )}

          {(operation.status === 'confirming-deletion' || operation.status === 'deleting') && (
            <ConfirmationSheet
              title={t('staff.roles.deleteTitle')}
              message={t('staff.roles.deleteConfirmation', { name: roleName })}
              confirmVariant="danger"
              confirmLabel={operation.status === 'deleting' ? t('staff.roles.deleting') : t('staff.roles.confirmDelete')}
              cancelLabel={t('staff.cancel')}
              isBusy={operation.status === 'deleting'}
              onConfirm={() => { void editor.confirmDeletion().then(finish) }}
              onCancel={editor.cancel}
            />
          )}

          {state.readOnlyReason === undefined && operation.status !== 'confirming-impact' && (
            <View style={styles.stack}>
              <Button
                label={operation.status === 'saving' ? t('staff.roles.saving') : t('staff.roles.save')}
                isDisabled={isBusy}
                isBusy={operation.status === 'saving'}
                onPress={() => { setIsEditingName(false); void editor.save().then(finish) }}
              />
              {state.canDelete && <Button variant="dangerOutline" icon="trash" label={t('staff.roles.delete')} isDisabled={isBusy} onPress={editor.requestDeletion} />}
            </View>
          )}
        </>
      )}
    </StackPage>
  )
}

function RoleNameInput({ editor, value, isEditable, shouldFocus }: Readonly<{ editor: RoleEditor; value: string; isEditable: boolean; shouldFocus: boolean }>) {
  const { t } = useTranslation()
  return (
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
          editable={isEditable}
          autoFocus={shouldFocus}
          maxLength={80}
          value={value}
          onChangeText={editor.setName}
          onBlur={editor.leaveName}
        />
      )}
    </FormField>
  )
}

const styles = StyleSheet.create({
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  // Encolhe em vez de ocupar a linha: o lápis fica colado ao nome, não no canto.
  nameText: { flexShrink: 1 },
  pencil: { alignItems: 'center', justifyContent: 'center' },
  // Observação cola no nome: o espaço maior da página separaria nota e assunto.
  header: { gap: SPACING.xs },
  // Campo tem borda própria; com o espaço da nota, o texto parece preso ao campo.
  headerWithInput: { gap: SPACING.md },
  stack: { gap: SPACING.md },
  scope: { paddingBottom: SPACING.sm },
  impact: { gap: SPACING.sm, borderWidth: 1, padding: SPACING.lg },
})
