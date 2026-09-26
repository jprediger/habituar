import { INTERACTION } from '@habituar/design-tokens/interaction'
import { fireEvent, render, screen } from '@testing-library/react-native'
import './i18n/i18n'
import { ProfessionalTabBar } from './professional-tab-bar'

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

describe('professional tab bar', () => {
  it('offers each destination of the environment as a tab with a visible label', () => {
    render(<ProfessionalTabBar />)

    expect(screen.getByRole('tab', { name: HOME })).toBeOnTheScreen()
    expect(screen.getByRole('tab', { name: PROFILE })).toBeOnTheScreen()
    expect(screen.getByText(HOME)).toBeOnTheScreen()
    expect(screen.getByText(PROFILE)).toBeOnTheScreen()
  })

  it('tells assistive technology which tab is selected on the home route', () => {
    render(<ProfessionalTabBar />)

    expect(screen.getByRole('tab', { name: HOME, selected: true })).toBeOnTheScreen()
    expect(screen.getByRole('tab', { name: PROFILE, selected: false })).toBeOnTheScreen()
  })

  it('moves the selection to the profile when a deep link opens it', () => {
    mockRouter.pathname = '/professional/profile'

    render(<ProfessionalTabBar />)

    expect(screen.getByRole('tab', { name: PROFILE, selected: true })).toBeOnTheScreen()
    expect(screen.getByRole('tab', { name: HOME, selected: false })).toBeOnTheScreen()
  })

  it('opens the destination of the tab that was pressed', () => {
    render(<ProfessionalTabBar />)

    fireEvent.press(screen.getByRole('tab', { name: PROFILE }))

    expect(mockRouter.navigate).toHaveBeenCalledWith('/professional/profile')
  })

  it('gives every tab a target big enough to hit', () => {
    render(<ProfessionalTabBar />)

    for (const name of [HOME, PROFILE]) {
      expect(screen.getByRole('tab', { name })).toHaveStyle({ minHeight: INTERACTION.minimumTouchTarget })
    }
  })

  it('keeps the labels clear of the home indicator at the bottom of the screen', () => {
    render(<ProfessionalTabBar />)

    expect(screen.root).toHaveStyle({ paddingBottom: 34 })
  })
})
