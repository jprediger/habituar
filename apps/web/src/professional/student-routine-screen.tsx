import type { StudentId } from '@habituar/core/identity/ids'
import { Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/ui/page-header.js'
import { StudentRoutineEditor } from './student-routine-editor.js'

/**
 * Organização da rotina semanal de um estudante, em página própria aberta pela ficha: a
 * ficha fica com o registro do aluno, e montar a semana é trabalho separado.
 */
export function StudentRoutineScreen({ studentId }: Readonly<{ studentId: StudentId }>): ReactElement {
  const { t } = useTranslation()
  const { t: tAgenda } = useTranslation('agenda')

  return (
    <div className="flex flex-col gap-xl">
      <Link to="/professional/students/$studentId" params={{ studentId }} className="self-start text-body text-primary underline">{tAgenda('tracking.back')}</Link>
      <PageHeader eyebrow={t('students.record.eyebrow')} title={t('routine.title')} description={t('routine.description')} />
      <StudentRoutineEditor studentId={studentId} />
    </div>
  )
}
