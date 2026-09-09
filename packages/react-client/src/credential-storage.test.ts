import { describe, expect, it } from 'vitest'
import { createMemoryCredentialStorage } from './credential-storage.js'

describe('credential storage', () => {
  it('saves, restores and removes a mobile credential', async () => {
    const storage = createMemoryCredentialStorage()

    await storage.write('mobile-session-token')
    await expect(storage.read()).resolves.toBe('mobile-session-token')

    await storage.remove()
    await expect(storage.read()).resolves.toBeUndefined()
  })
})
