// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
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
  notReadyReason: 'model-unavailable' as const,
  readClipboardForTranslate: vi.fn(async () => 'clipboard text'),
  ready: true,
  trigger: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined)
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
    expect(props.trigger).toHaveBeenCalledWith(undefined, 'clipboard text', {
      replaceActive: true,
      updateSource: true,
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

  it('accepts a new nonce while the previous translation is still pending', async () => {
    const props = createProps()
    let finish!: () => void
    props.trigger.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const { rerender } = renderHook(() => useTranslateAutoPasteTrigger(props))
    await waitFor(() => expect(props.trigger).toHaveBeenCalledTimes(1))
    routerMocks.search = { paste: 1, _: 'nonce-2' }
    rerender()
    await waitFor(() => expect(props.trigger).toHaveBeenCalledTimes(2))
    await act(async () => finish())
    expect(sessionStorage.getItem('translate:paste:nonce:nonce-2')).toBe('1')
  })

  it.each(['', 'error'])('keeps the current task when clipboard reading yields %s', async (value) => {
    const props = createProps()
    if (value) props.readClipboardForTranslate.mockRejectedValueOnce(new Error('read failed'))
    else props.readClipboardForTranslate.mockResolvedValueOnce('')
    renderHook(() => useTranslateAutoPasteTrigger(props))
    await waitFor(() => expect(routerMocks.navigate).toHaveBeenCalledOnce())
    expect(props.trigger).not.toHaveBeenCalled()
  })

  it('discards an older clipboard read when a newer shortcut arrives', async () => {
    const props = createProps()
    let finish!: (text: string) => void
    props.readClipboardForTranslate.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        })
    )
    const { rerender } = renderHook(() => useTranslateAutoPasteTrigger(props))
    routerMocks.search = { paste: 1, _: 'nonce-2' }
    rerender()
    await waitFor(() => expect(props.trigger).toHaveBeenCalledOnce())
    await act(async () => finish('stale text'))
    expect(props.trigger).toHaveBeenCalledOnce()
    expect(props.trigger).toHaveBeenCalledWith(
      undefined,
      'clipboard text',
      expect.objectContaining({ replaceActive: true })
    )
  })
})
