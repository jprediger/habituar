import type { Weekday } from '@habituar/core/routines'

/**
 * expo-notifications usa domingo=1..sábado=7 (convenção herdada do calendário nativo);
 * a rotina usa ISO 8601 (segunda=1..domingo=7), portanto é necessário utilizar esse mapeamento.
 */
export function isoWeekdayToExpoWeekday(isoWeekday: Weekday): number {
  return isoWeekday === 7 ? 1 : isoWeekday + 1
}

/** Dia anterior na numeração ISO, com volta de segunda para domingo. */
export function previousIsoWeekday(isoWeekday: Weekday): Weekday {
  return (isoWeekday === 1 ? 7 : isoWeekday - 1) as Weekday
}