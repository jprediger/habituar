import { createFileRoute } from '@tanstack/react-router'
import { StudentHomeScreen } from '../../student/student-home-screen.js'

export const Route = createFileRoute('/student/')({ component: StudentHomeScreen })
