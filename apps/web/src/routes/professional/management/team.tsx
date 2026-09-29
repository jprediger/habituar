import { createFileRoute } from '@tanstack/react-router'
import { ManagementSectionScreen } from '../../../management/institution-management.js'

export const Route = createFileRoute('/professional/management/team')({ component: () => <ManagementSectionScreen section="team" /> })
