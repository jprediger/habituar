import { SPACING } from '@habituar/design-tokens/spacing'
import { StyleSheet, View } from 'react-native'
import { ListSectionSkeleton } from './list-section-skeleton'
import { Skeleton } from './skeleton'
import { SkeletonText } from './skeleton-text'

/**
 * Substituto genérico de uma raiz de aba enquanto o conteúdo monta: a forma do
 * `PageHeader` e uma lista. Não conhece a tela — o esqueleto que descreve os dados de
 * cada uma é dela, e aparece assim que o conteúdo monta.
 */
export function PageSkeleton() {
  return (
    <Skeleton>
      <View style={styles.header}>
        <SkeletonText size="caption" width="35%" />
        <SkeletonText size="display" width="70%" />
      </View>
      <ListSectionSkeleton hasTitle rows={4} row={{ hasDescription: false }} />
    </Skeleton>
  )
}

/** Substituto genérico do conteúdo de uma tela de pilha; a barra com o título já está pintada. */
export function StackPageSkeleton() {
  return (
    <Skeleton>
      <ListSectionSkeleton hasTitle rows={4} row={{ hasDescription: false }} />
    </Skeleton>
  )
}

const styles = StyleSheet.create({
  header: { gap: SPACING.sm },
})
