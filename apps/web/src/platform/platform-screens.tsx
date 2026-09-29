import { assertNever } from '@habituar/core/assert-never'
import type { InstitutionId } from '@habituar/core/identity/ids'
import { useInstitutionForm } from '@habituar/react-client/platform-forms'
import { MANAGEMENT_SECTIONS } from '@habituar/react-client/staff-management'
import type { ManagementSection, StaffManagementContext } from '@habituar/react-client/staff-management'
import type { InstitutionTextField } from '@habituar/react-client/platform-forms'
import { Link, useNavigate } from '@tanstack/react-router'
import { useId, useState } from 'react'
import type { KeyboardEvent, ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import { PageHeader } from '../components/ui/page-header.js'
import { InvitationsPanel } from '../management/invitations-panel.js'
import { RolesPanel } from '../management/roles-panel.js'
import { TeamPanel } from '../management/team-panel.js'

type DetailTab = 'data' | ManagementSection
const DETAIL_TABS: readonly DetailTab[] = ['data', ...MANAGEMENT_SECTIONS]
const INSTITUTION_TEXT_FIELDS: readonly InstitutionTextField[] = ['name', 'documentNumber', 'contactName', 'contactEmail', 'contactPhone']

/** Lista global que encaminha o administrador para cadastro e manutenção institucional. */
export function InstitutionListScreen(): ReactElement {
  const { t } = useTranslation()
  const { institutions, isLoading, error } = habituar.usePlatformInstitutions()
  return <div className="flex flex-col gap-xxl">
    <PageHeader eyebrow={t('home.admin-home.title')} title={t('platform.institutions.title')} description={t('platform.institutions.description')} />
    {/* O alcance vem antes da lista: o administrador precisa saber o que este ambiente não
        mostra antes de procurar dados de aluno que ele nunca vai alcançar. */}
    <aside aria-label={t('home.scopeLabel')} className="flex flex-col gap-xs rounded-field border border-hairline bg-surface px-lg py-md">
      <p className="text-caption font-medium uppercase tracking-widest text-text-muted">{t('home.scopeLabel')}</p>
      <p className="text-body text-text">{t('home.admin-home.scope')}</p>
    </aside>
    <nav><Button asChild><Link to="/admin/institutions/new">{t('platform.institutions.new')}</Link></Button></nav>
    {isLoading && <p role="status">{t('authentication.loading')}</p>}
    {error && <p role="alert">{t('platform.error')}</p>}
    {!isLoading && institutions.length === 0 && <p>{t('platform.institutions.empty')}</p>}
    <ul className="flex flex-col gap-md">{institutions.map((institution) => <li key={institution.id} className="rounded-control border border-hairline p-md"><Link className="underline" to="/admin/institutions/$institutionId" params={{ institutionId: institution.id }}>{institution.name}</Link></li>)}</ul>
  </div>
}

/** Formulário cadastral; criação e edição diferem só no que acontece depois de salvar. */
export function InstitutionFormScreen({ institutionId }: Readonly<{ institutionId?: InstitutionId }>): ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { create } = habituar.usePlatformInstitutions()
  const detail = habituar.usePlatformInstitution(institutionId)
  const form = useInstitutionForm({
    institution: detail.institution,
    save: async (input) => {
      if (institutionId !== undefined) { await detail.update(input); return }
      const id = await create(input)
      await navigate({ to: '/admin/institutions/$institutionId', params: { institutionId: id } })
    },
  })
  const errorId = useId()
  return <form className="flex flex-col gap-md" onSubmit={(event) => { event.preventDefault(); void form.submit() }} noValidate>
    {INSTITUTION_TEXT_FIELDS.map((key) => <label className="flex flex-col gap-xs" key={key}>
      <span>{t(`platform.institutions.${key}`)} <span aria-hidden="true" title={t('form.requiredMark')}>{'*'}</span></span>
      <input className="min-h-tap-target rounded-control border border-border bg-surface px-md" required name={key} type={key === 'contactEmail' ? 'email' : 'text'} value={form.values[key]} onChange={(event) => { form.change(key, event.target.value) }} aria-describedby={form.failure ? errorId : undefined} />
    </label>)}
    <label className="flex flex-col gap-xs"><span>{t('platform.institutions.documentType')} <span aria-hidden="true" title={t('form.requiredMark')}>{'*'}</span></span><select className="min-h-tap-target rounded-control border border-border bg-surface px-md" required value={form.values.documentType} onChange={(event) => { form.changeDocumentType(event.target.value) }}><option value="cnpj">{t('platform.institutions.cnpj')}</option><option value="cpf">{t('platform.institutions.cpf')}</option></select></label>
    {form.failure && <p role="alert" id={errorId}>{form.failure === 'invalid' ? t('platform.institutions.invalid') : t('platform.error')}</p>}
    <Button type="submit" disabled={form.isSaving}>{form.isSaving ? t('platform.saving') : t('platform.save')}</Button>
  </form>
}

