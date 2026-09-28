import { createFileRoute } from '@tanstack/react-router'
import { LoginScreen } from '../authentication/login-screen.js'

export const Route = createFileRoute('/login')({ component: LoginScreen })
