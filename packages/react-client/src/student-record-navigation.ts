import type { EffectivePermission } from '@habituar/core/auth/context'

const STUDENT_RECORD_SECTIONS = ['registration', 'profile', 'agenda', 'consultations', 'history', 'management'] as const

/** Catálogo fechado das partes da ficha; cada cliente decide só como apresentá-las. */
export type StudentRecordSection = typeof STUDENT_RECORD_SECTIONS[number]

/** Lista de onde a ficha foi aberta, e portanto para onde o voltar leva. */
export type StudentRecordOrigin = 'home' | 'management'

/** Dica de interface sobre o que a ficha oferece; não substitui a verificação da API. */
export type StudentRecordCapabilities = Readonly<{
  canReadRecord: boolean
  canManageAssignments: boolean
  canEditAssignments: boolean
  canArchive: boolean
  canInvite: boolean
  canUnlinkGuardian: boolean
  canManage: boolean
}>

/** Único ponto que traduz concessões em capacidades da ficha; a API continua verificando o alcance por estudante. */
export function getStudentRecordCapabilities(permissions: readonly EffectivePermission[]): StudentRecordCapabilities {
  const canReadRecord = permissions.some((grant) => grant.key === 'record.read')
  const canManageAssignments = permissions.some((grant) => grant.key === 'assignment.manage' && grant.scope === 'institution')
    && permissions.some((grant) => grant.key === 'membership.read' && grant.scope === 'institution')
  // O editor de vínculos do web aceita qualquer alcance: a API recorta o que cada um pode alterar.
  const canEditAssignments = permissions.some((grant) => grant.key === 'assignment.manage')
    && permissions.some((grant) => grant.key === 'membership.read')
  const canArchive = permissions.some((grant) => grant.key === 'student.update' && grant.scope === 'institution')
  const canInvite = permissions.some((grant) => grant.key === 'guardian.link')
  const canUnlinkGuardian = permissions.some((grant) => grant.key === 'guardian.unlink')
  return { canReadRecord, canManageAssignments, canEditAssignments, canArchive, canInvite, canUnlinkGuardian, canManage: canManageAssignments || canArchive || canInvite }
}

/** Mesma organização nos dois clientes, inclusive para quem só pode consultar o cadastro. */
export function listStudentRecordSections(permissions: readonly EffectivePermission[]): readonly StudentRecordSection[] {
  const capabilities = getStudentRecordCapabilities(permissions)
  return [
    'registration',
    ...(capabilities.canReadRecord ? ['profile', 'agenda', 'consultations', 'history'] as const : []),
    ...(capabilities.canManage ? ['management'] as const : []),
  ]
}

/** Parâmetros de navegação aceitos na ficha; valores desconhecidos voltam à entrada. */
export function parseStudentRecordSearch(search: Record<string, unknown>): Readonly<{ from?: 'management'; section?: StudentRecordSection }> {
  const section = STUDENT_RECORD_SECTIONS.find((candidate) => candidate === search.section)
  return { ...(search.from === 'management' ? { from: 'management' as const } : {}), ...(section === undefined ? {} : { section }) }
}

/** Dono da navegação da ficha comum aos clientes: origem do voltar, seções visíveis e seção aberta, recusando a que as concessões não oferecem. */
export function resolveStudentRecordNavigation(permissions: readonly EffectivePermission[], search: Record<string, unknown>): Readonly<{
  origin: StudentRecordOrigin
  sections: readonly StudentRecordSection[]
  section: StudentRecordSection | undefined
}> {
  const parsed = parseStudentRecordSearch(search)
  const sections = listStudentRecordSections(permissions)
  const section = parsed.section !== undefined && sections.includes(parsed.section) ? parsed.section : undefined
  return { origin: parsed.from === 'management' ? 'management' : 'home', sections, section }
}
