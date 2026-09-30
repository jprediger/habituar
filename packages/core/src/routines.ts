import { z } from 'zod'
import { routineBlockIdSchema } from './identity/ids.js'

/**
 * Tipos de bloco da rotina. Fechado de propósito: a grade usa o tipo para cor e ícone, e
 * texto livre aqui viraria uma categoria diferente por pessoa.
 */
export const ROUTINE_KINDS = ['class', 'study', 'therapy', 'activity', 'rest', 'other'] as const
export const routineKindSchema = z.enum(ROUTINE_KINDS)
export type RoutineKind = z.infer<typeof routineKindSchema>

/** Segunda é 1 e domingo é 7 (ISO 8601): a semana escolar começa na segunda. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const
export const weekdaySchema = z.literal(WEEKDAYS)
export type Weekday = z.infer<typeof weekdaySchema>

// Hora local do bloco, sem fuso: a rotina se repete toda semana no relógio de quem a vive.
const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM.')

export const ROUTINE_TITLE_MAX_LENGTH = 80
export const ROUTINE_NOTES_MAX_LENGTH = 500

const routineBlockFieldsSchema = z.object({
  weekday: weekdaySchema,
  startsAt: timeOfDaySchema,
  endsAt: timeOfDaySchema,
  title: z.string().trim().min(1).max(ROUTINE_TITLE_MAX_LENGTH),
  kind: routineKindSchema,
  notes: z.string().trim().min(1).max(ROUTINE_NOTES_MAX_LENGTH).nullable(),
}).strict()

// HH:MM com zeros à esquerda ordena como texto, então a comparação de horários é direta.
function endsAfterStart(block: Readonly<{ startsAt: string; endsAt: string }>): boolean {
  return block.endsAt > block.startsAt
}

/** Bloco que um profissional grava; fim antes do início é recusado aqui e no banco. */
export const routineBlockInputSchema = routineBlockFieldsSchema.refine(endsAfterStart, { message: 'Block must end after it starts.', path: ['endsAt'] })
export type RoutineBlockInput = Readonly<z.infer<typeof routineBlockInputSchema>>

export const routineBlockSchema = routineBlockFieldsSchema.extend({
  id: routineBlockIdSchema,
  version: z.int().min(1),
  updatedAt: z.iso.datetime(),
}).strict().readonly()
export type RoutineBlock = z.infer<typeof routineBlockSchema>

const WEEKDAY_BY_JS_DAY: readonly Weekday[] = [7, 1, 2, 3, 4, 5, 6]

/** Dia da semana de um instante no fuso de quem o lê, na numeração da rotina. */
export function weekdayOf(instant: Date): Weekday {
  // `getDay` conta domingo como 0; a rotina começa na segunda, como o ISO 8601.
  return WEEKDAY_BY_JS_DAY[instant.getDay()] ?? 1
}

export type RoutineDay = Readonly<{ weekday: Weekday; blocks: readonly RoutineBlock[] }>

/**
 * A semana inteira, de segunda a domingo, com os blocos de cada dia em ordem de início.
 * Dia sem bloco aparece vazio: a grade mostra a semana, não só os dias ocupados.
 */
export function groupRoutineByWeekday(blocks: readonly RoutineBlock[]): readonly RoutineDay[] {
  return WEEKDAYS.map((weekday) => ({
    weekday,
    blocks: blocks
      .filter((block) => block.weekday === weekday)
      .sort((first, second) => first.startsAt.localeCompare(second.startsAt) || first.endsAt.localeCompare(second.endsAt)),
  }))
}
