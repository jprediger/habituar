import type { InstitutionId } from '@habituar/core/identity/ids'

/**
 * Única fonte das chaves de query do cliente. Todo dado de tenant mora sob
 * `INSTITUTION_SCOPE`, porque é esse prefixo que a troca de instituição apaga: chave de
 * tenant fora dele sobreviveria à troca e mostraria dado da instituição anterior. A
 * plataforma tem namespace próprio, sempre com a instituição explícita na chave.
 */
export const queryKeys = {
  institutionScope: ['institution'],
  institutionStaff: (institutionId: InstitutionId) => ['institution', institutionId, 'staff'],
  platformInstitutions: ['platform', 'institutions'],
  platformInstitution: (institutionId: InstitutionId) => ['platform', 'institution', institutionId],
  platformInstitutionStaff: (institutionId: InstitutionId) => ['platform', 'institution', institutionId, 'staff'],
  invitationScope: ['invitation'],
  invitation: (token: string) => ['invitation', token],
} as const
