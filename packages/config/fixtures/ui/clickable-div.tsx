// Fixture negativa: handler pendurado em elemento que não é interativo por natureza.
export function RetryArea({ onClick }: { onClick: () => void }) {
  return <div onClick={onClick} />
}
