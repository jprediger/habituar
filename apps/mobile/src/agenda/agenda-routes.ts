import { assertNever } from '@habituar/core/assert-never'
import type { LocalDate } from '@habituar/core/calendar'
import type { StudentId, TaskId } from '@habituar/core/identity/ids'
import type { CalendarEntry } from '@habituar/react-client/react-client'
import { useRouter } from 'expo-router'

/** Em qual pilha a agenda do aluno está: a aba do próprio aluno ou a ficha, na equipe. */
export type AgendaPlace = 'student' | 'professional'

/**
 * Único lugar que conhece as rotas da agenda de tarefas em cada pilha. As telas pedem
 * "abrir a tarefa", "nova tarefa", "editar" e "voltar à agenda" sem saber o endereço.
 */
export function useAgendaRoutes(place: AgendaPlace) {
  const router = useRouter()

  function openTask(studentId: StudentId, taskId: TaskId, date: LocalDate): void {
    switch (place) {
      case 'student': router.push({ pathname: '/student/agenda/task/[task-id]', params: { 'task-id': taskId, student: studentId, date } }); return
      case 'professional': router.push({ pathname: '/professional/students/[student-id]/agenda/task/[task-id]', params: { 'student-id': studentId, 'task-id': taskId, date } }); return
      default: assertNever(place)
    }
  }

  function openEntry(studentId: StudentId, entry: CalendarEntry): void {
    switch (entry.kind) {
      case 'task':
        openTask(studentId, entry.task.id, entry.originalDate)
        return
      case 'appointment':
        // Atendimento continua no modelo antigo até as consultas entrarem na agenda.
        router.push(place === 'student'
          ? { pathname: '/student/agenda/appointment/[appointment-id]', params: { 'appointment-id': entry.occurrence.appointment.id, student: studentId, date: entry.date } }
          : { pathname: '/professional/agenda/appointment/[appointment-id]', params: { 'appointment-id': entry.occurrence.appointment.id, student: studentId, date: entry.date } })
        return
      default:
        assertNever(entry)
    }
  }

  function newTask(studentId: StudentId, date: LocalDate): void {
    switch (place) {
      case 'student': router.push({ pathname: '/student/agenda/task/new', params: { student: studentId, date } }); return
      case 'professional': router.push({ pathname: '/professional/students/[student-id]/agenda/task/new', params: { 'student-id': studentId, date } }); return
      default: assertNever(place)
    }
  }

  function editTask(studentId: StudentId, taskId: TaskId, originalDate: LocalDate): void {
    switch (place) {
      case 'student': router.push({ pathname: '/student/agenda/task/[task-id]/edit', params: { 'task-id': taskId, student: studentId, date: originalDate } }); return
      case 'professional': router.push({ pathname: '/professional/students/[student-id]/agenda/task/[task-id]/edit', params: { 'student-id': studentId, 'task-id': taskId, date: originalDate } }); return
      default: assertNever(place)
    }
  }

  // Divisão de série pode trocar a ocorrência de série: a volta é para a agenda, não para o detalhe.
  function backToAgenda(studentId: StudentId): void {
    switch (place) {
      case 'student': router.dismissTo('/student/agenda'); return
      case 'professional': router.dismissTo({ pathname: '/professional/students/[student-id]/agenda', params: { 'student-id': studentId } }); return
      default: assertNever(place)
    }
  }

  return { openEntry, openTask, newTask, editTask, backToAgenda }
}
