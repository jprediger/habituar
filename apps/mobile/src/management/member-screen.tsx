import { SPACING } from '@habituar/design-tokens/spacing'
import type { MembershipId } from '@habituar/core/identity/ids'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { CheckboxRow } from '../components/ui/checkbox-row'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { toStaffContext } from './staff-context'
import { ConfirmationPanel, FailureNotice, ResultAnnouncement, getRoleName } from './staff-feedback'

/**
 * Um membro da equipe no app: troca do conjunto inteiro de papéis e remoção do vínculo
 * com confirmação que nomeia pessoa e instituição. Mesmo hook e mesmas regras da web.
 */
export function MemberScreen({ session, membershipId, onDone }: Readonly<{ session: InstitutionSession; membershipId: MembershipId; onDone: () => void }>) {
  const { t } = useTranslation()
  const editor = habituar.useTeamMember(toStaffContext(session), membershipId)
  const { state, operation } = editor
  const institution = session.membership.institution.name
  const isBusy = operation.status === 'saving' || operation.status === 'removing'

  if (operation.status === 'removed') {
    return (
      <Page>
        <PageHeader eyebrow={t('staff.sections.team')} title={t('staff.sections.team')} />
        <ResultAnnouncement><Text>{t('staff.member.removed', { institution })}</Text></ResultAnnouncement>
        <Button label={t('staff.close')} onPress={onDone} />
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader eyebrow={t('staff.sections.team')} title={state.status === 'ready' ? state.member.user.name : t('staff.loading')} />
      {state.status === 'loading' && <Text accessibilityLiveRegion="polite" tone="muted">{t('staff.loading')}</Text>}
      {state.status === 'failed' && <FailureNotice failure={state.failure} onRetry={editor.reload} actionLabel={t('staff.reload')} />}

      {state.status === 'ready' && (
        <View style={styles.stack}>
          <Text tone="muted">{`${state.member.user.email} · ${t(`staff.environments.${state.member.environment}`)}`}</Text>
          <Text accessibilityRole="header" weight="medium">{t('staff.member.rolesLegend')}</Text>
          <Text size="caption" tone="muted">{state.canEditRoles ? t('staff.member.rolesHint') : t('staff.member.readOnly')}</Text>
          {state.roleOptions.map((option) => (
            <CheckboxRow
              key={option.role.id}
              label={getRoleName(option.role, t)}
              description={option.isDelegable ? undefined : t('staff.member.notDelegable')}
              isChecked={option.isSelected}
              isDisabled={!state.canEditRoles || !option.isDelegable || isBusy}
              onChange={(isChecked) => { editor.setRoleSelected(option.role.id, isChecked) }}
            />
          ))}
          {editor.roleError !== undefined && (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" size="caption" tone="danger">{t('staff.member.chooseRole')}</Text>
          )}

          {operation.status === 'failed' && (
            <FailureNotice failure={operation.failure} onRetry={operation.failure === 'configuration-conflict' ? editor.reload : undefined} actionLabel={t('staff.reload')} />
          )}
          {operation.status === 'saved' && <ResultAnnouncement><Text>{t('staff.member.saved')}</Text></ResultAnnouncement>}

          {operation.status === 'confirming-removal' || operation.status === 'removing' ? (
            <ConfirmationPanel
              message={state.isSelf
                ? t('staff.member.removeSelfConfirmation', { institution })
                : t('staff.member.removeConfirmation', { name: state.member.user.name, institution })}
              confirmLabel={operation.status === 'removing' ? t('staff.member.removing') : t('staff.member.confirmRemove')}
              cancelLabel={t('staff.member.keep')}
              isBusy={operation.status === 'removing'}
              onConfirm={() => { void editor.confirmRemoval() }}
              onCancel={editor.cancel}
            />
          ) : (
            <View style={styles.stack}>
              {state.canEditRoles && (
                <Button
                  label={operation.status === 'saving' ? t('staff.member.saving') : t('staff.member.save')}
                  isDisabled={isBusy || !state.isDirty}
                  isBusy={operation.status === 'saving'}
                  onPress={() => { void editor.save() }}
                />
              )}
              {state.canRemove && <Button variant="outline" label={t('staff.member.remove')} isDisabled={isBusy} onPress={editor.requestRemoval} />}
            </View>
          )}
        </View>
      )}
    </Page>
  )
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.md },
})
