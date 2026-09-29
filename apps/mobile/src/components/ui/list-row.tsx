import { SPACING } from '@habituar/design-tokens/spacing'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import { Text } from './text'
import type { IconName } from './icon'
import { Icon } from './icon'
import { PressableRow } from './pressable-row'

type ListRowProps = Readonly<{
  title: string
  description?: string | undefined
  value?: string | undefined
  icon?: IconName | undefined
  accessibilityLabel?: string | undefined
  accessibilityHint?: string | undefined
  onPress?: (() => void) | undefined
  children?: ReactNode
}>

/**
 * Linha de lista do app, a unidade das telas de listagem: ícone opcional, título, texto de
 * apoio e valor à direita, sem borda nem superfície. Com `onPress` vira navegação e ganha a
 * seta; sem ele é só informação, e `children` fica abaixo do texto.
 */
export function ListRow({ title, description, value, icon, accessibilityLabel, accessibilityHint, onPress, children }: ListRowProps) {
  const { colors, minimumTouchTarget } = useThemeTokens()
  const content = (
    <>
      {icon !== undefined && <Icon name={icon} size={24} color={colors.text} />}
      <View style={styles.text}>
        <Text>{title}</Text>
        {description !== undefined && <Text size="caption" tone="muted">{description}</Text>}
        {children}
      </View>
      {value !== undefined && <Text tone="muted">{value}</Text>}
      {onPress !== undefined && <Icon name="caret-right" size={20} color={colors.textMuted} />}
    </>
  )

  if (onPress === undefined) {
    return <View style={[styles.row, { minHeight: minimumTouchTarget }]}>{content}</View>
  }
  return (
    <PressableRow accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityHint={accessibilityHint} onPress={onPress}>
      {content}
    </PressableRow>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, paddingVertical: SPACING.md },
  text: { flex: 1, gap: SPACING.xs },
})
