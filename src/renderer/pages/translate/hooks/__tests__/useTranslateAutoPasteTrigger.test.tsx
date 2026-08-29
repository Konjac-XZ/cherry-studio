// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: { paste: 1, _: 'nonce-1' } as Record<string, unknown>
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => routerMocks.navigate,
  useSearch: () => routerMocks.search
}))

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({ info: vi.fn(), warn: vi.fn() })
  }
}))

import { useTranslateAutoPasteTrigger } from '../useTranslateAutoPasteTrigger'

const createProps = () => ({
  busy: false,
  notReadyReason: 'model-unavailable' as const,
  prepareInput: vi.fn(),
  readClipboardForTranslate: vi.fn(async () => 'clipboard text'),
  ready: true,
  trigger: vi.fn(async () => undefined)
})

describe('useTranslateAutoPasteTrigger', () => {
  beforeEach(() => {
    routerMocks.search = { paste: 1, _: 'nonce-1' }
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('reads through the Translate clipboard policy and translates once without overriding the source language', async () => {
    const props = createProps()
    renderHook(() => useTranslateAutoPasteTrigger(props))

    await waitFor(() => expect(props.trigger).toHaveBeenCalledTimes(1))

    expect(props.readClipboardForTranslate).toHaveBeenCalledTimes(1)
    expect(props.prepareInput).toHaveBeenCalledWith('clipboard text')
    expect(props.trigger).toHaveBeenCalledWith(undefined, 'clipboard text', {
      sourcePreprocessed: true
    })
    expect(sessionStorage.getItem('translate:paste:nonce:nonce-1')).toBe('1')
    expect(routerMocks.navigate).toHaveBeenCalledWith({ to: '/app/translate', replace: true })
  })

  it('preserves the route command until a translation model is available', async () => {
    const props = createProps()
    props.ready = false
    const { rerender } = renderHook(() => useTranslateAutoPasteTrigger(props))

    expect(props.readClipboardForTranslate).not.toHaveBeenCalled()

    props.ready = true
    rerender()
    await waitFor(() => expect(props.readClipboardForTranslate).toHaveBeenCalledTimes(1))
  })

  it('keeps one clipboard read alive across callback-only rerenders', async () => {
    let resolveClipboard!: (text: string) => void
    const clipboardPending = new Promise<string>((resolve) => {
      resolveClipboard = resolve
    })
    const props = createProps()
    props.readClipboardForTranslate.mockImplementation(() => clipboardPending)
    const { rerender } = renderHook(() => useTranslateAutoPasteTrigger(props))

    await waitFor(() => expect(props.readClipboardForTranslate).toHaveBeenCalledTimes(1))
    const latestTrigger = vi.fn(async () => undefined)
    props.trigger = latestTrigger
    rerender()
    resolveClipboard('clipboard text')

    await waitFor(() => expect(latestTrigger).toHaveBeenCalledTimes(1))
    expect(props.readClipboardForTranslate).toHaveBeenCalledTimes(1)
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
