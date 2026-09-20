import { SPACING } from '@habituar/design-tokens/spacing'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import { Text } from './text'

export type FormFieldControl = Readonly<{
  accessibilityLabel: string
  accessibilityHint: string | undefined
  hasError: boolean
}>

export type FormFieldProps = Readonly<{
  id: string
  label: string
  isRequired: boolean
  hint?: string | undefined
  error?: string | undefined
  action?: ReactNode | undefined
  children: (control: FormFieldControl) => ReactNode
}>

/**
 * Enquadramento de um campo de formulário nativo: rótulo, marca de obrigatório, ação da
 * linha do rótulo, dica e mensagem de erro. Dona da amarração acessível entre esses
 * textos e o controle — que a recebe pronta e nunca a monta por conta própria.
 *
 * O React Native não tem `<label for>` nem `aria-describedby` confiável, então a
 * amarração é por `accessibilityLabel` e `accessibilityHint` no próprio controle; a
 * equivalência com o web está registrada em `ACCESSIBILITY.md`.
 */
export function FormField({ label, isRequired, hint, error, action, children }: FormFieldProps) {
  const { t } = useTranslation()
  const { compactTouchTarget } = useThemeTokens()

  return (
    <View style={styles.container}>
      <View style={[styles.labelRow, { minHeight: compactTouchTarget }]}>
        <Text weight="medium">
          {label}
          {isRequired && (
            // A obrigatoriedade já vai no rótulo acessível do controle; o `*` existe só
            // para quem enxerga, e lê-lo seria anunciá-la duas vezes.
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              tone="danger"
            >
              {' *'}
            </Text>
          )}
        </Text>
        {action}
      </View>

      {children({
        accessibilityLabel: isRequired ? t('form.requiredFieldLabel', { label }) : label,
        // O erro substitui a dica: `accessibilityHint` é um texto só, e orientação antiga
        // ao lado de uma falha atual confunde mais do que ajuda.
        accessibilityHint: error ?? hint,
        hasError: error !== undefined,
      })}

      {hint !== undefined && (
        <Text size="caption" tone="muted">
          {hint}
        </Text>
      )}
      {error !== undefined && (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" size="caption" tone="danger">
          {error}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: SPACING.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
})
