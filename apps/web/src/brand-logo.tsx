import type { ReactElement } from 'react'

const WIDTH = 120
const HEIGHT = 56
// Quadro tracejado: o traço interrompido é a convenção de "espaço reservado", e diz que
// isto sai sem precisar de legenda. A gêmea em `apps/mobile/src/brand-logo.tsx` desenha a
// mesma geometria — as duas mudam juntas.
// Meia espessura do traço, de recuo, para a borda não sair cortada pelo viewBox.
const INSET = 1
const STROKE_WIDTH = 2
const CORNER = 14
const DASH = '6 5'
const PLACEHOLDER_TEXT = 'LOGO'

/**
 * Espaço reservado da marca, **deliberadamente provisório**: moldura tracejada com a
 * palavra LOGO, para ninguém confundir com a marca definitiva nem esquecê-la aqui.
 *
 * Não é componente compartilhado entre plataformas de propósito: a consistência vem dos
 * tokens de cor e do raio, não de um componente que precisaria conhecer as duas.
 */
export function BrandLogo(): ReactElement {
  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
      // Decoração: quem usa leitor de tela já ouve o nome do produto no `h1` da rota.
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x={INSET}
        y={INSET}
        width={WIDTH - INSET * 2}
        height={HEIGHT - INSET * 2}
        rx={CORNER}
        fill="none"
        strokeWidth={STROKE_WIDTH}
        strokeDasharray={DASH}
        className="stroke-text-muted"
      />
      <text
        x={WIDTH / 2}
        y={HEIGHT / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="20"
        fontWeight="700"
        letterSpacing="3"
        className="fill-text-muted"
      >
        {PLACEHOLDER_TEXT}
      </text>
    </svg>
  )
}
