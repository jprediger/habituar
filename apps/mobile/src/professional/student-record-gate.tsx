import { assertNever } from '@habituar/core/assert-never'
import type { StudentRecord } from '@habituar/core/student-records'
import type { StudentDetail } from '@habituar/core/students'
import type { StudentRecordOverview } from '@habituar/react-client/react-client'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { StackPageSkeleton } from '../components/skeletons/page-skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { StackPage } from '../components/ui/stack-page'
import { Text } from '../components/ui/text'

/** Ficha carregada: o que as telas da ficha recebem depois que o gate resolveu carga e recusa. */
export type ReadyStudentRecord = Readonly<{
  student: StudentDetail
  record: StudentRecord
  canWrite: boolean
  recordProfile: StudentRecordOverview['recordProfile']
}>

/**
 * Carga e recusa comuns às telas que leem o cadastro e os dados de apoio. A tela só desenha
 * a ficha pronta, com o próprio `StackPage`, porque título e ação da barra são dela.
 */
export function StudentRecordGate({ title, overview, children }: Readonly<{ title: string; overview: StudentRecordOverview; children: (ready: ReadyStudentRecord) => ReactElement }>) {
  const { t } = useTranslation()

  switch (overview.record.status) {
    case 'loading':
      return <StackPage title={title}><StackPageSkeleton /></StackPage>
    case 'failed':
      return (
        <StackPage title={title}>
          {overview.record.failure === 'failed'
            ? <Text accessibilityRole="alert" tone="danger">{t('students.record.failed')}</Text>
            : <EmptyState title={t(`students.record.${overview.record.failure}.title`)} description={t(`students.record.${overview.record.failure}.description`)} />}
        </StackPage>
      )
    case 'ready':
      return children({ student: overview.record.student, record: overview.record.record, canWrite: overview.canWrite, recordProfile: overview.recordProfile })
    default:
      return assertNever(overview.record)
  }
}

/**
 * Gate das telas que só existem para registrar ou editar. O link direto também chega aqui,
 * então quem não escreve na ficha — ou o aluno arquivado — recebe o motivo, não o formulário.
 * A API recusaria de qualquer jeito; isto evita deixar a pessoa preencher à toa.
 */
export function StudentRecordWriteGate({ title, overview, children }: Readonly<{ title: string; overview: StudentRecordOverview; children: (ready: ReadyStudentRecord) => ReactElement }>) {
  const { t } = useTranslation()

  return (
    <StudentRecordGate title={title} overview={overview}>
      {(ready) => ready.canWrite
        ? children(ready)
        : (
            <StackPage title={title}>
              {ready.student.archivedAt !== null
                ? <Text accessibilityRole="alert">{t('students.record.archived')}</Text>
                : <EmptyState title={t('students.record.readOnly.title')} description={t('students.record.readOnly.description')} />}
            </StackPage>
          )}
    </StudentRecordGate>
  )
}
