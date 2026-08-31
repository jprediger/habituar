// Fixture negativa: rótulo acessível literal, que nunca chega ao catálogo pt-BR.
export function RetryButton({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Verificar novamente" onPress={onPress} />
}
