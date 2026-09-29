import { assertNever } from '@habituar/core/assert-never'
import type { Pagination, StaffFailure, StaffListState } from '@habituar/react-client/staff-management'
import type { StaffRole } from '@habituar/core/staff'
import { SearchX, UsersRound } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button.js'
import { EmptyState } from '../components/ui/empty-state.js'

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
 * tentativa, vazio e busca sem resultado. Cada um tem texto próprio; nenhum deles se
 * disfarça de lista vazia.
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
}>): ReactElement | null {
  const { t } = useTranslation()
  switch (state.status) {
    case 'loading':
      return <p role="status" className="text-body text-text-muted">{t('staff.loading')}</p>
    case 'failed':
      return <FailureNotice failure={state.failure} onRetry={onRetry} actionLabel={t('staff.retry')} />
    case 'empty':
      return <EmptyState icon={UsersRound} title={empty.title} description={empty.description} />
    case 'no-results':
      return (
        <div role="status" className="flex flex-col gap-sm">
          <EmptyState icon={SearchX} title={noResults.title} description={noResults.description} />
          {noResults.action}
        </div>
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
}: Readonly<{ failure: StaffFailure; onRetry?: (() => void) | undefined; actionLabel?: string | undefined }>): ReactElement {
  const { t } = useTranslation()
  return (
    <div role="alert" className="flex flex-col items-start gap-sm rounded-field border border-danger px-lg py-md">
      <p className="text-body text-text">{getStaffFailureText(failure, t)}</p>
      {onRetry !== undefined && actionLabel !== undefined && (
        <Button type="button" variant="outline" onClick={onRetry}>{actionLabel}</Button>
      )}
    </div>
  )
}

/** Navegação entre páginas de uma lista paginada no servidor. */
export function PaginationControls({ pagination, page, pageCount }: Readonly<{ pagination: Pagination; page: number; pageCount: number }>): ReactElement | null {
  const { t } = useTranslation()
  if (pageCount <= 1) return null
  return (
    <nav aria-label={t('staff.paginationLabel')} className="flex flex-wrap items-center justify-between gap-sm">
      <Button type="button" variant="outline" disabled={!pagination.hasPreviousPage} onClick={pagination.goToPreviousPage}>{t('staff.previousPage')}</Button>
      <p className="text-caption text-text-muted" aria-live="polite">{t('staff.pageStatus', { page, pageCount })}</p>
      <Button type="button" variant="outline" disabled={!pagination.hasNextPage} onClick={pagination.goToNextPage}>{t('staff.nextPage')}</Button>
    </nav>
  )
}

/**
 * Confirmação explícita de uma ação sem volta, no mesmo lugar da ação: a frase nomeia o
 * alvo, o botão destrutivo recebe o foco e "voltar" é sempre a outra opção.
 */
export function ConfirmationPanel({
  message,
  confirmLabel,
  cancelLabel,
  isBusy,
  onConfirm,
  onCancel,
}: Readonly<{ message: string; confirmLabel: string; cancelLabel: string; isBusy: boolean; onConfirm: () => void; onCancel: () => void }>): ReactElement {
  return (
    <div role="group" aria-label={message} className="flex flex-col gap-sm rounded-field border border-danger px-lg py-md">
      <p className="text-body text-text">{message}</p>
      <div className="flex flex-wrap gap-sm">
        {/* O foco vai para a confirmação para quem usa teclado não precisar procurá-la. */}
        <Button type="button" variant="destructive" disabled={isBusy} onClick={onConfirm} autoFocus>{confirmLabel}</Button>
        <Button type="button" variant="outline" disabled={isBusy} onClick={onCancel}>{cancelLabel}</Button>
      </div>
    </div>
  )
}

/** Resultado de uma operação anunciado ao leitor de tela sem mover o foco. */
export function ResultAnnouncement({ children }: Readonly<{ children: ReactNode }>): ReactElement {
  return <div role="status" aria-live="polite" className="text-body text-text">{children}</div>
}
