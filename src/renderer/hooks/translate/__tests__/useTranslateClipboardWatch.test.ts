import type { ClipboardGateway, WindowGateway } from '@renderer/services/translatePlatform'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { MutableRefObject } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

  it('does not read while the page is busy', async () => {
    const state = setup({ busy: true })
    const { result } = renderHook(() => useTranslateClipboardWatch(state.params))
    act(() => result.current.toggle())
    await waitFor(() => expect(state.clipboardGateway.startWatch).toHaveBeenCalledOnce())
    expect(state.params.readClipboardPlainTextForWatch).not.toHaveBeenCalled()
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
