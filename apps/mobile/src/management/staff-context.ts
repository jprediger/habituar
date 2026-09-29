import type { StaffManagementContext } from '@habituar/react-client/staff-management'
import type { InstitutionSession } from '../session/session-screen'

/** Contexto de gestão da sessão institucional aprovada: a instituição e as concessões atuais. */
export function toStaffContext(session: InstitutionSession): StaffManagementContext {
  return { kind: 'institution', institutionId: session.membership.institution.id, permissions: session.membership.permissions }
}
