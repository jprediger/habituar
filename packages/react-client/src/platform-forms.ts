/**
 * Entrypoint das telas de administração da plataforma: dono do rascunho, do envio e de
 * qual falha mostrar no cadastro institucional, no convite e na revogação. Não conhece
 * navegação nem visual; cada plataforma recebe estado e ações prontos.
 */
import type { InvitationId, RoleId } from '@habituar/core/identity/ids'
import { institutionInputSchema } from '@habituar/core/platform'
import type { Institution, InstitutionInput, PlatformRole } from '@habituar/core/platform'
import { membershipEnvironmentSchema } from '@habituar/core/roles'
import type { MembershipEnvironment } from '@habituar/core/roles'
import { useState } from 'react'

export type InstitutionTextField = Exclude<keyof InstitutionInput, 'documentType'>
type InstitutionDraft = Readonly<Record<InstitutionTextField, string> & { documentType: InstitutionInput['documentType'] }>

const EMPTY_INSTITUTION: InstitutionDraft = { name: '', documentType: 'cnpj', documentNumber: '', contactName: '', contactEmail: '', contactPhone: '' }

function toDraft(institution: Institution): InstitutionDraft {
  return {
    name: institution.name,
    documentType: institution.documentType ?? 'cnpj',
    documentNumber: institution.documentNumber ?? '',
    contactName: institution.contactName ?? '',
    contactEmail: institution.contactEmail ?? '',
    contactPhone: institution.contactPhone ?? '',
  }
}

export type PlatformFormFailure = 'invalid' | 'server'

export type InstitutionForm = Readonly<{
  values: InstitutionDraft
  change: (field: InstitutionTextField, value: string) => void
  changeDocumentType: (value: string) => void
  submit: () => Promise<void>
  isSaving: boolean
  failure: PlatformFormFailure | undefined
}>

/**
 * Cadastro institucional validado pelo schema do contrato antes do envio. Enquanto a
 * pessoa não edita, o formulário espelha o cadastro salvo em vez de copiá-lo para estado.
 */
export function useInstitutionForm(
  options: Readonly<{ institution: Institution | undefined; save: (input: InstitutionInput) => Promise<void> }>,
): InstitutionForm {
  const [draft, setDraft] = useState<InstitutionDraft | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)
  const [failure, setFailure] = useState<PlatformFormFailure | undefined>(undefined)
  const values = draft ?? (options.institution === undefined ? EMPTY_INSTITUTION : toDraft(options.institution))

  return {
    values,
    change: (field, value) => { setDraft({ ...values, [field]: value }) },
    changeDocumentType: (value) => {
      if (value === 'cpf' || value === 'cnpj') setDraft({ ...values, documentType: value })
    },
    submit: async () => {
      const parsed = institutionInputSchema.safeParse(values)
      if (!parsed.success) { setFailure('invalid'); return }
      setIsSaving(true)
      setFailure(undefined)
      try {
        await options.save(parsed.data)
      } catch {
        setFailure('server')
      } finally {
        setIsSaving(false)
      }
    },
    isSaving,
    failure,
  }
}

export type InvitationFormFailure = 'choose-role' | 'server'

export type InvitationForm = Readonly<{
  email: string
  setEmail: (value: string) => void
  environment: MembershipEnvironment
  setEnvironment: (value: string) => void
  availableRoles: readonly PlatformRole[]
  isRoleSelected: (roleId: RoleId) => boolean
  setRoleSelected: (roleId: RoleId, isSelected: boolean) => void
  submit: () => Promise<void>
  isBusy: boolean
  failure: InvitationFormFailure | undefined
  inviteUrl: string | undefined
}>

type InviteInput = Readonly<{ email: string; environment: MembershipEnvironment; roleIds: readonly RoleId[] }>

/**
 * Convite com tipo de vínculo e papéis. Papel só é oferecido para o tipo escolhido, e
 * trocar o tipo descarta a seleção: um papel de outro ambiente seria recusado pela API.
 */
export function useInvitationForm(
  options: Readonly<{ roles: readonly PlatformRole[]; invite: (input: InviteInput) => Promise<string> }>,
): InvitationForm {
  const [email, setEmail] = useState('')
  const [environment, setEnvironmentState] = useState<MembershipEnvironment>('professional')
  const [roleIds, setRoleIds] = useState<readonly RoleId[]>([])
  const [inviteUrl, setInviteUrl] = useState<string | undefined>(undefined)
  const [failure, setFailure] = useState<InvitationFormFailure | undefined>(undefined)
  const [isBusy, setIsBusy] = useState(false)
  const availableRoles = options.roles.filter((role) => role.environment === environment)

  return {
    email,
    setEmail,
    environment,
    setEnvironment: (value) => {
      const parsed = membershipEnvironmentSchema.safeParse(value)
      if (!parsed.success) return
      setEnvironmentState(parsed.data)
      setRoleIds([])
    },
    availableRoles,
    isRoleSelected: (roleId) => roleIds.includes(roleId),
    setRoleSelected: (roleId, isSelected) => {
      setRoleIds(isSelected ? [...roleIds, roleId] : roleIds.filter((id) => id !== roleId))
    },
    submit: async () => {
      if (roleIds.length === 0) { setFailure('choose-role'); return }
      setIsBusy(true)
      setFailure(undefined)
      try {
        setInviteUrl(await options.invite({ email, environment, roleIds }))
        setEmail('')
        setRoleIds([])
      } catch {
        setFailure('server')
      } finally {
        setIsBusy(false)
      }
    },
    isBusy,
    failure,
    inviteUrl,
  }
}

export type InvitationRevocation = Readonly<{
  pendingInvitationId: InvitationId | undefined
  request: (invitationId: InvitationId) => void
  cancel: () => void
  confirm: () => Promise<void>
  failure: 'server' | undefined
}>

/** Revogação em dois passos: o link deixa de funcionar, então a confirmação é explícita. */
export function useInvitationRevocation(
  options: Readonly<{ revoke: (invitationId: InvitationId) => Promise<void> }>,
): InvitationRevocation {
  const [pendingInvitationId, setPendingInvitationId] = useState<InvitationId | undefined>(undefined)
  const [failure, setFailure] = useState<'server' | undefined>(undefined)

  return {
    pendingInvitationId,
    request: (invitationId) => { setFailure(undefined); setPendingInvitationId(invitationId) },
    cancel: () => { setPendingInvitationId(undefined) },
    confirm: async () => {
      if (pendingInvitationId === undefined) return
      try {
        await options.revoke(pendingInvitationId)
        setPendingInvitationId(undefined)
      } catch {
        setFailure('server')
      }
    },
    failure,
  }
}
