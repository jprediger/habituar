import { createFileRoute } from '@tanstack/react-router'
import { RegisterScreen } from '../authentication/register-screen.js'

export const Route = createFileRoute('/register')({ component: RegisterScreen })
