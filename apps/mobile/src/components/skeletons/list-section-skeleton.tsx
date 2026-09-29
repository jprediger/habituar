import { SPACING } from '@habituar/design-tokens/spacing'
import type { ComponentProps } from 'react'
import { StyleSheet, View } from 'react-native'
import { ListRowSkeleton } from './list-row-skeleton'
import { SkeletonText } from './skeleton-text'

// Larguras alternadas: linhas todas iguais leem como tabela vazia, não como conteúdo.
const TITLE_WIDTHS = ['55%', '40%', '65%', '48%'] as const

/** Esqueleto de `ListSection`: título discreto opcional e um número fixo de linhas. */
export function ListSectionSkeleton({
  rows = 5,
  hasTitle = false,
  row,
}: Readonly<{ rows?: number; hasTitle?: boolean; row?: Omit<ComponentProps<typeof ListRowSkeleton>, 'titleWidth'> }>) {
  return (
    <View style={styles.container}>
      {hasTitle && <SkeletonText size="caption" width="25%" />}
      <View>
        {Array.from({ length: rows }, (_, index) => (
          <ListRowSkeleton key={index} {...row} titleWidth={TITLE_WIDTHS[index % TITLE_WIDTHS.length] ?? '55%'} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: SPACING.xs },
})
