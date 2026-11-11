import { assertNever } from '@habituar/core/assert-never'
import type { CalendarEntryType } from '@habituar/react-client/react-client'
import type { ThemeTokens } from '../theme/tokens'

/** Cor de um item da agenda pela origem; o texto sobre ela é sempre `onEvent`. */
export function entryColor(type: CalendarEntryType, colors: ThemeTokens['colors']): string {
  switch (type) {
    case 'student-task': return colors.eventStudentTask
    case 'staff-task': return colors.eventStaffTask
    case 'consultation': return colors.eventConsultation
    default: return assertNever(type)
  }
}
