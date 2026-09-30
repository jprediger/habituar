import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { SearchField } from '../components/ui/search-field'
import { StackPage } from '../components/ui/stack-page'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'

/** Lista paginada dos alunos no alcance do vínculo atual; a busca é aplicada no servidor. */
export function StudentsScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const list = habituar.useStudentList(session.membership.institution.id)
  const canCreate = session.membership.permissions.some((permission) => permission.key === 'student.create' && permission.scope === 'institution')
  return (
    <StackPage title={t('students.title')} action={canCreate ? { icon: 'plus', label: t('students.create'), onPress: () => { router.push('/professional/management/students/new') } } : undefined}>
      <SearchField label={t('students.search')} value={list.search} onChangeText={list.setSearch} onSubmit={() => { list.setPage(1) }} />
      {list.state.status === 'loading' && <Text>{t('students.loading')}</Text>}
      {list.state.status === 'error' && <><Text accessibilityRole="alert">{t('students.loadFailed')}</Text><Button variant="outline" label={t('students.retry')} onPress={() => { void list.refresh() }} /></>}
      {list.state.status === 'ready' && list.state.items.length === 0 && <Text>{list.search.length > 0 ? t('students.noResults') : t('students.empty')}</Text>}
      {list.state.status === 'ready' && list.state.items.length > 0 && <>
        <ListSection title={t('students.total', { count: list.state.total })}>
          {list.state.items.map((student) => <ListRow key={student.id} title={student.socialName ?? student.fullName} description={student.socialName === null ? t(`students.ageRange.${student.ageRange}`) : `${student.fullName} · ${t(`students.ageRange.${student.ageRange}`)}`} onPress={() => { router.push({ pathname: '/professional/management/students/student/[student-id]', params: { 'student-id': student.id } }) }} />)}
        </ListSection>
        {list.page > 1 && <Button variant="outline" label={t('students.previous')} onPress={() => { list.setPage(list.page - 1) }} />}
        {list.page * list.state.pageSize < list.state.total && <Button variant="outline" label={t('students.next')} onPress={() => { list.setPage(list.page + 1) }} />}
      </>}
    </StackPage>
  )
}
