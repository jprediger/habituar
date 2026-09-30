import { assertNever } from '@habituar/core/assert-never'
import type { StudentSummary } from '@habituar/core/students'
import { SPACING } from '@habituar/design-tokens/spacing'
import type { GuardianConsents } from '@habituar/react-client/react-client'
import { listStudentHomeSections } from '@habituar/react-client/react-client'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { ConfirmationSheet } from '../components/ui/confirmation-sheet'
import { EmptyState } from '../components/ui/empty-state'
import { ListDivider } from '../components/ui/list-divider'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import { Text } from '../components/ui/text'
import { useToast } from '../components/ui/toast'
import { InstitutionSwitcher } from '../session/institution-switcher'
import type { InstitutionSession } from '../session/session-screen'
import { SignOutButton } from '../session/sign-out-button'

/**
 * Tela inicial do ambiente de aluno: a única superfície escrita na primeira pessoa. Mostra
 * ao aluno o próprio cadastro e ao responsável os consentimentos que confirma ou revoga.
 */
export function StudentHomeScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  const sections = listStudentHomeSections(session.membership)

  return (
    <Page>
      <PageHeader eyebrow={t('navigation.home')} title={t('home.student-home.title')} />
      <Text tone="muted">{t('home.student-home.description')}</Text>

      <ListSection title={t('home.membershipTitle')}>
        <ListRow title={t('home.institutionLabel')} value={session.membership.institution.name} />
        <ListRow
          title={t('home.roleLabel')}
          value={session.membership.roles.map((role) => role.templateKey === null ? role.name : t(`roles.${role.templateKey}`)).join(', ')}
        />
      </ListSection>

      {sections.showsOwnRecord && <><ListDivider /><OwnRecordSection session={session} isGuardianToo={sections.isGuardianToo} /></>}
      {sections.showsGuardianConsents && <><ListDivider /><GuardianConsentSections /></>}

      <View style={styles.footer}>
        <InstitutionSwitcher />
        <SignOutButton />
      </View>
    </Page>
  )
}

function OwnRecordSection({ session, isGuardianToo }: Readonly<{ session: InstitutionSession; isGuardianToo: boolean }>) {
  const { t } = useTranslation()
  const { state } = habituar.useAccessibleStudents(session.membership)
  // Quem também é responsável recebe junto os cadastros dos filhos: o título não pode dizer "seu".
  const title = t(isGuardianToo ? 'studentHome.self.combinedTitle' : 'studentHome.self.title')

  switch (state.status) {
    case 'loading':
      return <Text tone="muted" accessibilityLiveRegion="polite">{t('studentHome.self.loading')}</Text>
    case 'failed':
      return <Text accessibilityRole="alert" tone="danger">{t('studentHome.self.failed')}</Text>
    case 'ready':
      if (state.students.length === 0) return <EmptyState title={t('studentHome.self.emptyTitle')} description={t('studentHome.self.emptyDescription')} />
      return (
        <ListSection title={title} footer={t('studentHome.self.description')}>
          {state.students.map((student) => (
            <ListRow key={student.id} title={displayName(student)} description={t('studentHome.self.birthDateValue', { date: formatCalendarDate(student.birthDate) })} />
          ))}
        </ListSection>
      )
    default:
      return assertNever(state)
  }
}

// Ação à espera de confirmação: só uma por vez, e a frase da folha nomeia o estudante.
type PendingAction = Readonly<{ kind: 'confirm'; student: StudentSummary }> | Readonly<{ kind: 'revoke'; student: StudentSummary; consentId: Parameters<GuardianConsents['revoke']>[1] }>

