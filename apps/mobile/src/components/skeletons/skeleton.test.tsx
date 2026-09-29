import { act, render, screen } from '@testing-library/react-native'
import '../../i18n/i18n'
import { ListSectionSkeleton } from './list-section-skeleton'
import { SKELETON_DELAY_MS, Skeleton } from './skeleton'

describe('skeleton', () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.useRealTimers() })

  it('stays hidden while loading is fast, so a quick response does not flash placeholders', () => {
    render(<Skeleton><ListSectionSkeleton rows={3} /></Skeleton>)

    act(() => { jest.advanceTimersByTime(SKELETON_DELAY_MS - 1) })

    expect(screen.queryByRole('progressbar')).not.toBeOnTheScreen()
  })

  it('announces loading once after the delay instead of exposing each placeholder', () => {
    render(<Skeleton><ListSectionSkeleton rows={3} /></Skeleton>)

    act(() => { jest.advanceTimersByTime(SKELETON_DELAY_MS) })

    expect(screen.getAllByRole('progressbar', { name: 'Carregando...' })).toHaveLength(1)
  })
})
