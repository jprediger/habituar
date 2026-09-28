import { createFileRoute } from '@tanstack/react-router'
import { AwaitingInvitationScreen } from '../authentication/awaiting-invitation-screen.js'

export const Route = createFileRoute('/awaiting-invitation')({ component: AwaitingInvitationScreen })
