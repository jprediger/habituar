import { MembershipEnvironment } from '@habituar/core/roles'

type RoleWithEnvironment = Readonly<{
  id: string
  institutionId: string
  environment: MembershipEnvironment
}>

type ClonedRoleValues = Readonly<{
  institutionId: string
  name: string
  isSystem: false
  clonedFrom: string
  environment: MembershipEnvironment
  templateKey: null
}>

type RenamedRoleValues = Readonly<{
  name: string
  environment: MembershipEnvironment
}>

/** Monta os campos de uma cópia sem permitir que o nome redefina o ambiente estrutural. */
export function buildClonedRoleValues(
  template: RoleWithEnvironment,
  name: string,
): ClonedRoleValues {
  return {
    institutionId: template.institutionId,
    name,
    isSystem: false,
    clonedFrom: template.id,
    environment: template.environment,
    templateKey: null,
  }
}

/** Monta uma alteração de nome sem substituir o ambiente persistido do papel. */
export function buildRenamedRoleValues(
  role: Pick<RoleWithEnvironment, 'environment'>,
  name: string,
): RenamedRoleValues {
  return { name, environment: role.environment }
}
