import { SPACING } from '@habituar/design-tokens/spacing'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { getFieldErrorText } from '../authentication/form-messages'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { CheckboxRow } from '../components/ui/checkbox-row'
import { FormField } from '../components/ui/form-field'
import { Input } from '../components/ui/input'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import { SegmentedControl } from '../components/ui/segmented-control'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { toStaffContext } from './staff-context'
import { FailureNotice, ResultAnnouncement, getRoleName } from './staff-feedback'

/**
 * Convite no app: e-mail, tipo de vínculo e papéis que o ator pode conceder, com os
 * mesmos campos e regras da web. O link de uso único só aparece depois de criado.
 */
export function InvitationScreen({ session, onDone }: Readonly<{ session: InstitutionSession; onDone: () => void }>) {
  const { t } = useTranslation()
  const composer = habituar.useInvitationComposer(toStaffContext(session))
  const { submission } = composer

  if (submission.status === 'created') {
    return (
      <Page>
        <PageHeader eyebrow={t('staff.sections.invitations')} title={t('staff.invitations.new')} />
        <ResultAnnouncement>
          <Text>{t('staff.invitations.created', { email: submission.email })}</Text>
          <Text size="caption" tone="muted">{t('staff.invitations.oneTimeWarning')}</Text>
          <Text selectable>{submission.inviteUrl}</Text>
        </ResultAnnouncement>
        <Button variant="outline" label={t('staff.invitations.another')} onPress={composer.startAnother} />
        <Button label={t('staff.close')} onPress={onDone} />
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader eyebrow={t('staff.sections.invitations')} title={t('staff.invitations.new')} />
      <View style={styles.stack}>
        <FormField
          id="invitation-email"
          label={t('staff.invitations.email')}
          isRequired
          error={composer.emailError === undefined ? undefined : getFieldErrorText(composer.emailError, t)}
        >
          {(control) => (
            <Input
              {...control}
              hasError={control.hasError}
              value={composer.email}
              onChangeText={composer.setEmail}
              onBlur={composer.leaveEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="off"
            />
          )}
        </FormField>

        <SegmentedControl
          label={t('staff.invitations.environment')}
          options={[
            { value: 'professional', label: t('staff.environments.professional') },
            { value: 'monitor', label: t('staff.environments.monitor') },
          ]}
          value={composer.environment}
          onChange={composer.setEnvironment}
        />

        <Text accessibilityRole="header" weight="medium">{t('staff.invitations.roles')}</Text>
        <Text size="caption" tone="muted">{t('staff.invitations.rolesHint')}</Text>
        {composer.rolesState.status === 'loading' && <Text accessibilityLiveRegion="polite" tone="muted">{t('staff.loading')}</Text>}
        {composer.rolesState.status === 'failed' && <FailureNotice failure={composer.rolesState.failure} onRetry={composer.retryRoles} actionLabel={t('staff.retry')} />}
        {composer.rolesState.status === 'ready' && composer.roleOptions.length === 0 && <Text>{t('staff.invitations.noRoles')}</Text>}
        {composer.roleOptions.map((option) => (
          <CheckboxRow
            key={option.role.id}
            label={getRoleName(option.role, t)}
            description={option.role.templateKey === null ? undefined : t(`roleDescriptions.${option.role.templateKey}`)}
            isChecked={option.isSelected}
            onChange={(isChecked) => { composer.setRoleSelected(option.role.id, isChecked) }}
          />
        ))}
        {composer.roleError !== undefined && (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" size="caption" tone="danger">{t('staff.invitations.chooseRole')}</Text>
        )}

        {submission.status === 'failed' && <FailureNotice failure={submission.failure} />}
        <Button
          label={submission.status === 'submitting' ? t('staff.invitations.creating') : t('staff.invitations.create')}
          isDisabled={submission.status === 'submitting'}
          isBusy={submission.status === 'submitting'}
          onPress={() => { void composer.submit() }}
        />
      </View>
    </Page>
  )
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.md },
})
