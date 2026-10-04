import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

let hasConfigured = false

export async function ensureNotificationsConfigured(): Promise<void> {
  if (hasConfigured) return
  hasConfigured = true

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  })

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('routine-reminders', {
      name: 'Lembretes de rotina',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }
}

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined'

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync()
  return status
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  const { status } = await Notifications.requestPermissionsAsync()
  return status
}