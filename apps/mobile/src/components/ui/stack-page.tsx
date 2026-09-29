import { SPACING } from '@habituar/design-tokens/spacing'
import { useRouter } from 'expo-router'
import type { PropsWithChildren } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useThemeTokens } from '../../theme/tokens'
import { Text } from './text'
import type { IconName } from './icon'
import { Icon } from './icon'

export type StackPageAction = Readonly<{
  icon: IconName
  // Obrigatório: o ícone sozinho não diz nada ao leitor de tela.
  label: string
  onPress: () => void
}>

/**
 * Enquadramento de toda tela aninhada numa pilha: barra fixa com voltar e o título da tela,
 * conteúdo rolando abaixo. O título grande de `PageHeader` pertence só à raiz de cada aba;
 * aqui ele repetiria o que a barra já diz. Aceita no máximo uma ação, a de criar da tela:
 * mais que isso transforma a barra em barra de ferramentas.
 */
export function StackPage({ title, action, children }: PropsWithChildren<Readonly<{ title: string; action?: StackPageAction | undefined }>>) {
  const { t } = useTranslation()
  const router = useRouter()
  const { colors, minimumTouchTarget } = useThemeTokens()

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <View style={[styles.bar, { minHeight: minimumTouchTarget, borderBottomColor: colors.divider }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('navigation.back')}
          onPress={() => { router.back() }}
          hitSlop={SPACING.sm}
          style={({ pressed }) => [styles.iconButton, { minWidth: minimumTouchTarget, minHeight: minimumTouchTarget, opacity: pressed ? 0.7 : 1 }]}
        >
          <Icon name="arrow-left" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.title}>
          <Text accessibilityRole="header" size="title" weight="bold" numberOfLines={1}>
            {title}
          </Text>
        </View>
        {action !== undefined && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            hitSlop={SPACING.sm}
            style={({ pressed }) => [styles.iconButton, { minWidth: minimumTouchTarget, minHeight: minimumTouchTarget, opacity: pressed ? 0.7 : 1 }]}
          >
            <Icon name={action.icon} size={24} color={colors.text} />
          </Pressable>
        )}
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{children}</ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.xl, gap: SPACING.xl },
})
