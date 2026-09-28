import { createFileRoute } from '@tanstack/react-router'
import { ProfessionalProfileScreen } from '../../professional/professional-profile-screen.js'

export const Route = createFileRoute('/professional/profile')({ component: ProfessionalProfileScreen })
