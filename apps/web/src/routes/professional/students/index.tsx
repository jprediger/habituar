import { createFileRoute } from '@tanstack/react-router'
import { StudentsListScreen } from '../../../students/students-list-screen.js'

export const Route = createFileRoute('/professional/students/')({ component: StudentsListScreen })
