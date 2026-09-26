import { createFileRoute } from '@tanstack/react-router'
import { ProfessionalHomeScreen } from '../../professional-home-screen.js'

export const Route = createFileRoute('/professional/')({ component: ProfessionalHomeScreen })
