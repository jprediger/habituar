import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/ui/page-header.js'
import { Section } from '../components/ui/section.js'
import { SummaryCards } from '../components/ui/summary-cards.js'
import { useInstitutionSession } from '../session/institution-session.js'
import { ProfessionalHomeMetrics } from './professional-home-metrics.js'
import { StudentList } from './student-list.js'
import { UpcomingAppointments } from './upcoming-appointments.js'

/**
 * Início do profissional: para quem lê a agenda, o resumo e os próximos atendimentos; os
 * alunos cuja ficha a pessoa alcança; e, por último, onde e com que papel.
 */
export function ProfessionalHomeScreen(): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()
  const readsAppointments = session.membership.permissions.some((permission) => permission.key === 'appointment.read')

  return (
    <div className="flex flex-col gap-xxl">
      <PageHeader
        eyebrow={t('navigation.home')}
        title={t('professional.home.greeting', { name: getFirstName(session.user.name) })}
        description={t('professional.home.description')}
      />

      {readsAppointments && <ProfessionalHomeMetrics />}

      <div className="grid gap-xxl lg:grid-cols-2 lg:gap-xl">
        <Section title={t('professional.home.studentsTitle')}>
          <StudentList />
        </Section>
        {readsAppointments && (
          <Section title={t('professional.home.appointmentsTitle')}>
            <UpcomingAppointments />
          </Section>
        )}
      </div>

      <Section title={t('professional.home.membershipTitle')}>
        <SummaryCards
          items={[
            { label: t('home.institutionLabel'), value: session.membership.institution.name },
            { label: t('home.roleLabel'), value: session.membership.roles.map((role) => role.templateKey === null ? role.name : t(`roles.${role.templateKey}`)).join(", ") },
          ]}
        />
      </Section>
    </div>
  )
}

// Saudação pelo primeiro nome: o nome completo fica no menu da conta e no Perfil, onde
// identificar a conta importa mais do que o tom.
function getFirstName(name: string): string {
  return name.trim().split(/\s+/).at(0) ?? name
}
