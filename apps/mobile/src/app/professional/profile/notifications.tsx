import { useProfessionalReminders } from '../../../notifications/professional-reminders-provider'
import { useTranslation } from 'react-i18next'
import { StackPage } from '../../../components/ui/stack-page'
import { AppointmentNotificationSettings } from '../../../notifications/appointment-notification-settings'
import { ListDivider } from '../../../components/ui/list-divider'
import { DeviceNotificationSettings } from '../../../notifications/device-notification-settings'

/** Configuração do aparelho disponível aos papéis que compartilham o ambiente profissional. */
export default function ProfessionalNotificationsRoute() {
  const { t } = useTranslation()
  const reminders = useProfessionalReminders()
  return <StackPage title={t('studentProfile.notifications')}><AppointmentNotificationSettings /><ListDivider /><DeviceNotificationSettings onPermissionChange={reminders?.updatePermission} /></StackPage>
}
