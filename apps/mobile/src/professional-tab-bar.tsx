import Ionicons from '@expo/vector-icons/Ionicons'
import { SPACING } from '@habituar/design-tokens/spacing'
import type { ProfessionalNavigationIcon } from '@habituar/react-client/professional-navigation'
import {
  findActiveProfessionalNavigationItem,
  useProfessionalNavigation,
} from '@habituar/react-client/professional-navigation'
import { usePathname, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from './components/ui/text'
import { getNavigationGlyphs } from './navigation-icon'
import { useThemeTokens } from './theme/tokens'
import { useIsReduceMotionEnabled } from './use-is-reduce-motion-enabled'

const ICON_SIZE = 22
const INDICATOR_WIDTH = 56
const INDICATOR_HEIGHT = 32
// Tinta, não cor cheia: o acento verde marca a seleção sem competir com o conteúdo da
// página, e a opacidade sobre `primary` segue o tema sem pedir um token só para isto.
const INDICATOR_OPACITY = 0.14
// Curta o bastante para não atrasar quem já sabe para onde vai; longa o bastante para o
// olho ligar a pílula ao item tocado.
const INDICATOR_DURATION_MS = 160

/**
 * Barra inferior do ambiente profissional. Dona só do visual e da troca de aba: quais
 * destinos existem, em que ordem e qual está ativo vêm do hook compartilhado, então esta
 * barra nunca decide sozinha o que o profissional pode abrir.
 */
export function ProfessionalTabBar() {
  const { t } = useTranslation()
  const items = useProfessionalNavigation()
  const pathname = usePathname()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors } = useThemeTokens()
  const activeItem = findActiveProfessionalNavigationItem(items, pathname)

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          // Sem indicador de gesto, a barra ainda precisa de respiro embaixo; com ele, o
          // inset já é o respiro e somar os dois empurraria os rótulos para cima à toa.
          paddingBottom: Math.max(insets.bottom, SPACING.sm),
        },
      ]}
    >
      {items.map((item) => (
        <ProfessionalTab
          key={item.id}
          label={t(item.labelKey)}
          icon={item.icon}
          isSelected={item.id === activeItem?.id}
          onPress={() => {
            router.navigate(item.path)
          }}
        />
      ))}
    </View>
  )
}

function ProfessionalTab({
  label,
  icon,
  isSelected,
  onPress,
}: Readonly<{ label: string; icon: ProfessionalNavigationIcon; isSelected: boolean; onPress: () => void }>) {
  const { colors, minimumTouchTarget, radius } = useThemeTokens()
  const isReduceMotionEnabled = useIsReduceMotionEnabled()
  const [selection] = useState(() => new Animated.Value(isSelected ? 1 : 0))
  const glyphs = getNavigationGlyphs(icon)

  useEffect(() => {
    const target = isSelected ? 1 : 0

    // Com movimento reduzido a pílula aparece já no lugar: o estado muda igual, só não
    // se desloca até ele.
    if (isReduceMotionEnabled) {
      selection.setValue(target)
      return
    }

    const animation = Animated.timing(selection, {
      toValue: target,
      duration: INDICATOR_DURATION_MS,
      easing: Easing.out(Easing.quad),
      // O react-native-web não tem driver nativo e avisa a cada animação que o peça.
      useNativeDriver: Platform.OS !== 'web',
    })
    animation.start()

    return () => {
      animation.stop()
    }
  }, [isSelected, isReduceMotionEnabled, selection])

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, { minHeight: minimumTouchTarget, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={styles.iconSlot}>
        <Animated.View
          style={[
            styles.indicator,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.pill,
              opacity: selection.interpolate({ inputRange: [0, 1], outputRange: [0, INDICATOR_OPACITY] }),
              transform: [{ scaleX: selection.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
            },
          ]}
        />
        {/* Decoração: o rótulo visível já é o nome acessível da aba. */}
        <Ionicons
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          name={isSelected ? glyphs.active : glyphs.inactive}
          size={ICON_SIZE}
          color={isSelected ? colors.primary : colors.textMuted}
        />
      </View>
      <Text size="caption" weight={isSelected ? 'bold' : 'regular'} tone={isSelected ? 'default' : 'muted'}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // Separador fino no lugar de sombra: a barra se distingue da página sem pesar sobre ela.
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACING.sm },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
  iconSlot: { width: INDICATOR_WIDTH, height: INDICATOR_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  indicator: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
})
