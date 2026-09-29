import { SPACING } from '@habituar/design-tokens/spacing'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useThemeTokens } from '../../theme/tokens'
import { Button } from './button'
import { Text } from './text'
import { useReduceMotion } from './use-reduce-motion'
import { useTranslation } from 'react-i18next'

// Véu escuro, não token de cor: é sombra sobre qualquer tema, e no escuro um cinza do
// tema some contra o fundo.
const BACKDROP_COLOR = 'rgba(0, 0, 0, 0.45)'
const GRABBER_WIDTH = 36

type ConfirmationSheetProps = Readonly<{
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  confirmVariant: 'danger' | 'primary'
  isBusy: boolean
  onConfirm: () => void
  onCancel: () => void
}>

/**
 * Confirmação de ação sem volta em folha que sobe da base, sobre a tela que a pediu. Dona
 * só da apresentação e do bloqueio enquanto a ação roda: montar é abrir, e quando fechar
 * é decisão do estado de operação do hook. Toque no véu e voltar do sistema cancelam,
 * exceto durante a execução.
 */
export function ConfirmationSheet({ title, message, confirmLabel, cancelLabel, confirmVariant, isBusy, onConfirm, onCancel }: ConfirmationSheetProps) {
  const { t } = useTranslation()
  const { colors, radius } = useThemeTokens()
  const insets = useSafeAreaInsets()
  const isReduceMotionEnabled = useReduceMotion()
  const cancelUnlessBusy = () => { if (!isBusy) onCancel() }

  return (
    <Modal transparent visible animationType={isReduceMotionEnabled ? 'fade' : 'slide'} statusBarTranslucent onRequestClose={cancelUnlessBusy}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('confirmationSheet.dismiss')}
          style={[StyleSheet.absoluteFill, { backgroundColor: BACKDROP_COLOR }]}
          onPress={cancelUnlessBusy}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.surface,
              borderTopRightRadius: radius.surface,
              paddingBottom: SPACING.xl + insets.bottom,
            },
          ]}
        >
          <View importantForAccessibility="no" style={[styles.grabber, { backgroundColor: colors.divider, borderRadius: radius.pill }]} />
          <View style={styles.text}>
            <Text accessibilityRole="header" size="title" weight="bold">{title}</Text>
            <Text tone="muted">{message}</Text>
          </View>
          <View style={styles.actions}>
            <Button variant={confirmVariant} label={confirmLabel} isDisabled={isBusy} isBusy={isBusy} onPress={onConfirm} />
            <Button variant="outline" label={cancelLabel} isDisabled={isBusy} onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm, gap: SPACING.xl },
  grabber: { alignSelf: 'center', width: GRABBER_WIDTH, height: SPACING.xs },
  text: { gap: SPACING.sm },
  actions: { gap: SPACING.sm },
})
