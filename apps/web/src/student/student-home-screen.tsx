import { assertNever } from '@habituar/core/assert-never'
import type { StudentSummary } from '@habituar/core/students'
import type { GuardianConsents } from '@habituar/react-client/react-client'
import { listStudentHomeSections } from '@habituar/react-client/react-client'
import { FileCheck2, UserRound } from 'lucide-react'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import { EmptyState } from '../components/ui/empty-state.js'
import { PageHeader } from '../components/ui/page-header.js'
import { Section } from '../components/ui/section.js'
import { SummaryCards } from '../components/ui/summary-cards.js'
import { useInstitutionSession } from '../session/institution-session.js'

/**
 * Tela inicial do ambiente de aluno: a única superfície escrita na primeira pessoa. Mostra
 * ao aluno o próprio cadastro e ao responsável os consentimentos que confirma ou revoga.
 */
export function StudentHomeScreen(): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()
  const sections = listStudentHomeSections(session.membership)

  return (
    <div className="flex flex-col gap-xxl">
      <PageHeader
        eyebrow={t('navigation.home')}
        title={t('home.student-home.title')}
        description={t('home.student-home.description')}
      />

      <Section title={t('home.membershipTitle')}>
        <SummaryCards
          items={[
            { label: t('home.institutionLabel'), value: session.membership.institution.name },
            { label: t('home.roleLabel'), value: session.membership.roles.map((role) => role.templateKey === null ? role.name : t(`roles.${role.templateKey}`)).join(', ') },
          ]}
        />
      </Section>

      {sections.showsOwnRecord && <OwnRecordSection isGuardianToo={sections.isGuardianToo} />}
      {sections.showsGuardianConsents && <GuardianConsentSections />}
    </div>
  )
}

function OwnRecordSection({ isGuardianToo }: Readonly<{ isGuardianToo: boolean }>): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()
  const { state } = habituar.useAccessibleStudents(session.membership)
  // Quem também é responsável recebe junto os cadastros dos filhos: o título não pode dizer "seu".
  const title = t(isGuardianToo ? 'studentHome.self.combinedTitle' : 'studentHome.self.title')

  return (
    <Section title={title} description={t('studentHome.self.description')}>
      {(() => {
        switch (state.status) {
          case 'loading':
            return <p role="status" className="text-body text-text-muted">{t('studentHome.self.loading')}</p>
          case 'failed':
            return <p role="alert" className="text-body text-danger">{t('studentHome.self.failed')}</p>
          case 'ready':
            if (state.students.length === 0) {
              return <EmptyState icon={UserRound} title={t('studentHome.self.emptyTitle')} description={t('studentHome.self.emptyDescription')} />
            }
            return (
              <ul className="flex flex-col gap-sm">
                {state.students.map((student) => (
                  <li key={student.id} className="flex flex-col gap-xs rounded-field border border-hairline bg-surface px-lg py-md">
                    <p className="text-body font-medium text-text">{displayName(student)}</p>
                    <p className="text-caption text-text-muted">{t('studentHome.self.birthDateValue', { date: formatCalendarDate(student.birthDate) })}</p>
                  </li>
                ))}
              </ul>
            )
          default:
            return assertNever(state)
        }
      })()}
    </Section>
  )
}

// Ação pendente de confirmação: só uma por vez, e a frase nomeia o estudante afetado.
type PendingAction = Readonly<{ kind: 'confirm'; student: StudentSummary }> | Readonly<{ kind: 'revoke'; student: StudentSummary; consentId: Parameters<GuardianConsents['revoke']>[1] }>

// Resultado da última ação, anunciado junto das listas; erro fica junto da ação que falhou.
type ActionFeedback = Readonly<{ status: 'done'; message: string }> | Readonly<{ status: 'failed' }> | undefined

