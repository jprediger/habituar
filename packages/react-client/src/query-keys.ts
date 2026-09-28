import type { InstitutionId } from '@habituar/core/identity/ids'

/**
 * Única fonte das chaves de query do cliente. Todo dado de tenant mora sob
 * `INSTITUTION_SCOPE`, porque é esse prefixo que a troca de instituição apaga: chave de
 * tenant fora dele sobreviveria à troca e mostraria dado da instituição anterior.
 */
export const queryKeys = {
  institutionScope: ['institution'],
  platformInstitutions: ['platform', 'institutions'],
  platformInstitution: (institutionId: InstitutionId) => ['platform', 'institution', institutionId],
  invitationScope: ['invitation'],
  invitation: (token: string) => ['invitation', token],
} as const