function GuardianConsentSections() {
  const { t } = useTranslation()
  const toast = useToast()
  const consents = habituar.useGuardianConsents()
  const [pendingAction, setPendingAction] = useState<PendingAction | undefined>(undefined)
  const [isSending, setIsSending] = useState(false)
  const [hasFailed, setHasFailed] = useState(false)

  async function send(action: PendingAction): Promise<void> {
    setIsSending(true)
    const outcome = action.kind === 'confirm'
      ? await consents.confirm(action.student.id)
      : await consents.revoke(action.student.id, action.consentId)
    setIsSending(false)
    setPendingAction(undefined)
    setHasFailed(outcome === 'not-saved')
    if (outcome === 'saved') {
      const key = action.kind === 'confirm' ? 'consentConfirmed' : 'consentRevoked'
      toast({ type: 'success', title: t(`toast.studentHome.${key}.title`), subtitle: t(`toast.studentHome.${key}.description`) })
    }
  }

  function ask(action: PendingAction): void {
    setHasFailed(false)
    setPendingAction(action)
  }

  return (
    <View style={styles.stack}>
      <PendingConsentList consents={consents} onConfirm={(student) => { ask({ kind: 'confirm', student }) }} />
      <ListDivider />
      <ConfirmedConsentList consents={consents} onRevoke={(student, consentId) => { ask({ kind: 'revoke', student, consentId }) }} />
      {hasFailed && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" tone="danger">{t('studentHome.consent.failed')}</Text>}

      {pendingAction !== undefined && (
        <ConfirmationSheet
          title={t(pendingAction.kind === 'confirm' ? 'studentHome.consent.confirmTitle' : 'studentHome.consent.revokeTitle')}
          message={t(pendingAction.kind === 'confirm' ? 'studentHome.consent.confirmQuestion' : 'studentHome.consent.revokeQuestion', { name: displayName(pendingAction.student) })}
          confirmLabel={t(pendingAction.kind === 'confirm' ? 'studentHome.consent.confirmYes' : 'studentHome.consent.revokeYes')}
          cancelLabel={t('studentHome.consent.cancel')}
          confirmVariant={pendingAction.kind === 'confirm' ? 'primary' : 'danger'}
          isBusy={isSending}
          onConfirm={() => { void send(pendingAction) }}
          onCancel={() => { setPendingAction(undefined) }}
        />
      )}
    </View>
  )
}

function PendingConsentList({ consents, onConfirm }: Readonly<{ consents: GuardianConsents; onConfirm: (student: StudentSummary) => void }>) {
  const { t } = useTranslation()

  switch (consents.pending.status) {
    case 'loading':
      return <Text tone="muted" accessibilityLiveRegion="polite">{t('studentHome.consent.loading')}</Text>
    case 'failed':
      return <Text accessibilityRole="alert" tone="danger">{t('studentHome.consent.loadFailed')}</Text>
    case 'ready':
      if (consents.pending.consents.length === 0) return null
      return (
        <ListSection title={t('studentHome.consent.pendingTitle')} footer={t('studentHome.consent.pendingDescription')}>
          {consents.pending.consents.map(({ student, termVersion }) => (
            <ListRow key={student.id} title={displayName(student)} description={t('studentHome.consent.termMeta', { version: termVersion })}>
              {/* Resumo provisório: o sistema guarda só a versão do termo, e o texto oficial depende de revisão jurídica. */}
              <Text>{t('studentHome.consent.termSummary', { name: displayName(student) })}</Text>
              <Button label={t('studentHome.consent.confirm')} onPress={() => { onConfirm(student) }} />
            </ListRow>
          ))}
        </ListSection>
      )
    default:
      return assertNever(consents.pending)
  }
}

function ConfirmedConsentList({ consents, onRevoke }: Readonly<{ consents: GuardianConsents; onRevoke: (student: StudentSummary, consentId: Parameters<GuardianConsents['revoke']>[1]) => void }>) {
  const { t } = useTranslation()

  switch (consents.confirmed.status) {
    case 'loading':
      return <Text tone="muted" accessibilityLiveRegion="polite">{t('studentHome.consent.loading')}</Text>
    case 'failed':
      return <Text accessibilityRole="alert" tone="danger">{t('studentHome.consent.loadFailed')}</Text>
    case 'ready':
      if (consents.confirmed.consents.length === 0) {
        return <EmptyState title={t('studentHome.consent.noneTitle')} description={t('studentHome.consent.noneDescription')} />
      }
      return (
        <ListSection title={t('studentHome.consent.confirmedTitle')} footer={t('studentHome.consent.confirmedDescription')}>
          {consents.confirmed.consents.map(({ student, consent }) => (
            <ListRow key={consent.id} title={displayName(student)} description={t('studentHome.consent.confirmedOn', { date: formatDateTime(consent.recordedAt) })}>
              <Button label={t('studentHome.consent.revoke')} variant="dangerOutline" onPress={() => { onRevoke(student, consent.id) }} />
            </ListRow>
          ))}
        </ListSection>
      )
    default:
      return assertNever(consents.confirmed)
  }
}

// Nome social, quando existe, é como a pessoa é chamada.
function displayName(student: StudentSummary): string {
  return student.socialName ?? student.fullName
}

// Campos explícitos em vez de `dateStyle`: o Intl do Hermes não garante as opções de estilo
// em todo Android, e as partes numéricas dão o mesmo resultado em pt-BR.
const DATE_TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// Instante gravado pela API (UTC), mostrado no fuso de quem lê.
function formatDateTime(iso: string): string {
  return DATE_TIME_FORMAT.format(new Date(iso))
}

// Data de calendário sem fuso: passar por `Date` a deslocaria um dia a oeste de UTC.
function formatCalendarDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.lg },
  footer: { gap: SPACING.sm },
})
