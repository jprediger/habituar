import type { ReactElement } from 'react'

const LOGO_SIZE = 56
// Quadrado arredondado desenhado como path: mantém as duas plataformas com a geometria idêntica, caractere
// por caractere. Inserção de 2 em 48, raio de 14 — o mesmo raio dos campos, em escala.
const SQUARE =
  'M16 2 H32 A14 14 0 0 1 46 16 V32 A14 14 0 0 1 32 46 H16 A14 14 0 0 1 2 32 V16 A14 14 0 0 1 16 2 Z'
// Um visto — rotina cumprida é o que o produto acompanha.
const CHECK = 'M15 24.5 l6.5 6.5 L33 17'

/**
 * Marca do produto. **Provisória**: é um sinal geométrico com a forma e as cores certas,
 * para a tela não ficar órfã de marca enquanto a definitiva não existe. A gêmea em
 * `apps/mobile/src/brand-logo.tsx` desenha exatamente esta geometria — as duas mudam
 * juntas.
 *
 * Não é componente compartilhado entre plataformas de propósito: a consistência vem dos
 * tokens de cor e do raio, não de um componente que precisaria conhecer as duas.
 */
export function BrandLogo(): ReactElement {
  return (
    <svg
      width={LOGO_SIZE}
      height={LOGO_SIZE}
      viewBox="0 0 48 48"
      // Decoração: quem usa leitor de tela já ouve o nome do produto no `h1` da rota.
      aria-hidden="true"
      focusable="false"
    >
      <path d={SQUARE} className="fill-primary" />
      <path
        d={CHECK}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className="stroke-on-primary"
      />
    </svg>
  )
}
