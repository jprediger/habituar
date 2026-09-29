/**
 * Entrypoint do cadastro institucional da plataforma: dono do rascunho, do envio e de qual
 * falha mostrar. Equipe, convites e papéis da instituição usam os hooks de gestão
 * (`staff-management`), os mesmos da área institucional. Não conhece navegação nem visual.
 */
import { institutionInputSchema } from '@habituar/core/platform'
import type { Institution, InstitutionInput } from '@habituar/core/platform'
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
