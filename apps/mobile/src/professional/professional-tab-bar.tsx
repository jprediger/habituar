import { SPACING } from '@habituar/design-tokens/spacing'
import type { ProfessionalNavigationIcon } from '@habituar/react-client/professional-navigation'
import {
  findActiveProfessionalNavigationItem,
  useProfessionalNavigation,
} from '@habituar/react-client/professional-navigation'
import { usePathname, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '../components/ui/text'
import { NavigationIcon } from './navigation-icon'
import { useThemeTokens } from '../theme/tokens'

const ICON_SIZE = 26

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
          borderTopColor: colors.divider,
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
  const { colors, minimumTouchTarget } = useThemeTokens()

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, { minHeight: minimumTouchTarget, opacity: pressed ? 0.7 : 1 }]}
    >
      {/* Decoração: o rótulo visível já é o nome acessível da aba. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <NavigationIcon
          icon={icon}
          // Seleção sem fundo: o preenchimento é o sinal de forma, e a cor e o peso do
          // rótulo o reforçam — nenhum dos três sozinho carrega a informação.
          weight={isSelected ? 'fill' : 'regular'}
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
  // Sem vão entre ícone e rótulo: o respiro interno do desenho e a entrelinha da legenda
  // já os separam, e qualquer espaço a mais faz os dois parecerem elementos soltos.
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.none },
})
