import { assertNever } from '@habituar/core/assert-never'
import type { StaffRole } from '@habituar/core/staff'
import { SPACING } from '@habituar/design-tokens/spacing'
import type { Pagination, StaffFailure, StaffListState } from '@habituar/react-client/staff-management'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/ui/empty-state'
import { Text } from '../components/ui/text'
import { useThemeTokens } from '../theme/tokens'

type Translate = ReturnType<typeof useTranslation>['t']

/** Texto de uma falha de gestão; o código vem do hook e o texto, do catálogo. */
export function getStaffFailureText(failure: StaffFailure, t: Translate): string {
  return t(`staff.failure.${failure}`)
}

/** Nome exibível de um papel: template vem do i18n, papel personalizado é dado. */
export function getRoleName(role: Readonly<{ name: string; templateKey: StaffRole['templateKey'] }>, t: Translate): string {
  return role.templateKey === null ? role.name : t(`roles.${role.templateKey}`)
}

/** Data de calendário em pt-BR a partir de um instante ISO vindo do contrato. */
export function formatDay(isoInstant: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(Date.parse(isoInstant))
}

/**
 * Estados de uma lista de gestão que não são a lista: carregando, falha com nova
 * tentativa, vazio e busca sem resultado, cada um com texto próprio.
 */
export function StaffListStatus<Item>({
  state,
  onRetry,
  empty,
  noResults,
}: Readonly<{
  state: StaffListState<Item>
  onRetry: () => void
  empty: Readonly<{ title: string; description: string }>
  noResults: Readonly<{ title: string; description: string; action?: ReactNode }>
}>) {
  const { t } = useTranslation()
  switch (state.status) {
    case 'loading':
      return <Text accessibilityLiveRegion="polite" tone="muted">{t('staff.loading')}</Text>
    case 'failed':
      return <FailureNotice failure={state.failure} onRetry={onRetry} actionLabel={t('staff.retry')} />
    case 'empty':
      return <EmptyState title={empty.title} description={empty.description} />
    case 'no-results':
      return (
        <View accessibilityLiveRegion="polite" style={styles.stack}>
          <EmptyState title={noResults.title} description={noResults.description} />
          {noResults.action}
        </View>
      )
    case 'ready':
      return null
    default:
      return assertNever(state)
  }
}

/** Falha com a saída ao lado: o texto diz o que fazer e o botão faz. */
export function FailureNotice({
  failure,
  onRetry,
  actionLabel,
}: Readonly<{ failure: StaffFailure; onRetry?: (() => void) | undefined; actionLabel?: string | undefined }>) {
  const { t } = useTranslation()
  const { colors, radius } = useThemeTokens()
  return (
    <View style={[styles.notice, { borderColor: colors.danger, borderRadius: radius.field }]}>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite">{getStaffFailureText(failure, t)}</Text>
      {onRetry !== undefined && actionLabel !== undefined && <Button variant="outline" label={actionLabel} onPress={onRetry} />}
    </View>
  )
}

/**
 * Confirmação explícita de uma ação sem volta, no lugar da ação: a frase nomeia o alvo e
 * "voltar" é sempre a outra opção.
 */
export function ConfirmationPanel({
  message,
  confirmLabel,
  cancelLabel,
  isBusy,
  onConfirm,
  onCancel,
}: Readonly<{ message: string; confirmLabel: string; cancelLabel: string; isBusy: boolean; onConfirm: () => void; onCancel: () => void }>) {
  const { colors, radius } = useThemeTokens()
  return (
    <View style={[styles.notice, { borderColor: colors.danger, borderRadius: radius.field }]}>
      <Text accessibilityLiveRegion="polite">{message}</Text>
      <Button variant="danger" label={confirmLabel} isDisabled={isBusy} isBusy={isBusy} onPress={onConfirm} />
      <Button variant="outline" label={cancelLabel} isDisabled={isBusy} onPress={onCancel} />
    </View>
  )
}

/** Resultado de uma operação anunciado ao leitor de tela sem mover o foco. */
export function ResultAnnouncement({ children }: Readonly<{ children: ReactNode }>) {
  return <View accessibilityLiveRegion="polite" style={styles.stack}>{children}</View>
}

/** Navegação entre páginas de uma lista paginada no servidor. */
export function PaginationControls({ pagination, page, pageCount }: Readonly<{ pagination: Pagination; page: number; pageCount: number }>) {
  const { t } = useTranslation()
  if (pageCount <= 1) return null
  return (
    <View style={styles.pagination}>
      <Button variant="outline" label={t('staff.previousPage')} isDisabled={!pagination.hasPreviousPage} onPress={pagination.goToPreviousPage} />
      <Text accessibilityLiveRegion="polite" size="caption" tone="muted">{t('staff.pageStatus', { page, pageCount })}</Text>
      <Button variant="outline" label={t('staff.nextPage')} isDisabled={!pagination.hasNextPage} onPress={pagination.goToNextPage} />
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.sm },
  notice: { gap: SPACING.sm, borderWidth: 1, padding: SPACING.lg },
  pagination: { gap: SPACING.sm },
})
