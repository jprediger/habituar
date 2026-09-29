import { SPACING } from '@habituar/design-tokens/spacing'
import { StyleSheet, View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import { PressableRow } from './pressable-row'
import { Text } from './text'

// Medidas próprias em vez do `Switch` nativo: o do Android é menor que o alvo de toque e
// pinta o botão com cor de sistema, que some no tema escuro.
const TRACK_WIDTH = 52
const TRACK_HEIGHT = 32
const THUMB_SIZE = 24

/**
 * Campo booleano do app: rótulo à esquerda e interruptor à direita, com a linha inteira
 * tocável. Dono só do visual e da amarração acessível; ligar ou não é decisão de quem o usa.
 */
export function SwitchRow({
  label,
  description,
  isOn,
  isDisabled = false,
  onChange,
}: Readonly<{ label: string; description?: string | undefined; isOn: boolean; isDisabled?: boolean; onChange: (isOn: boolean) => void }>) {
  const { colors } = useThemeTokens()

  return (
    <PressableRow
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: isOn, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => { onChange(!isOn) }}
    >
      <View style={styles.texts}>
        <Text>{label}</Text>
        {description !== undefined && <Text size="caption" tone="muted">{description}</Text>}
      </View>
      {/* A trilha é só forma: o estado vai para a tecnologia assistiva pelo `checked`. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        // Desligado em tons médios do tema: o estado ligado é o que precisa pesar na linha.
        style={[styles.track, { backgroundColor: isOn ? colors.primary : colors.divider, alignItems: isOn ? 'flex-end' : 'flex-start' }]}
      >
        <View style={[styles.thumb, { backgroundColor: isOn ? colors.onPrimary : colors.surface }]} />
      </View>
    </PressableRow>
  )
}

const styles = StyleSheet.create({
  texts: { flex: 1, gap: SPACING.none },
  // Raio exato de meia altura, não `radius.pill`: o Android arredonda mal um raio muito
  // maior que a própria forma, e o semicírculo sai achatado nas bordas.
  track: { width: TRACK_WIDTH, height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, justifyContent: 'center', paddingHorizontal: (TRACK_HEIGHT - THUMB_SIZE) / 2 },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2 },
})
