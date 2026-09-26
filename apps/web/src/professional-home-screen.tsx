import { CalendarDays, UsersRound } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from './components/ui/empty-state.js'
import { PageHeader } from './components/ui/page-header.js'
import { Section } from './components/ui/section.js'
import { SummaryCards } from './components/ui/summary-cards.js'
import { useProfessionalSession } from './professional-session.js'

/**
 * Início do profissional. Mostra só o que a sessão sustenta — quem, onde e com que papel
 * — e reserva, com estado vazio honesto, o lugar dos estudantes e dos atendimentos até os
 * módulos que os alimentam existirem.
 */
export function ProfessionalHomeScreen(): ReactElement {
  const { t } = useTranslation()
  const session = useProfessionalSession()

  return (
    <div className="flex flex-col gap-xxl">
      <PageHeader
        eyebrow={t('navigation.home')}
        title={t('professional.home.greeting', { name: getFirstName(session.user.name) })}
        description={t('professional.home.description')}
      />

      <Section title={t('professional.home.membershipTitle')}>
        <SummaryCards
          items={[
            { label: t('home.institutionLabel'), value: session.membership.institution.name },
            { label: t('home.roleLabel'), value: session.membership.role.name },
          ]}
        />
      </Section>

      <div className="grid gap-xxl lg:grid-cols-2 lg:gap-xl">
        <Section title={t('professional.home.studentsTitle')}>
          <EmptyState
            icon={UsersRound}
            title={t('professional.home.studentsEmptyTitle')}
            description={t('professional.home.studentsEmptyDescription')}
          />
        </Section>
        <Section title={t('professional.home.appointmentsTitle')}>
          <EmptyState
            icon={CalendarDays}
            title={t('professional.home.appointmentsEmptyTitle')}
            description={t('professional.home.appointmentsEmptyDescription')}
          />
        </Section>
      </div>
    </div>
  )
}

// Saudação pelo primeiro nome: o nome completo fica no menu da conta e no Perfil, onde
// identificar a conta importa mais do que o tom.
function getFirstName(name: string): string {
  return name.trim().split(/\s+/).at(0) ?? name
}
