/**
 * Única leitura do relógio do navegador na web: tela que precisa de "agora" passa por aqui,
 * e o teste fixa o instante trocando este módulo em vez de depender da hora em que roda.
 */
export function readCurrentTime(): Date {
  return new Date()
}
