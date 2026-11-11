import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { Text } from '../components/ui/text'
import { ensureNotificationsConfigured, getNotificationPermissionStatus, openAppNotificationSettings, requestNotificationPermission, type NotificationPermissionStatus } from './notification-setup'

/** Preferência de permissão do aparelho; tipos de lembrete pertencem ao ambiente que os agenda. */
export function DeviceNotificationSettings({ onPermissionChange }: Readonly<{ onPermissionChange?: ((status: NotificationPermissionStatus) => void) | undefined }> = {}) {
  const { t } = useTranslation()
  const [permission, setPermission] = useState<NotificationPermissionStatus | undefined>(undefined)
  const [hasFailed, setHasFailed] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    let active = true
    async function refresh() {
      try {
        await ensureNotificationsConfigured()
        const status = await getNotificationPermissionStatus()
        if (active) { setPermission(status); onPermissionChange?.(status); setHasFailed(false) }
      } catch { if (active) setHasFailed(true) }
    }
    void refresh()
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh() })
    return () => { active = false; subscription.remove() }
  }, [onPermissionChange])

  async function configure() {
    setIsBusy(true)
    try {
      const current = await getNotificationPermissionStatus()
      if (current === 'undetermined') {
        const status = await requestNotificationPermission()
        setPermission(status)
        onPermissionChange?.(status)
      }
      else { setPermission(current); onPermissionChange?.(current); await openAppNotificationSettings() }
      setHasFailed(false)
    } catch { setHasFailed(true) }
    finally { setIsBusy(false) }
  }

  return <ListSection title={t('studentProfile.devicePermission')} footer={t('studentProfile.permissionHelp')}>
    <ListRow icon="gear" title={permission === undefined ? t(hasFailed ? 'notificationSettings.retry' : 'notificationSettings.loading') : t(`studentProfile.permission.${permission}`)} onPress={(permission === undefined && !hasFailed) || isBusy ? undefined : () => { void configure() }} />
    {hasFailed && <Text accessibilityRole="alert" tone="danger">{t('studentProfile.failed')}</Text>}
  </ListSection>
}
