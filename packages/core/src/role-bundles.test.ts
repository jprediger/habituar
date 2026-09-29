import { describe, expect, it } from 'vitest'
import { PERMISSION_CATALOG } from './permissions/permission-catalog.js'
import { ROLE_BUNDLE_CATALOG, ROLE_BUNDLE_KEYS, readBundlesFromGrants, resolveBundleGrants, roleBundleSelectionsSchema } from './role-bundles.js'

const MANAGEMENT_BUNDLES = ['team-read', 'team-invite', 'role-assign', 'member-remove', 'role-customize'] as const

describe('matriz de bundles', () => {
  it('cobre cada permissão do catálogo por exatamente um bundle', () => {
    const mapped = ROLE_BUNDLE_KEYS.flatMap(key => ROLE_BUNDLE_CATALOG[key].permissions)
    expect([...mapped].sort()).toEqual([...PERMISSION_CATALOG].sort())
  })

  it('não oferece nenhum bundle ao vínculo de aluno', () => {
    for (const key of ROLE_BUNDLE_KEYS) expect(ROLE_BUNDLE_CATALOG[key].scopesByEnvironment.student).toBeUndefined()
  })

  it('só admite gestão com alcance institucional, e só para profissional', () => {
    for (const key of MANAGEMENT_BUNDLES) {
      expect(ROLE_BUNDLE_CATALOG[key].scopesByEnvironment).toEqual({ professional: ['institution'] })
    }
  })

  it('dá ao monitor apenas a consulta de cadastro dos acompanhados', () => {
    const monitorBundles = ROLE_BUNDLE_KEYS.filter(key => ROLE_BUNDLE_CATALOG[key].scopesByEnvironment.monitor !== undefined)
    expect(monitorBundles).toEqual(['student-read'])
    expect(ROLE_BUNDLE_CATALOG['student-read'].scopesByEnvironment.monitor).toEqual(['assigned'])
  })

  it('nunca oferece o alcance próprio em papel personalizado', () => {
    for (const key of ROLE_BUNDLE_KEYS) {
      for (const scopes of Object.values(ROLE_BUNDLE_CATALOG[key].scopesByEnvironment)) expect(scopes).not.toContain('own')
    }
  })
})

describe('resolução de bundles em concessões', () => {
  it('traduz a seleção válida em concessões atômicas', () => {
    expect(resolveBundleGrants('professional', [{ bundle: 'student-read', scope: 'assigned' }, { bundle: 'team-read', scope: 'institution' }]))
      .toEqual({ status: 'valid', grants: [{ key: 'student.read', scope: 'assigned' }, { key: 'membership.read', scope: 'institution' }] })
  })

  it.each([
    ['gestão para monitor', 'monitor', [{ bundle: 'team-invite', scope: 'institution' }]],
    ['consulta institucional para monitor', 'monitor', [{ bundle: 'student-read', scope: 'institution' }]],
    ['gestão com alcance de acompanhados', 'professional', [{ bundle: 'role-assign', scope: 'assigned' }]],
    ['alcance próprio para profissional', 'professional', [{ bundle: 'student-read', scope: 'own' }]],
    ['qualquer bundle para aluno', 'student', [{ bundle: 'student-read', scope: 'own' }]],
    ['combinação vazia', 'professional', []],
    ['bundle repetido', 'professional', [{ bundle: 'student-read', scope: 'assigned' }, { bundle: 'student-read', scope: 'institution' }]],
  ] as const)('recusa %s inteira, sem aproveitar parte', (_label, environment, selections) => {
    expect(resolveBundleGrants(environment, selections)).toEqual({ status: 'invalid' })
  })

  it('recusa bundle desconhecido e repetido já na borda', () => {
    expect(roleBundleSelectionsSchema.safeParse([{ bundle: 'clinical-read', scope: 'institution' }]).success).toBe(false)
    expect(roleBundleSelectionsSchema.safeParse([{ bundle: 'team-read', scope: 'institution' }, { bundle: 'team-read', scope: 'institution' }]).success).toBe(false)
    expect(roleBundleSelectionsSchema.safeParse([]).success).toBe(false)
  })
})

describe('leitura de concessões como bundles', () => {
  it('volta à mesma seleção que as produziu', () => {
    const selections = [{ bundle: 'team-read', scope: 'institution' }, { bundle: 'guardian-link', scope: 'assigned' }] as const
    const resolved = resolveBundleGrants('professional', selections)
    if (resolved.status !== 'valid') throw new Error('expected valid selection')
    expect(readBundlesFromGrants('professional', resolved.grants)).toEqual({ status: 'representable', bundles: selections })
  })

  it('não inventa bundle para concessão fora da matriz', () => {
    expect(readBundlesFromGrants('student', [{ key: 'student.read', scope: 'own' }])).toEqual({ status: 'not-representable' })
    expect(readBundlesFromGrants('professional', [{ key: 'student.read', scope: 'assigned' }, { key: 'student.read', scope: 'institution' }])).toEqual({ status: 'not-representable' })
  })
})
