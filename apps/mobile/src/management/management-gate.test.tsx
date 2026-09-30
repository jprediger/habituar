import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import i18n from '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { ManagementGate } from './management-gate'

const mockPathname = { current: '/professional/management' }

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname.current,
  Redirect: () => null,
}))

const STUDENT_READ = [{ key: 'student.read', scope: 'assigned' }] as const
const TEAM_READ = [{ key: 'membership.read', scope: 'institution' }] as const

function renderGate(permissions: typeof STUDENT_READ | typeof TEAM_READ) {
  const session = createInstitutionSession('professional')
  return render(<ManagementGate session={{ ...session, membership: { ...session.membership, permissions } }}><Text>{i18n.t('navigation.home')}</Text></ManagementGate>)
}

describe('management route permissions', () => {
  it('allows student-only users into Gestão and the student section', () => {
    mockPathname.current = '/professional/management/students/student/123'
    renderGate(STUDENT_READ)
    expect(screen.getByText('Início')).toBeOnTheScreen()
  })

  it('blocks a team deep link for student-only users', () => {
    mockPathname.current = '/professional/management/team'
    renderGate(STUDENT_READ)
    expect(screen.queryByText('Início')).toBeNull()
  })

  it('blocks a student deep link for team-only users', () => {
    mockPathname.current = '/professional/management/students'
    renderGate(TEAM_READ)
    expect(screen.queryByText('Início')).toBeNull()
  })
})
