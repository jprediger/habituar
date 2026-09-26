import { Link } from '@tanstack/react-router'
import { LogOut, UserRound } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu.js'
import { habituar } from './habituar-client.js'
import type { InstitutionSession } from './session-route.js'

/**
 * Menu da conta no topo do ambiente profissional: identifica quem está conectado e onde,
 * e concentra as ações de conta — Perfil e Sair. Não decide destino de sessão; sair
 * só dispara o logout, e o guard leva a pessoa para a entrada.
 */
export function AccountMenu({ session }: Readonly<{ session: InstitutionSession }>): ReactElement {
  const { t } = useTranslation()
  const { state, actions } = habituar.useAuthentication()
  const isSigningOut = state.status === 'authenticating'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('shell.account.open', { name: session.user.name })}
          className={
            'inline-flex size-(--interaction-minimum-touch-target) shrink-0 cursor-pointer items-center justify-center ' +
            'rounded-control outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-focus-ring'
          }
        >
          <span
            aria-hidden="true"
            className={
              'inline-flex size-full items-center justify-center rounded-control border border-hairline bg-sidebar-accent ' +
              'text-caption font-bold tracking-wide text-primary motion-safe:transition-colors hover:border-primary'
            }
          >
            {getInitials(session.user.name)}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[16rem]">
        <DropdownMenuLabel className="flex flex-col gap-none">
          <span className="truncate text-body font-medium text-text">{session.user.name}</span>
          <span className="truncate text-caption text-text-muted">{session.membership.institution.name}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/professional/profile">
            <UserRound aria-hidden="true" focusable="false" strokeWidth={1.75} />
            {t('navigation.profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isSigningOut}
          onSelect={() => {
            void actions.logout()
          }}
        >
          <LogOut aria-hidden="true" focusable="false" strokeWidth={1.75} />
          {isSigningOut ? t('authentication.logoutSubmitting') : t('authentication.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Iniciais do primeiro e do último nome: o bastante para reconhecer a própria conta sem
// depender de foto, que ainda não existe no cadastro.
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0)
  const first = words.at(0)?.at(0) ?? ''
  const last = words.length > 1 ? (words.at(-1)?.at(0) ?? '') : ''

  return `${first}${last}`.toLocaleUpperCase('pt-BR')
}
