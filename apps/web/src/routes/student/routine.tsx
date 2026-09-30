import { createFileRoute } from '@tanstack/react-router'
import { StudentRoutineScreen } from '../../student/student-routine-screen.js'

export const Route = createFileRoute('/student/routine')({ component: StudentRoutineScreen })
