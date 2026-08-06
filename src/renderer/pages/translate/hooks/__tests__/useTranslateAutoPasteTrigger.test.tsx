// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: { paste: '1', _: 'nonce-1' } as Record<string, unknown>
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => routerMocks.navigate,
  useSearch: () => routerMocks.search
}))

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({ warn: vi.fn() })
  }
}))

import { useTranslateAutoPasteTrigger } from '../useTranslateAutoPasteTrigger'

const createProps = () => ({
  busy: false,
  prepareInput: vi.fn(),
  readClipboardForTranslate: vi.fn(async () => 'clipboard text'),
  ready: true,
  setSourceLanguageToAuto: vi.fn(async () => undefined),
  trigger: vi.fn(async () => undefined)
})

describe('useTranslateAutoPasteTrigger', () => {
  beforeEach(() => {
    routerMocks.search = { paste: '1', _: 'nonce-1' }
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('reads through the Translate clipboard policy, forces Auto, and translates once', async () => {
    const props = createProps()
    renderHook(() => useTranslateAutoPasteTrigger(props))

    await waitFor(() => expect(props.trigger).toHaveBeenCalledTimes(1))

    expect(props.readClipboardForTranslate).toHaveBeenCalledTimes(1)
    expect(props.setSourceLanguageToAuto).toHaveBeenCalledTimes(1)
    expect(props.prepareInput).toHaveBeenCalledWith('clipboard text')
    expect(props.trigger).toHaveBeenCalledWith(undefined, 'clipboard text', { sourceLanguage: 'auto' })
    expect(sessionStorage.getItem('translate:paste:nonce:nonce-1')).toBe('1')
    expect(routerMocks.navigate).toHaveBeenCalledWith({ to: '/app/translate', replace: true })
  })

  it('waits for page dependencies before consuming the route command', async () => {
    const props = createProps()
    props.ready = false
    const { rerender } = renderHook(() => useTranslateAutoPasteTrigger(props))

    expect(props.readClipboardForTranslate).not.toHaveBeenCalled()

    props.ready = true
    rerender()
    await waitFor(() => expect(props.readClipboardForTranslate).toHaveBeenCalledTimes(1))
  })

  it('suppresses a handled nonce across page recreation', async () => {
    sessionStorage.setItem('translate:paste:nonce:nonce-1', '1')
    const props = createProps()
    renderHook(() => useTranslateAutoPasteTrigger(props))

    await waitFor(() => expect(routerMocks.navigate).toHaveBeenCalledTimes(1))
    expect(props.readClipboardForTranslate).not.toHaveBeenCalled()
  })

  it('removes a running route command without starting a second flow', async () => {
    const props = createProps()
    props.busy = true
    renderHook(() => useTranslateAutoPasteTrigger(props))

    await waitFor(() => expect(routerMocks.navigate).toHaveBeenCalledTimes(1))
    expect(props.readClipboardForTranslate).not.toHaveBeenCalled()
    expect(props.trigger).not.toHaveBeenCalled()
  })
})
