import type { TaskChangeScope } from '@habituar/core/tasks'
import { SPACING } from '@habituar/design-tokens/spacing'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '../components/ui/button'
import { Text } from '../components/ui/text'
import { useReduceMotion } from '../components/ui/use-reduce-motion'
import { useThemeTokens } from '../theme/tokens'

const BACKDROP_COLOR = 'rgba(0, 0, 0, 0.45)'

/**
 * Pergunta de alcance ao mexer numa ocorrência de série: "só esta" ou "desta em diante".
 * Mostra só os alcances que a regra admite; montar é abrir, e quem fecha é a tela.
 */
export function ScopeSheet({ title, scopes, isBusy, isDanger, onChoose, onCancel }: Readonly<{
  title: string
  scopes: readonly TaskChangeScope[]
  isBusy: boolean
  isDanger: boolean
  onChoose: (scope: TaskChangeScope) => void
  onCancel: () => void
}>) {
  const { t } = useTranslation('agenda')
  const { t: tc } = useTranslation()
  const { colors, radius } = useThemeTokens()
  const insets = useSafeAreaInsets()
  const isReduceMotionEnabled = useReduceMotion()
  const cancelUnlessBusy = () => { if (!isBusy) onCancel() }

  return (
    <Modal transparent visible animationType={isReduceMotionEnabled ? 'fade' : 'slide'} statusBarTranslucent onRequestClose={cancelUnlessBusy}>
      <View style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel={tc('confirmationSheet.dismiss')} style={[StyleSheet.absoluteFill, { backgroundColor: BACKDROP_COLOR }]} onPress={cancelUnlessBusy} />
        <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: colors.surface, borderTopLeftRadius: radius.surface, borderTopRightRadius: radius.surface, paddingBottom: SPACING.xl + insets.bottom }]}>
          <Text accessibilityRole="header" size="title" weight="bold">{title}</Text>
          <View style={styles.actions}>
            {scopes.map(scope => (
              <Button key={scope} variant={isDanger ? 'danger' : 'primary'} label={t(`calendar.scope.${scope}`)} isDisabled={isBusy} isBusy={isBusy} onPress={() => { onChoose(scope) }} />
            ))}
            <Button variant="outline" label={t('cancel')} isDisabled={isBusy} onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, gap: SPACING.xl },
  actions: { gap: SPACING.sm },
})
