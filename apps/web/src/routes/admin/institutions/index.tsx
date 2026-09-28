import { createFileRoute } from '@tanstack/react-router'
import { InstitutionListScreen } from '../../../platform/platform-screens.js'

export const Route = createFileRoute('/admin/institutions/')({ component: InstitutionListScreen })
