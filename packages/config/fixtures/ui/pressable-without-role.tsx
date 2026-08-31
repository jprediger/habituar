// Fixture negativa: toque sem papel declarado, invisível para o leitor de tela.
export function RetryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityLabel={label} />
}
