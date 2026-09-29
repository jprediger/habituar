import { createFileRoute } from '@tanstack/react-router'
import { ManagementIndexRedirect } from '../../../management/institution-management.js'

export const Route = createFileRoute('/professional/management/')({ component: ManagementIndexRedirect })
