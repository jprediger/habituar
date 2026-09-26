import { describe, expect, it } from 'vitest'
import { cn } from './utils.js'

describe('class composition', () => {
  it('keeps the font size when a text color is also given', () => {
    expect(cn('text-body text-text')).toBe('text-body text-text')
  })

  it('lets a later project radius override an earlier one', () => {
    expect(cn('rounded-pill', 'rounded-control')).toBe('rounded-control')
  })
})
