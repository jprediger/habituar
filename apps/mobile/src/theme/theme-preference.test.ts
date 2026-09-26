import type { ThemePreference, ThemePreferenceStorage } from './theme-preference'
import { createThemePreferenceStore } from './theme-preference'

function createMemoryStorage(initial: string | null): ThemePreferenceStorage & { saved: () => string | null } {
  let value = initial
  return {
    read: () => Promise.resolve(value),
    write: (next: ThemePreference) => {
      value = next
      return Promise.resolve()
    },
    saved: () => value,
  }
}

describe('theme preference', () => {
  it('stays loading until the saved choice has been read', () => {
    const store = createThemePreferenceStore({ storage: createMemoryStorage('dark'), applyColorScheme: jest.fn() })

    expect(store.getState()).toEqual({ status: 'loading' })
  })

  it('restores and applies the scheme chosen in a previous session', async () => {
    const applyColorScheme = jest.fn()
    const store = createThemePreferenceStore({ storage: createMemoryStorage('dark'), applyColorScheme })

    await store.load()

    expect(store.getState()).toEqual({ status: 'ready', preference: 'dark' })
    expect(applyColorScheme).toHaveBeenLastCalledWith('dark')
  })

  it('follows the system when nothing was chosen yet', async () => {
    const applyColorScheme = jest.fn()
    const store = createThemePreferenceStore({ storage: createMemoryStorage(null), applyColorScheme })

    await store.load()

    expect(store.getState()).toEqual({ status: 'ready', preference: 'system' })
    expect(applyColorScheme).toHaveBeenLastCalledWith('unspecified')
  })

  it('ignores a saved value it does not recognise instead of forcing a scheme', async () => {
    const applyColorScheme = jest.fn()
    const store = createThemePreferenceStore({ storage: createMemoryStorage('sepia'), applyColorScheme })

    await store.load()

    expect(store.getState()).toEqual({ status: 'ready', preference: 'system' })
    expect(applyColorScheme).toHaveBeenLastCalledWith('unspecified')
  })

  it('still opens the app on the system scheme when the saved choice cannot be read', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const store = createThemePreferenceStore({
      storage: { read: () => Promise.reject(new Error('disk')), write: () => Promise.resolve() },
      applyColorScheme: jest.fn(),
    })

    await store.load()

    expect(store.getState()).toEqual({ status: 'ready', preference: 'system' })
  })

  it('applies a new choice at once, tells listeners and remembers it for the next session', async () => {
    const storage = createMemoryStorage(null)
    const applyColorScheme = jest.fn()
    const listener = jest.fn()
    const store = createThemePreferenceStore({ storage, applyColorScheme })
    await store.load()
    store.subscribe(listener)

    store.select('light')

    expect(store.getState()).toEqual({ status: 'ready', preference: 'light' })
    expect(applyColorScheme).toHaveBeenLastCalledWith('light')
    expect(listener).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    expect(storage.saved()).toBe('light')
  })

  it('keeps the new choice for this session even when it cannot be saved', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const store = createThemePreferenceStore({
      storage: { read: () => Promise.resolve(null), write: () => Promise.reject(new Error('disk')) },
      applyColorScheme: jest.fn(),
    })
    await store.load()

    store.select('dark')
    await Promise.resolve()

    expect(store.getState()).toEqual({ status: 'ready', preference: 'dark' })
  })
})