/** Cadastro inicial isolado para que a criação tenha uma decisão principal. */
export function NewInstitutionScreen(): ReactElement {
  const { t } = useTranslation()
  return <div className="flex flex-col gap-xxl"><Link to="/admin/institutions" className="underline">{t('platform.back')}</Link><PageHeader eyebrow={t('platform.institutions.title')} title={t('platform.institutions.new')} description={t('platform.institutions.newDescription')} /><InstitutionFormScreen /></div>
}

/**
 * Uma instituição vista pela plataforma: cadastro e as mesmas seções de gestão da equipe
 * que a instituição usa, com contexto de plataforma. Nenhuma delas alcança dados de aluno.
 */
export function InstitutionDetailScreen({ institutionId }: Readonly<{ institutionId: InstitutionId }>): ReactElement {
  const { t } = useTranslation()
  const detail = habituar.usePlatformInstitution(institutionId)
  const context: StaffManagementContext = { kind: 'platform', institutionId }
  const [tab, setTab] = useState<DetailTab>('data')
  const tabsId = useId()
  const institutionName = detail.institution?.name ?? t('platform.institutions.detailLoading')
  // Padrão ARIA de abas: só a aba ativa entra na ordem de Tab; setas, Home e End movem
  // foco e seleção juntos, porque trocar de aba aqui não tem custo nem efeito colateral.
  function moveTab(event: KeyboardEvent<HTMLButtonElement>): void {
    const index = DETAIL_TABS.indexOf(tab)
    const targets: Readonly<Record<string, number>> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: DETAIL_TABS.length - 1 }
    const target = targets[event.key]
    if (target === undefined) return
    event.preventDefault()
    const next = DETAIL_TABS[(target + DETAIL_TABS.length) % DETAIL_TABS.length] ?? tab
    setTab(next)
    document.getElementById(`${tabsId}-${next}-tab`)?.focus()
  }
  return <div className="flex flex-col gap-xxl">
    <Link to="/admin/institutions" className="underline">{t('platform.back')}</Link>
    <PageHeader eyebrow={t('platform.institutions.title')} title={institutionName} description={t('platform.institutions.detailDescription')} />
    {detail.error && <p role="alert">{t('platform.error')}</p>}
    <div role="tablist" aria-label={t('platform.institutions.sections')} className="flex flex-wrap gap-sm">
      {DETAIL_TABS.map((key) => <Button key={key} id={`${tabsId}-${key}-tab`} role="tab" aria-selected={tab === key} aria-controls={`${tabsId}-panel`} tabIndex={tab === key ? 0 : -1} variant={tab === key ? 'default' : 'outline'} onClick={() => { setTab(key) }} onKeyDown={moveTab}>{getDetailTabLabel(key, t)}</Button>)}
    </div>
    <section role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${tab}-tab`} className="flex flex-col gap-lg">
      <DetailTabPanel tab={tab} institutionId={institutionId} context={context} institutionName={institutionName} />
    </section>
  </div>
}

function DetailTabPanel({ tab, institutionId, context, institutionName }: Readonly<{ tab: DetailTab; institutionId: InstitutionId; context: StaffManagementContext; institutionName: string }>): ReactElement {
  switch (tab) {
    case 'data':
      return <InstitutionFormScreen institutionId={institutionId} />
    case 'team':
      return <TeamPanel context={context} institutionName={institutionName} />
    case 'invitations':
      return <InvitationsPanel context={context} />
    case 'roles':
      return <RolesPanel context={context} />
    default:
      return assertNever(tab)
  }
}

function getDetailTabLabel(tab: DetailTab, t: ReturnType<typeof useTranslation>['t']): string {
  return tab === 'data' ? t('platform.institutions.data') : t(`staff.sections.${tab}`)
}
