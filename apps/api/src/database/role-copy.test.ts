import { roleEnvironmentSchema } from '@habituar/core/roles'
import { describe, expect, it } from 'vitest'
import { buildClonedRoleValues, buildRenamedRoleValues } from './role-copy.js'

const template = {
  id: '94000000-0000-4000-8000-000000000009',
  institutionId: '95000000-0000-4000-8000-000000000009',
  environment: roleEnvironmentSchema.parse('professional'),
}

describe('cópia de papel', () => {
  it('preserva o ambiente do papel-fonte ao clonar com outro nome', () => {
    expect(buildClonedRoleValues(template, 'Equipe de acompanhamento')).toEqual({
      institutionId: template.institutionId,
      name: 'Equipe de acompanhamento',
      isSystem: false,
      clonedFrom: template.id,
      environment: 'professional',
    })
  })

  it('preserva o ambiente ao renomear um papel', () => {
    expect(buildRenamedRoleValues(template, 'Acompanhamento')).toEqual({
      name: 'Acompanhamento',
      environment: 'professional',
    })
  })
})
