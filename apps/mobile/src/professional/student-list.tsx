import { assertNever } from '@habituar/core/assert-never'
import type { StudentSummary } from '@habituar/core/students'
import { SPACING } from '@habituar/design-tokens/spacing'
import type { AccessibleStudents } from '@habituar/react-client/react-client'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/ui/empty-state'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { SearchField } from '../components/ui/search-field'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'

/**
 * Alunos que o alcance da pessoa cobre, com busca por nome. A linha leva à ficha só para
 * quem pode lê-la; quem acompanha sem esse acesso vê o aluno e o motivo, sem seta.
 */
export function StudentList({ session, title }: Readonly<{ session: InstitutionSession; title: string }>) {
  const { t } = useTranslation()
  const students = habituar.useAccessibleStudents(session.membership)

  return (
    <View style={styles.stack}>
      <SearchField label={t('students.list.searchLabel')} value={students.searchDraft} onChangeText={students.setSearchDraft} onSubmit={students.applySearch} />
      <StudentListContent students={students} title={title} />
    </View>
  )
}

function StudentListContent({ students, title }: Readonly<{ students: AccessibleStudents; title: string }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const { state } = students

  switch (state.status) {
    case 'loading':
      return <Text tone="muted" accessibilityLiveRegion="polite">{t('students.list.loading')}</Text>
    case 'failed':
      return state.failure === 'forbidden'
        ? <EmptyState title={t('students.list.forbiddenTitle')} description={t('students.list.forbiddenDescription')} />
        : <Text accessibilityRole="alert" tone="danger">{t('students.list.failed')}</Text>
    case 'ready':
      if (state.students.length === 0 && students.activeSearch !== '') {
        return (
          <View style={styles.stack}>
            <EmptyState title={t('students.list.noMatchTitle')} description={t('students.list.noMatchDescription')} />
            <Button label={t('students.list.clearSearch')} variant="outline" onPress={students.clearSearch} />
          </View>
        )
      }
      if (state.students.length === 0) {
        return <EmptyState title={t('students.list.emptyTitle')} description={t('students.list.emptyDescription')} />
      }
      return (
        <View style={styles.stack}>
          <ListSection title={title}>
            {state.students.map((student) => students.canOpenRecord
              ? <ListRow key={student.id} title={displayName(student)} onPress={() => { router.navigate(`/professional/students/${student.id}`) }} />
              : <ListRow key={student.id} title={displayName(student)} description={t('students.list.noRecordAccess')} />)}
          </ListSection>
          {state.pageCount > 1 && (
            <View accessibilityLabel={t('students.list.paginationLabel')} style={styles.pagination}>
              <Button label={t('students.list.previousPage')} variant="outline" size="inline" isDisabled={!students.pagination.hasPreviousPage} onPress={students.pagination.goToPreviousPage} />
              <Text size="caption" tone="muted" accessibilityLiveRegion="polite">{t('students.list.pageStatus', { page: state.page, pageCount: state.pageCount })}</Text>
              <Button label={t('students.list.nextPage')} variant="outline" size="inline" isDisabled={!students.pagination.hasNextPage} onPress={students.pagination.goToNextPage} />
            </View>
          )}
        </View>
      )
    default:
      return assertNever(state)
  }
}

// Nome social, quando existe, é como a pessoa é chamada; o nome civil fica na ficha.
function displayName(student: StudentSummary): string {
  return student.socialName ?? student.fullName
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.lg },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
})
