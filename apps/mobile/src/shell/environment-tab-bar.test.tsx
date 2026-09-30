import type { EffectivePermission } from '@habituar/core/auth/context'
import { INTERACTION } from '@habituar/design-tokens/interaction'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { useEnvironmentNavigation, useProfessionalNavigation } from '@habituar/react-client/environment-navigation'
import '../i18n/i18n'
import { EnvironmentTabBar } from './environment-tab-bar'

function ProfessionalBar({ permissions = [] }: Readonly<{ permissions?: readonly EffectivePermission[] }>) {
  return <EnvironmentTabBar items={useProfessionalNavigation({ permissions })} />
}

function StudentBar() {
  return <EnvironmentTabBar items={useEnvironmentNavigation('student')} />
}

const HOME = 'Início'
const PROFILE = 'Perfil'

const mockRouter = { pathname: '/professional', navigate: jest.fn() }

jest.mock('expo-router', () => ({
  usePathname: () => mockRouter.pathname,
  useRouter: () => ({ navigate: mockRouter.navigate }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
}))

beforeEach(() => {
  mockRouter.pathname = '/professional'
  jest.clearAllMocks()
})

describe('environment tab bar', () => {
  it('offers each destination of the environment as a tab with a visible label', () => {
    render(<ProfessionalBar />)

    expect(screen.getByRole('tab', { name: HOME })).toBeOnTheScreen()
    expect(screen.getByRole('tab', { name: PROFILE })).toBeOnTheScreen()
    expect(screen.getByText(HOME)).toBeOnTheScreen()
    expect(screen.getByText(PROFILE)).toBeOnTheScreen()
  })

  it('tells assistive technology which tab is selected on the home route', () => {
    render(<ProfessionalBar />)

    expect(screen.getByRole('tab', { name: HOME, selected: true })).toBeOnTheScreen()
    expect(screen.getByRole('tab', { name: PROFILE, selected: false })).toBeOnTheScreen()
  })

  it('moves the selection to the profile when a deep link opens it', () => {
    mockRouter.pathname = '/professional/profile'

    render(<ProfessionalBar />)

    expect(screen.getByRole('tab', { name: PROFILE, selected: true })).toBeOnTheScreen()
    expect(screen.getByRole('tab', { name: HOME, selected: false })).toBeOnTheScreen()
  })

  it('opens the destination of the tab that was pressed', () => {
    render(<ProfessionalBar />)

    fireEvent.press(screen.getByRole('tab', { name: PROFILE }))

    expect(mockRouter.navigate).toHaveBeenCalledWith('/professional/profile')
  })

  it('gives every tab a target big enough to hit', () => {
    render(<ProfessionalBar />)

    for (const name of [HOME, PROFILE]) {
      expect(screen.getByRole('tab', { name })).toHaveStyle({ minHeight: INTERACTION.minimumTouchTarget })
    }
  })

  it('keeps the labels clear of the home indicator at the bottom of the screen', () => {
    render(<ProfessionalBar />)

    expect(screen.root).toHaveStyle({ paddingBottom: 34 })
  })

  it('stays out of the way while an environment has a single destination', () => {
    mockRouter.pathname = '/student'

    render(<EnvironmentTabBar items={[{ id: 'home', labelKey: 'navigation.home', path: '/student', icon: 'home' }]} />)

    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('offers the student home and routine', () => {
    mockRouter.pathname = '/student/routine'

    render(<StudentBar />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(tabs.indexOf(screen.getByRole('tab', { name: HOME }))).toBe(0)
    expect(screen.getByRole('tab', { name: 'Rotina' })).toBeSelected()
  })

  it('shows management between home and profile only to someone who can read the team', () => {
    render(<ProfessionalBar permissions={[{ key: 'membership.read', scope: 'institution' }]} />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(tabs.indexOf(screen.getByRole('tab', { name: HOME }))).toBe(0)
    expect(tabs.indexOf(screen.getByRole('tab', { name: 'Gestão' }))).toBe(1)
    expect(tabs.indexOf(screen.getByRole('tab', { name: PROFILE }))).toBe(2)

    fireEvent.press(screen.getByRole('tab', { name: 'Gestão' }))
    expect(mockRouter.navigate).toHaveBeenCalledWith('/professional/management')
  })
})
