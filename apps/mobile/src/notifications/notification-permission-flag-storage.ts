import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'habituar.has-requested-notification-permission'

/** Garante que o pedido automático de permissão acontece uma única vez na vida do app. */
export const permissionRequestFlag = {
  async wasRequested(): Promise<boolean> {
    return (await AsyncStorage.getItem(KEY)) === 'true'
  },
  async markRequested(): Promise<void> {
    await AsyncStorage.setItem(KEY, 'true')
  },
}