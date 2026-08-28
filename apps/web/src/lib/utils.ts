import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Composição mecânica de classes Tailwind (padrão shadcn); não decide estilo algum. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
