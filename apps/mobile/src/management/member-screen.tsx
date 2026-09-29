import { SPACING } from '@habituar/design-tokens/spacing'
import type { MembershipId } from '@habituar/core/identity/ids'
import type { MemberOperation } from '@habituar/react-client/staff-management'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { ListSectionSkeleton } from '../components/skeletons/list-section-skeleton'
import { Skeleton } from '../components/skeletons/skeleton'
import { SkeletonText } from '../components/skeletons/skeleton-text'
import { ConfirmationSheet } from '../components/ui/confirmation-sheet'
import { Button } from '../components/ui/button'
import { CheckboxRow } from '../components/ui/checkbox-row'
import { StackPage } from '../components/ui/stack-page'
import { useToast } from '../components/ui/toast'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { toStaffContext } from './staff-context'
import { FailureNotice, getRoleName } from './staff-feedback'

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

  const showToast = useToast()
  // O aviso reage ao que a ação devolveu: a remoção fecha a tela, e o aviso a sobrevive.
  const finish = (outcome: MemberOperation | undefined) => {
    if (outcome?.status === 'saved') showToast(t('staff.member.saved'))
    if (outcome?.status === 'removed') {
      showToast(t('staff.member.removed', { institution }))
      onDone()
    }
  }

  return (
    <StackPage title={state.status === 'ready' ? state.member.user.name : t('staff.loading')}>
      {state.status === 'loading' && (
        <Skeleton>
          <SkeletonText width="70%" />
          <ListSectionSkeleton hasTitle rows={4} row={{ hasDescription: false }} />
        </Skeleton>
      )}
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

          {(operation.status === 'confirming-removal' || operation.status === 'removing') && (
            <ConfirmationSheet
              title={t('staff.member.removeTitle')}
              confirmVariant="danger"
              message={state.isSelf
                ? t('staff.member.removeSelfConfirmation', { institution })
                : t('staff.member.removeConfirmation', { name: state.member.user.name, institution })}
              confirmLabel={operation.status === 'removing' ? t('staff.member.removing') : t('staff.member.confirmRemove')}
              cancelLabel={t('staff.member.keep')}
              isBusy={operation.status === 'removing'}
              onConfirm={() => { void editor.confirmRemoval().then(finish) }}
              onCancel={editor.cancel}
            />
          )}
          <View style={styles.stack}>
            {state.canEditRoles && (
              <Button
                label={operation.status === 'saving' ? t('staff.member.saving') : t('staff.member.save')}
                isDisabled={isBusy || !state.isDirty}
                isBusy={operation.status === 'saving'}
                onPress={() => { void editor.save().then(finish) }}
              />
            )}
            {state.canRemove && <Button variant="dangerOutline" label={t('staff.member.remove')} isDisabled={isBusy} onPress={editor.requestRemoval} />}
          </View>
        </View>
      )}
    </StackPage>
  )
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.md },
})
