import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Raio e tamanho de fonte do projeto têm nome de papel (`rounded-control`, `text-body`),
// não de escala. Sem declará-los, o tailwind-merge não reconhece o raio e mantém as duas
// classes num override, e lê `text-body` como cor, descartando-o diante de `text-text`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['control', 'field', 'surface', 'pill'],
      text: ['display', 'title', 'body', 'caption'],
    },
  },
})

/** Composição mecânica de classes Tailwind (padrão shadcn); não decide estilo algum. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
