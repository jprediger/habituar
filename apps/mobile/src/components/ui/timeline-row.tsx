import { assertNever } from '@habituar/core/assert-never'
import { SPACING } from '@habituar/design-tokens/spacing'
import type { PropsWithChildren } from 'react'
import { StyleSheet, View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import type { IconName } from './icon'
import { Icon } from './icon'

const MARKER_SIZE = 28
const MARKER_ICON_SIZE = 16
const DOT_SIZE = 10
const RAIL_WIDTH = 2
// Espaço acima do marcador; o conteúdo desce o mesmo tanto para a primeira linha de texto
// ficar na altura do centro do marcador.
const RAIL_LEAD = SPACING.sm
const MARKER_CENTER = RAIL_LEAD + MARKER_SIZE / 2

/**
 * Marcador da linha do tempo. Ícone em círculo é para o registro que alguém escreveu; o ponto
 * é para o evento que o sistema anotou e precisa pesar menos na leitura.
 */
export type TimelineMarker = Readonly<{ kind: 'icon'; icon: IconName }> | Readonly<{ kind: 'dot' }>

/** Lugar do ponto no grupo: decide de onde a onde o trilho passa. */
export type TimelinePosition = 'only' | 'first' | 'middle' | 'last'

type TimelineRowProps = PropsWithChildren<Readonly<{
  marker: TimelineMarker
  position: TimelinePosition
  accessibilityLabel: string
}>>

/**
 * Um ponto de linha do tempo vertical, sem borda nem superfície. Marcador e trilho são
 * decoração: o leitor de tela ouve só `accessibilityLabel`, a frase inteira.
 */
export function TimelineRow({ marker, position, accessibilityLabel, children }: TimelineRowProps) {
  const { colors } = useThemeTokens()
  const rail = railSpan(position)

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={styles.row}>
      <View style={styles.gutter} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {/* Trilho atrás do marcador, e não em pedaços acima e abaixo dele: o ponto é menor
            que a caixa do marcador, e pedaços deixariam um vão em volta dele. */}
        {rail !== undefined && <View style={[styles.rail, rail, { backgroundColor: colors.divider }]} />}
        <View style={styles.marker}>
          {marker.kind === 'icon'
            ? <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}><Icon name={marker.icon} size={MARKER_ICON_SIZE} color={colors.primary} /></View>
            : <View style={[styles.dot, { backgroundColor: colors.border }]} />}
        </View>
      </View>
      <View style={[styles.content, position !== 'only' && position !== 'last' && styles.contentSpaced]}>{children}</View>
    </View>
  )
}

function railSpan(position: TimelinePosition): Readonly<{ top: number; bottom?: number; height?: number }> | undefined {
  switch (position) {
    case 'only':
      return undefined
    case 'first':
      return { top: MARKER_CENTER, bottom: 0 }
    case 'middle':
      return { top: 0, bottom: 0 }
    case 'last':
      return { top: 0, height: MARKER_CENTER }
    default:
      return assertNever(position)
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACING.md },
  gutter: { width: MARKER_SIZE, alignItems: 'center', paddingTop: RAIL_LEAD },
  rail: { position: 'absolute', width: RAIL_WIDTH },
  marker: { width: MARKER_SIZE, height: MARKER_SIZE, alignItems: 'center', justifyContent: 'center' },
  badge: { width: MARKER_SIZE, height: MARKER_SIZE, borderRadius: MARKER_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
  content: { flex: 1, gap: SPACING.xs, paddingTop: RAIL_LEAD + SPACING.xs },
  contentSpaced: { paddingBottom: SPACING.lg },
})
