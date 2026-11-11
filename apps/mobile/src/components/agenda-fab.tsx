import { SPACING } from '@habituar/design-tokens/spacing'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { useThemeTokens } from '../theme/tokens'
import type { IconName } from './ui/icon'
import { Icon } from './ui/icon'
import { Text } from './ui/text'

const FAB_SIZE = 56
/**
 * Folga que uma rolagem sob o botão flutuante deixa no fim, para ele não cobrir a última linha.
 */
export const FAB_CLEARANCE = FAB_SIZE + SPACING.xl * 2
const BACKDROP_COLOR = 'rgba(0, 0, 0, 0.45)'

export type AgendaFabAction = Readonly<{ key: string; label: string; icon: IconName; onPress: () => void }>

/**
 * Botão flutuante de criar da agenda — exceção documentada à regra da ação na barra. Com
 * um tipo só cria direto; com mais abre o menu de tipos acima dele, como no Google Agenda.
 * Sem tipo nenhum não aparece: quem só lê a agenda não vê um botão que não pode usar.
 */
export function AgendaFab({ actions }: Readonly<{ actions: readonly AgendaFabAction[] }>) {
  const { t } = useTranslation('agenda')
  const { colors, radius } = useThemeTokens()
  const [isOpen, setIsOpen] = useState(false)
  const [single] = actions

  if (single === undefined) return null
  const isSingle = actions.length === 1

  return (
    <>
      {isOpen && <Pressable accessibilityRole="button" accessibilityLabel={t('calendar.closeMenu')} style={[StyleSheet.absoluteFill, { backgroundColor: BACKDROP_COLOR }]} onPress={() => { setIsOpen(false) }} />}
      <View style={styles.anchor} pointerEvents="box-none">
        {isOpen && actions.map(action => (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => { setIsOpen(false); action.onPress() }}
            style={({ pressed }) => [styles.option, { minHeight: FAB_SIZE, borderRadius: radius.pill, backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
          >
            <Icon name={action.icon} size={22} color={colors.onPrimary} />
            <Text weight="medium" tone="onPrimary">{action.label}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSingle ? single.label : t(isOpen ? 'calendar.closeMenu' : 'calendar.create')}
          accessibilityState={isSingle ? undefined : { expanded: isOpen }}
          onPress={() => { if (isSingle) single.onPress(); else setIsOpen(!isOpen) }}
          style={({ pressed }) => [styles.fab, { width: FAB_SIZE, height: FAB_SIZE, borderRadius: radius.surface, backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
        >
          <Icon name={isOpen ? 'x' : 'plus'} size={26} color={colors.onPrimary} />
        </Pressable>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', right: SPACING.xl, bottom: SPACING.xl, alignItems: 'flex-end', gap: SPACING.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.xl },
  fab: { alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
})
