import type { InstitutionId } from '@habituar/core/identity/ids'
import { useInstitutionForm, useInvitationForm, useInvitationRevocation } from '@habituar/react-client/platform-forms'
import type { InstitutionTextField } from '@habituar/react-client/platform-forms'
import { Link, useNavigate } from '@tanstack/react-router'
import { useId, useState } from 'react'
import type { KeyboardEvent, ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import { PageHeader } from '../components/ui/page-header.js'

type DetailTab = 'data' | 'people'
const DETAIL_TABS: readonly DetailTab[] = ['data', 'people']
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

/** Apresenta cadastro, membros e convites de uma única instituição ao administrador. */
export function InstitutionDetailScreen({ institutionId }: Readonly<{ institutionId: InstitutionId }>): ReactElement {
  const { t } = useTranslation()
  const detail = habituar.usePlatformInstitution(institutionId)
  const invitation = useInvitationForm({ roles: detail.roles, invite: detail.invite })
  const revocation = useInvitationRevocation({ revoke: detail.revoke })
  const [tab, setTab] = useState<DetailTab>('data')
  const tabsId = useId()
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
    <PageHeader eyebrow={t('platform.institutions.title')} title={detail.institution?.name ?? t('platform.institutions.detailLoading')} description={t('platform.institutions.detailDescription')} />
    {detail.error && <p role="alert">{t('platform.error')}</p>}
    <div role="tablist" aria-label={t('platform.institutions.sections')} className="flex gap-sm">
      {DETAIL_TABS.map((key) => <Button key={key} id={`${tabsId}-${key}-tab`} role="tab" aria-selected={tab === key} aria-controls={`${tabsId}-panel`} tabIndex={tab === key ? 0 : -1} variant={tab === key ? 'default' : 'outline'} onClick={() => { setTab(key) }} onKeyDown={moveTab}>{t(`platform.institutions.${key}`)}</Button>)}
    </div>
    {tab === 'data' ? <section role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-data-tab`}><InstitutionFormScreen institutionId={institutionId} /></section> : <section role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-people-tab`} className="flex flex-col gap-lg">
      <h2 className="text-title">{t('platform.members.title')}</h2>
      {detail.members.length === 0 && <p>{t('platform.members.empty')}</p>}
      <ul>{detail.members.map((member) => <li key={member.id}>{member.user.name}{' · '}{member.user.email}{' · '}{member.roles.map((role) => role.templateKey === null ? role.name : t(`roles.${role.templateKey}`)).join(', ')}</li>)}</ul>
      <h2 className="text-title">{t('platform.invitations.title')}</h2>
      {revocation.failure && <p role="alert">{t('platform.error')}</p>}
      <ul className="flex flex-col gap-sm">{detail.invitations.map((entry) => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-sm rounded-control border border-hairline p-md">
        <span>{entry.email}{' · '}{t(`platform.invitations.status.${entry.state.status}`)}</span>
        {entry.state.status === 'pending' && (revocation.pendingInvitationId === entry.id
          ? <span role="group" aria-label={t('platform.invitations.revokeConfirmation')} className="flex flex-wrap items-center gap-sm">
              <span>{t('platform.invitations.revokeConfirmation')}</span>
              <Button variant="destructive" onClick={() => { void revocation.confirm() }}>{t('platform.invitations.confirmRevoke')}</Button>
              <Button variant="outline" onClick={revocation.cancel}>{t('platform.invitations.cancelRevoke')}</Button>
            </span>
          : <Button variant="destructive" onClick={() => { revocation.request(entry.id) }}>{t('platform.invitations.revoke')}</Button>)}
      </li>)}</ul>
      <form className="flex flex-col gap-md" onSubmit={(event) => { event.preventDefault(); void invitation.submit() }}>
        <h3 className="text-body font-medium">{t('platform.invitations.new')}</h3>
        <label className="flex flex-col gap-xs"><span>{t('platform.invitations.email')} <span aria-hidden="true" title={t('form.requiredMark')}>{'*'}</span></span><input className="min-h-tap-target rounded-control border border-border bg-surface px-md" required type="email" value={invitation.email} onChange={(event) => { invitation.setEmail(event.target.value) }} /></label>
        <label className="flex flex-col gap-xs"><span>{t('platform.invitations.environment')} <span aria-hidden="true" title={t('form.requiredMark')}>{'*'}</span></span><select className="min-h-tap-target rounded-control border border-border bg-surface px-md" required value={invitation.environment} onChange={(event) => { invitation.setEnvironment(event.target.value) }}><option value="professional">{t('platform.environments.professional')}</option><option value="monitor">{t('platform.environments.monitor')}</option><option value="student">{t('platform.environments.student')}</option></select></label>
        <fieldset className="flex flex-col gap-sm"><legend>{t('platform.invitations.roles')}</legend>{invitation.availableRoles.map((role) => <label key={role.id} className="flex min-h-tap-target items-center gap-sm"><input type="checkbox" checked={invitation.isRoleSelected(role.id)} onChange={(event) => { invitation.setRoleSelected(role.id, event.target.checked) }} /><span className="flex flex-col"><span>{role.templateKey === null ? role.name : t(`roles.${role.templateKey}`)}</span>{role.templateKey !== null && <span className="text-caption text-text-muted">{t(`roleDescriptions.${role.templateKey}`)}</span>}</span></label>)}</fieldset>
        {invitation.failure && <p role="alert">{invitation.failure === 'choose-role' ? t('platform.invitations.chooseRole') : t('platform.error')}</p>}
        <Button type="submit" disabled={invitation.isBusy}>{t('platform.invitations.create')}</Button>
      </form>
      {invitation.inviteUrl && <div role="status" className="flex flex-col gap-sm rounded-control border border-border p-md"><p>{t('platform.invitations.oneTimeWarning')}</p><a className="break-all underline" href={invitation.inviteUrl}>{invitation.inviteUrl}</a><Button type="button" variant="outline" onClick={() => { if (invitation.inviteUrl !== undefined) void navigator.clipboard.writeText(invitation.inviteUrl) }}>{t('platform.invitations.copy')}</Button></div>}
    </section>}
  </div>
}
