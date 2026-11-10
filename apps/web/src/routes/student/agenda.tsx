import { createFileRoute } from '@tanstack/react-router'
import { StudentAgendaScreen } from '../../student/student-agenda-screen.js'

export const Route = createFileRoute('/student/agenda')({ component: StudentAgendaScreen })
