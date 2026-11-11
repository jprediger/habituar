import { readInitialMinute } from './agenda-day-timeline'

describe('agenda day timeline opening position', () => {
  it('opens at the current time when nothing timed comes before it', () => {
    expect(readInitialMinute([16 * 60], 10 * 60)).toBe(10 * 60)
  })

  it('opens at the first timed item when it starts before the current time', () => {
    expect(readInitialMinute([9 * 60, 7 * 60], 10 * 60)).toBe(7 * 60)
  })

  it('opens in the morning, not at midnight, on a day without the current time or timed items', () => {
    expect(readInitialMinute([], undefined)).toBe(8 * 60)
  })
})
