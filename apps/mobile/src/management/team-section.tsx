import { SPACING } from '@habituar/design-tokens/spacing'
import type { StaffManagementContext } from '@habituar/react-client/staff-management'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { FormField } from '../components/ui/form-field'
import { Input } from '../components/ui/input'
import { SegmentedControl } from '../components/ui/segmented-control'
import { Text } from '../components/ui/text'
import { useThemeTokens } from '../theme/tokens'
import { PaginationControls, StaffListStatus, getRoleName } from './staff-feedback'

/**
 * Seção Equipe no app: busca enviada pelo teclado ou pelo botão, filtro por tipo de
 * vínculo e lista paginada; tocar numa pessoa abre os papéis dela.
 */
export function TeamSection({ context }: Readonly<{ context: StaffManagementContext }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const team = habituar.useTeam(context)
  const { colors, radius, minimumTouchTarget } = useThemeTokens()

  return (
    <View style={styles.stack}>
      <FormField id="team-search" label={t('staff.team.searchLabel')} isRequired={false}>
        {(control) => (
          <Input
            {...control}
            value={team.searchDraft}
            onChangeText={team.setSearchDraft}
            returnKeyType="search"
            onSubmitEditing={team.applySearch}
          />
        )}
      </FormField>
      <Button variant="outline" label={t('staff.team.search')} onPress={team.applySearch} />
      <SegmentedControl
        label={t('staff.team.environmentFilter')}
        options={[
          { value: 'all', label: t('staff.team.allEnvironments') },
          { value: 'professional', label: t('staff.environments.professional') },
          { value: 'monitor', label: t('staff.environments.monitor') },
        ]}
        value={team.environmentFilter}
        onChange={team.setEnvironmentFilter}
      />

      <StaffListStatus
        state={team.state}
        onRetry={team.retry}
        empty={{ title: t('staff.team.emptyTitle'), description: t('staff.team.emptyDescription') }}
        noResults={{
          title: t('staff.team.noResultsTitle'),
          description: t('staff.team.noResultsDescription'),
          action: <Button variant="outline" label={t('staff.team.clearSearch')} onPress={team.clearSearch} />,
        }}
      />

      {team.state.status === 'ready' && (
        <View style={styles.stack}>
          <Text size="caption" tone="muted">{t('staff.total', { count: team.state.total })}</Text>
          {team.state.items.map((member) => {
            const roles = member.roles.map((role) => getRoleName(role, t)).join(', ')
            return (
              <Pressable
                key={member.id}
                accessibilityRole="button"
                accessibilityLabel={t('staff.team.open', { name: member.user.name })}
                accessibilityHint={`${t(`staff.environments.${member.environment}`)} · ${roles}`}
                onPress={() => { router.push({ pathname: '/professional/management/member/[membership-id]', params: { 'membership-id': member.id } }) }}
                style={({ pressed }) => [styles.row, { minHeight: minimumTouchTarget, borderColor: colors.border, borderRadius: radius.field, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text weight="medium">{member.user.name}</Text>
                <Text size="caption" tone="muted">{member.user.email}</Text>
                <Text size="caption" tone="muted">{`${t(`staff.environments.${member.environment}`)} · ${roles}`}</Text>
              </Pressable>
            )
          })}
          <PaginationControls pagination={team.pagination} page={team.state.page} pageCount={team.state.pageCount} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.md },
  row: { borderWidth: 1, padding: SPACING.md, gap: SPACING.xs },
})
