import type { StudentRecordOverview } from '@habituar/react-client/react-client'
import { render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { RECORD_STUDENT_ID, createRecordOverview } from './student-record-fixture'
import { StudentRegistrationScreen } from './student-registration-screen'

const mockClient: { overview: StudentRecordOverview | undefined } = { overview: undefined }

jest.mock('../client/habituar-client', () => ({
  habituar: { useStudentRecordOverview: () => mockClient.overview },
}))

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
}))

describe('student registration in the record', () => {
  it('shows the registration to read, with the guardian contact', () => {
    mockClient.overview = createRecordOverview()
    render(<StudentRegistrationScreen session={createInstitutionSession('professional')} studentId={RECORD_STUDENT_ID} />)

    expect(screen.getByText('09/03/2014')).toBeOnTheScreen()
    expect(screen.getByText('Marta Lima')).toBeOnTheScreen()
    expect(screen.getByText('Mãe · +55 51 99999-0000')).toBeOnTheScreen()
  })
})
