import { createFileRoute } from '@tanstack/react-router'
import { NewInstitutionScreen } from '../../../platform/platform-screens.js'

export const Route = createFileRoute('/admin/institutions/new')({ component: NewInstitutionScreen })
