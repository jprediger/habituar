import { useTranslation } from 'react-i18next'
import { assertNever } from '@habituar/core/assert-never'
import type { HomeDestination } from '@habituar/core/home-destination'
import type { AuthenticationFailure } from '@habituar/react-client/react-client'
import { Pressable, Text } from 'react-native'
import { habituar } from '../habituar-client'

/** Fixture textual compartilhada apenas dentro do app para comprovar os destinos nativos. */
export function AuthenticationFixture(props: Readonly<{ destination?: HomeDestination }>) {
  const { t } = useTranslation()
  const { state, actions } = habituar.useAuthentication()

  switch (state.status) {
    case 'authenticated':
      return (
        <>
          <Text>{getHomeText(props.destination ?? state.session.destination, t)}</Text>
          <Pressable accessibilityRole="button" onPress={() => void actions.logout()}>
            <Text>{t('authentication.logout')}</Text>
          </Pressable>
        </>
      )
    case 'failed':
      return <Text>{getFailureText(state.failure, t)}</Text>
    case 'restoring':
    case 'authenticating':
    case 'unauthenticated':
    case 'selecting-membership':
      return null
    default:
      return assertNever(state)
  }
}

function getHomeText(destination: HomeDestination, t: ReturnType<typeof useTranslation>['t']): string {
  switch (destination) {
    case 'student-home': return t('home.student-home')
    case 'professional-home': return t('home.professional-home')
    case 'monitor-home': return t('home.monitor-home')
    default: return assertNever(destination)
  }
}

function getFailureText(failure: AuthenticationFailure, t: ReturnType<typeof useTranslation>['t']): string {
  switch (failure) {
    case 'invalid-credentials': return t('authentication.failure.invalid-credentials')
    case 'network': return t('authentication.failure.network')
    case 'no-memberships': return t('authentication.failure.no-memberships')
    case 'forbidden': return t('authentication.failure.forbidden')
    default: return assertNever(failure)
  }
}
