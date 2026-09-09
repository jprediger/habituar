import { describe, expect, it } from 'vitest'
import { getHomeDestination } from './home-destination.js'

describe('getHomeDestination', () => {
  it('resolves every supported environment to its destination', () => {
    expect(getHomeDestination('student')).toBe('student-home')
    expect(getHomeDestination('professional')).toBe('professional-home')
    expect(getHomeDestination('monitor')).toBe('monitor-home')
  })
})
