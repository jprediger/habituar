import Ionicons from '@expo/vector-icons/Ionicons'
import { SPACING } from '@habituar/design-tokens/spacing'
import type { AuthenticationFailure } from '@habituar/react-client/react-client'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { getAuthenticationFailureRecovery, getAuthenticationFailureText } from './authentication-failure-messages'
import { Button } from '../components/ui/button'
import { Text } from '../components/ui/text'
import { habituar } from '../client/habituar-client'
import { useThemeTokens } from '../theme/tokens'

const ICON_SIZE = 20

/**
 * O que a tela mostra quando a autenticação falha: o texto da falha e a saída que ela
 * admite. A saída existe porque `no-memberships` e `forbidden` acontecem com token já
 * gravado — sem ela, a pessoa reabre o app no mesmo beco. As outras falhas não ganham
 * botão: a ação que as resolve é o próprio envio do formulário.
 */
export function AuthenticationFailureAlert({ failure }: Readonly<{ failure: AuthenticationFailure }>) {
  const { t } = useTranslation()
  const { colors, radius } = useThemeTokens()
  const { actions } = habituar.useAuthentication()
  const recovery = getAuthenticationFailureRecovery(failure)

  return (
    // A moldura existe porque a falha do formulário disputa atenção com as mensagens de
    // campo: só a cor do texto as deixa com o mesmo peso visual.
    <View
      accessibilityRole="alert"
      // O anúncio é da região inteira: o leitor de tela precisa ler o texto junto do
      // botão de saída, não um antes do outro como dois avisos soltos.
      accessibilityLiveRegion="polite"
      style={[styles.container, { borderColor: colors.danger, borderRadius: radius.field }]}
    >
      <View style={styles.message}>
        {/* O ícone é reforço do texto, nunca o sinal único da falha (WCAG 1.4.1). */}
        <Ionicons
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          name="alert-circle-outline"
          size={ICON_SIZE}
          color={colors.danger}
          style={styles.icon}
        />
        {/* O `Text` do kit não recebe `style`: a largura restante é dada pela caixa. */}
        <View style={styles.text}>
          <Text tone="danger">{getAuthenticationFailureText(failure, t)}</Text>
        </View>
      </View>

      {recovery === 'sign-out' && (
        <Button
          variant="outline"
          label={t('authentication.failure.signOut')}
          onPress={() => {
            void actions.logout()
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, padding: SPACING.md, gap: SPACING.sm },
  message: { flexDirection: 'row', gap: SPACING.sm },
  // A entrelinha do corpo empurra a primeira linha para baixo do topo do ícone.
  icon: { marginTop: 2 },
  text: { flex: 1 },
})
