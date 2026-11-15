import { getClassCapabilities } from '@habituar/react-client/class-hooks'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'

/** Turmas agrupam pessoas, sem conceder acesso aos registros individuais. */
export function ClassListScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation('classes')
  const router = useRouter()
  const [archived, setArchived] = useState(false)
  const capabilities = getClassCapabilities(session.membership)
  const classes = habituar.useClasses(session.membership, archived)

  return <StackPage title={t('title')} action={capabilities.canCreate ? {
    icon: 'plus', label: t('create'),
    onPress: () => { router.push('/professional/management/classes/new') },
  } : undefined}>
    <Text tone="muted">{t('description')}</Text>
    <Button variant="outline" label={t(archived ? 'showActive' : 'showArchived')} onPress={() => { setArchived(value => !value) }} />
    {classes.state.status === 'loading' && <Text>{t('loading')}</Text>}
    {classes.state.status === 'failed' && <>
      <Text accessibilityRole="alert" tone="danger">{t(classes.state.failure === 'forbidden' ? 'errors.forbidden' : 'errors.load')}</Text>
      <Button variant="outline" label={t('retry')} onPress={() => { void classes.refresh() }} />
    </>}
    {classes.state.status === 'ready' && <>
      <ListSection title={t('count', { count: classes.state.items.length })}>
        {classes.state.items.length === 0 && <Text tone="muted">{t(archived ? 'emptyArchived' : 'empty')}</Text>}
        {classes.state.items.map(item => <ListRow
          key={item.id}
          icon="users-three"
          title={item.name}
          description={item.description ?? undefined}
          value={t('studentCount', { count: item.studentCount })}
          accessibilityHint={t('memberCounts', { students: item.studentCount, staff: item.staffCount })}
          onPress={() => { router.push({ pathname: '/professional/management/classes/[class-id]', params: { 'class-id': item.id } }) }}
        />)}
      </ListSection>
      <Button variant="outline" label={t('refresh')} onPress={() => { void classes.refresh() }} />
    </>}
  </StackPage>
}