function GuardianConsentSections(): ReactElement {
  const { t } = useTranslation()
  const consents = habituar.useGuardianConsents()
  const [pendingAction, setPendingAction] = useState<PendingAction | undefined>(undefined)
  const [isSending, setIsSending] = useState(false)
  const [feedback, setFeedback] = useState<ActionFeedback>(undefined)

  async function send(action: PendingAction): Promise<void> {
    setIsSending(true)
    const outcome = action.kind === 'confirm'
      ? await consents.confirm(action.student.id)
      : await consents.revoke(action.student.id, action.consentId)
    setIsSending(false)
    setPendingAction(undefined)
    setFeedback(outcome === 'saved'
      ? { status: 'done', message: t(action.kind === 'confirm' ? 'studentHome.consent.confirmed' : 'studentHome.consent.revoked', { name: displayName(action.student) }) }
      : { status: 'failed' })
  }

  const confirmation = pendingAction === undefined ? undefined : (
    <div role="group" aria-label={t(pendingAction.kind === 'confirm' ? 'studentHome.consent.confirmTitle' : 'studentHome.consent.revokeTitle')} className="flex flex-col gap-sm rounded-field border border-border bg-surface px-lg py-md">
      <p className="text-body text-text">
        {t(pendingAction.kind === 'confirm' ? 'studentHome.consent.confirmQuestion' : 'studentHome.consent.revokeQuestion', { name: displayName(pendingAction.student) })}
      </p>
      <div className="flex flex-wrap gap-sm">
        <Button type="button" variant={pendingAction.kind === 'revoke' ? 'destructive' : 'default'} disabled={isSending} onClick={() => { void send(pendingAction) }}>
          {isSending ? t('studentHome.consent.saving') : t(pendingAction.kind === 'confirm' ? 'studentHome.consent.confirmYes' : 'studentHome.consent.revokeYes')}
        </Button>
        <Button type="button" variant="outline" disabled={isSending} onClick={() => { setPendingAction(undefined) }}>{t('studentHome.consent.cancel')}</Button>
      </div>
    </div>
  )

  return (
    <>
      <Section title={t('studentHome.consent.pendingTitle')} description={t('studentHome.consent.pendingDescription')}>
        {(() => {
          switch (consents.pending.status) {
            case 'loading':
              return <p role="status" className="text-body text-text-muted">{t('studentHome.consent.loading')}</p>
            case 'failed':
              return <p role="alert" className="text-body text-danger">{t('studentHome.consent.loadFailed')}</p>
            case 'ready':
              if (consents.pending.consents.length === 0) return null
              return (
                <ul className="flex flex-col gap-sm">
                  {consents.pending.consents.map(({ student, termVersion }) => (
                    <li key={student.id} className="flex flex-col gap-sm rounded-field border border-hairline bg-surface px-lg py-md">
                      <p className="text-body font-medium text-text">{displayName(student)}</p>
                      {/* Resumo provisório: o sistema guarda só a versão do termo, e o texto oficial depende de revisão jurídica. */}
                      <p className="text-body text-text">{t('studentHome.consent.termSummary', { name: displayName(student) })}</p>
                      <p className="text-caption text-text-muted">{t('studentHome.consent.termMeta', { version: termVersion })}</p>
                      {pendingAction?.student.id === student.id
                        ? confirmation
                        : <div><Button type="button" onClick={() => { setFeedback(undefined); setPendingAction({ kind: 'confirm', student }) }}>{t('studentHome.consent.confirm')}</Button></div>}
                    </li>
                  ))}
                </ul>
              )
            default:
              return assertNever(consents.pending)
          }
        })()}
      </Section>

      <Section title={t('studentHome.consent.confirmedTitle')} description={t('studentHome.consent.confirmedDescription')}>
        {(() => {
          switch (consents.confirmed.status) {
            case 'loading':
              return <p role="status" className="text-body text-text-muted">{t('studentHome.consent.loading')}</p>
            case 'failed':
              return <p role="alert" className="text-body text-danger">{t('studentHome.consent.loadFailed')}</p>
            case 'ready':
              if (consents.confirmed.consents.length === 0) {
                return <EmptyState icon={FileCheck2} title={t('studentHome.consent.noneTitle')} description={t('studentHome.consent.noneDescription')} />
              }
              return (
                <ul className="flex flex-col gap-sm">
                  {consents.confirmed.consents.map(({ student, consent }) => (
                    <li key={consent.id} className="flex flex-col gap-sm rounded-field border border-hairline bg-surface px-lg py-md">
                      <p className="text-body font-medium text-text">{displayName(student)}</p>
                      <p className="text-caption text-text-muted">{t('studentHome.consent.confirmedOn', { date: formatDateTime(consent.recordedAt) })}</p>
                      {pendingAction?.kind === 'revoke' && pendingAction.consentId === consent.id
                        ? confirmation
                        : <div><Button type="button" variant="outline" onClick={() => { setFeedback(undefined); setPendingAction({ kind: 'revoke', student, consentId: consent.id }) }}>{t('studentHome.consent.revoke')}</Button></div>}
                    </li>
                  ))}
                </ul>
              )
            default:
              return assertNever(consents.confirmed)
          }
        })()}
      </Section>

      {feedback?.status === 'done' && <p role="status" className="text-body text-text">{feedback.message}</p>}
      {feedback?.status === 'failed' && <p role="alert" className="text-body text-danger">{t('studentHome.consent.failed')}</p>}
    </>
  )
}

// Nome social, quando existe, é como a pessoa é chamada.
function displayName(student: StudentSummary): string {
  return student.socialName ?? student.fullName
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Instante gravado pela API (UTC), mostrado no fuso de quem lê.
function formatDateTime(iso: string): string {
  return DATE_TIME_FORMAT.format(new Date(iso))
}

// Data de calendário sem fuso: passar por `Date` a deslocaria um dia a oeste de UTC.
function formatCalendarDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`
}
