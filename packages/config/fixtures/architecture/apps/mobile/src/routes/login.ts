import { authenticationCard } from '../authentication/authentication-card.ts'
import { homeCard } from '../home/home-card.ts'
import { sessionScreen } from '../session/session-screen.ts'

export const loginRoute = [authenticationCard, sessionScreen, homeCard]
