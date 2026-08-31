// Fixture positiva: papel declarado e todo texto vindo do catálogo.
export function RetryButton({ t, onPress }: { t: (key: string) => string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('retryLabel')} onPress={onPress}>
      <Text>{t('retryLabel')}</Text>
    </Pressable>
  )
}
