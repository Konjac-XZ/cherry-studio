import { act, renderHook, waitFor } from '@testing-library/react'
import type { MutableRefObject } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ClipboardGateway, WindowGateway } from '@renderer/services/translatePlatform'

import { useTranslateClipboardWatch } from '../useTranslateClipboardWatch'

const ref = <T>(current: T): MutableRefObject<T> => ({ current })

const setup = (overrides: { busy?: boolean; native?: boolean; plainValues?: string[]; lastWritten?: string } = {}) => {
  let changed: (() => void) | undefined
  const removeChanged = vi.fn()
  const removeUnavailable = vi.fn()
  const values = [...(overrides.plainValues ?? ['initial', 'changed'])]
  const clipboardGateway: ClipboardGateway = {
    readBrowserRich: vi.fn(),
    readBrowserPlainText: vi.fn(),
    readNative: vi.fn(),
    writeBrowserText: vi.fn(),
    writeNativeText: vi.fn(),
    startWatch: vi.fn(async () => overrides.native ?? true),
    stopWatch: vi.fn(async () => undefined),
    onChanged: vi.fn((callback) => {
      changed = callback
      return removeChanged
    }),
    onWatchUnavailable: vi.fn(() => removeUnavailable)
  }
  const windowGateway: WindowGateway = { focus: vi.fn(async () => undefined) }
  const params = {
    busy: overrides.busy ?? false,
    lastWrittenRef: ref(overrides.lastWritten ?? ''),
    onText: vi.fn(),
    readClipboardForTranslate: vi.fn(async () => 'rich changed'),
    readClipboardPlainTextForWatch: vi.fn(async () => values.shift() ?? 'changed'),
    clipboardGateway,
    windowGateway
  }
  return { changed: () => changed, clipboardGateway, params, removeChanged, removeUnavailable, windowGateway }
}

afterEach(() => vi.useRealTimers())

describe('useTranslateClipboardWatch', () => {
  it('uses the first value as baseline and translates the next native change', async () => {
    const state = setup()
    const { result } = renderHook(() => useTranslateClipboardWatch(state.params))
    act(() => result.current.toggle())
    await waitFor(() => expect(state.changed()).toBeDefined())

    await act(async () => state.changed()?.())

    await waitFor(() => expect(state.params.onText).toHaveBeenCalledWith('rich changed'))
    expect(state.windowGateway.focus).toHaveBeenCalledOnce()
  })

  it('suppresses unchanged and app-written clipboard values', async () => {
    const state = setup({ plainValues: ['initial', 'own output', 'own output'], lastWritten: 'own output' })
    const { result } = renderHook(() => useTranslateClipboardWatch(state.params))
    act(() => result.current.toggle())
    await waitFor(() => expect(state.changed()).toBeDefined())
    state.params.lastWrittenRef.current = 'own output'

    await act(async () => state.changed()?.())
    await act(async () => state.changed()?.())

    expect(state.params.onText).not.toHaveBeenCalled()
  })

  it('captures a baseline while busy and translates only the latest clipboard on becoming idle', async () => {
    const state = setup({ busy: true })
    let clipboard = 'initial'
    state.params.readClipboardPlainTextForWatch.mockImplementation(async () => clipboard)
    state.params.readClipboardForTranslate.mockImplementation(async () => clipboard)
    const { result, rerender } = renderHook((params) => useTranslateClipboardWatch(params), {
      initialProps: state.params
    })
    act(() => result.current.toggle())
    await act(async () => Promise.resolve())
    clipboard = 'B'
    await act(async () => state.changed()?.())
    clipboard = 'C'
    await act(async () => state.changed()?.())
    expect(state.params.onText).not.toHaveBeenCalled()
    rerender({ ...state.params, busy: false })
    await waitFor(() => expect(state.params.onText).toHaveBeenCalledExactlyOnceWith('C'))
  })

  it.each(['read', 'focus'] as const)('does not submit after disabling during %s', async (stage) => {
    const state = setup()
    let finish!: () => void
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    if (stage === 'read')
      state.params.readClipboardForTranslate.mockImplementationOnce(async () => {
        await pending
        return 'changed'
      })
    else state.windowGateway.focus = vi.fn(() => pending)
    const { result } = renderHook(() => useTranslateClipboardWatch(state.params))
    await act(async () => result.current.toggle())
    await act(async () => state.changed()?.())
    act(() => result.current.toggle())
    await act(async () => finish())
    expect(result.current.enabled).toBe(false)
    expect(state.params.onText).not.toHaveBeenCalled()
    if (stage === 'read') expect(state.windowGateway.focus).not.toHaveBeenCalled()
  })

  it('reconsiders unchanged clipboard text after a read is interrupted by a busy period', async () => {
    const state = setup()
    let finish!: (text: string) => void
    state.params.readClipboardForTranslate.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        })
    )
    const { result, rerender } = renderHook((params) => useTranslateClipboardWatch(params), {
      initialProps: state.params
    })
    await act(async () => result.current.toggle())
    await act(async () => state.changed()?.())
    rerender({ ...state.params, busy: true })
    await act(async () => finish('rich changed'))
    expect(state.params.onText).not.toHaveBeenCalled()
    rerender(state.params)
    await waitFor(() => expect(state.params.onText).toHaveBeenCalledExactlyOnceWith('rich changed'))
  })

  it('translates the first nonempty clipboard after enabling on an empty clipboard', async () => {
    const state = setup({ plainValues: ['', 'changed'] })
    const { result } = renderHook(() => useTranslateClipboardWatch(state.params))
    await act(async () => result.current.toggle())
    await act(async () => state.changed()?.())
    expect(state.params.onText).toHaveBeenCalledExactlyOnceWith('rich changed')
  })

  it('polls when native watch is unavailable and stops on disable', async () => {
    vi.useFakeTimers()
    const state = setup({ native: false, plainValues: ['initial', 'changed'] })
    const { result } = renderHook(() => useTranslateClipboardWatch(state.params))
    act(() => result.current.toggle())
    await act(async () => Promise.resolve())
    const baselineReads = vi.mocked(state.params.readClipboardPlainTextForWatch).mock.calls.length

    await act(async () => vi.advanceTimersByTimeAsync(500))
    expect(state.params.readClipboardPlainTextForWatch).toHaveBeenCalledTimes(baselineReads + 1)

    act(() => result.current.toggle())
    expect(state.clipboardGateway.stopWatch).toHaveBeenCalledOnce()
  })

  it('removes both event subscriptions when unmounted', async () => {
    const state = setup()
    const { result, unmount } = renderHook(() => useTranslateClipboardWatch(state.params))
    act(() => result.current.toggle())
    await waitFor(() => expect(state.changed()).toBeDefined())
    unmount()

    expect(state.removeChanged).toHaveBeenCalledOnce()
    expect(state.removeUnavailable).toHaveBeenCalledOnce()
    expect(state.clipboardGateway.stopWatch).toHaveBeenCalledOnce()
  })
})
