import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'

/**
 * Aviso do uso sem conexão nas telas da rotina do aluno: o que está em tela veio do aparelho,
 * quantas mudanças esperam envio e quais a API recusou ao sincronizar. Fica visível enquanto
 * vale — não é toast —, e some quando a conexão volta e a fila esvazia.
 */
export function OfflineNotice() {
  const { t } = useTranslation('agenda')
  const status = habituar.useOfflineStatus()
  if (status.connection === 'online' && status.pendingChanges === 0 && status.discardedChanges === 0) return null

  return (
    <View accessibilityLiveRegion="polite">
      <ListSection>
        {status.connection === 'offline' && <ListRow icon="warning-circle" title={t('offline.title')} description={t('offline.description')} />}
        {status.pendingChanges > 0 && <ListRow icon="info" title={t('offline.pending', { count: status.pendingChanges })} description={t('offline.pendingDescription')} />}
        {status.discardedChanges > 0 && (
          <ListRow
            icon="warning"
            title={t('offline.discarded', { count: status.discardedChanges })}
            description={t('offline.discardedDescription')}
            accessibilityHint={t('offline.dismissHint')}
            onPress={status.dismissDiscarded}
          />
        )}
      </ListSection>
    </View>
  )
}
