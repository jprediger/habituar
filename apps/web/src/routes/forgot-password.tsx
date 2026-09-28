import { createFileRoute } from '@tanstack/react-router'
import { ForgotPasswordScreen } from '../authentication/forgot-password-screen.js'

export const Route = createFileRoute('/forgot-password')({ component: ForgotPasswordScreen })
