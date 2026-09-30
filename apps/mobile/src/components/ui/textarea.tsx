import { StyleSheet } from 'react-native'
import type { InputProps } from './input'
import { Input } from './input'

/**
 * Campo de texto longo do kit nativo: o mesmo `Input`, com altura para algumas linhas e o
 * texto começando no topo. Recusa altura automática — o campo cresce rolando por dentro.
 */
export function Textarea({ style, ...props }: Omit<InputProps, 'multiline'>) {
  return <Input {...props} multiline style={[styles.field, style]} />
}

const styles = StyleSheet.create({
  // Sem `textAlignVertical`, o Android centraliza a primeira linha num campo alto.
  field: { minHeight: 120, textAlignVertical: 'top' },
})
