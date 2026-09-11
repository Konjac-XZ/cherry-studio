import { act, renderHook } from '@testing-library/react'
import type { MouseEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { useTranslateInvocationMode } from '../useTranslateInvocationMode'

describe('useTranslateInvocationMode', () => {
  it('uses normal translation by default and persistent polish when enabled', async () => {
    const run = vi.fn(async () => undefined)
    const { result, rerender } = renderHook(
      ({ enabled }) => useTranslateInvocationMode({ persistentPolishEnabled: enabled, run }),
      { initialProps: { enabled: false } }
    )

    await act(async () => result.current.trigger())
    expect(run).toHaveBeenLastCalledWith(false, undefined, 'translate')

    rerender({ enabled: true })
    await act(async () => result.current.trigger())
    expect(run).toHaveBeenLastCalledWith(false, undefined, 'polish_then_translate')
  })

  it('uses temporary Alt mode and resets it on keyup and window blur', async () => {
    const run = vi.fn(async () => undefined)
    const { result } = renderHook(() => useTranslateInvocationMode({ persistentPolishEnabled: false, run }))

    void act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' })))
    await act(async () => result.current.trigger())
    expect(run).toHaveBeenLastCalledWith(false, undefined, 'polish_then_translate')

    void act(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt' })))
    await act(async () => result.current.trigger())
    expect(run).toHaveBeenLastCalledWith(false, undefined, 'translate')

    void act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' })))
    void act(() => window.dispatchEvent(new Event('blur')))
    await act(async () => result.current.trigger())
    expect(run).toHaveBeenLastCalledWith(false, undefined, 'translate')
  })

  it('treats Alt-click as one-shot polish and plain Ctrl-click as force refresh', async () => {
    const run = vi.fn(async () => undefined)
    const { result } = renderHook(() => useTranslateInvocationMode({ persistentPolishEnabled: false, run }))

    await act(async () =>
      result.current.handlePrimaryClick({
        altKey: true,
        ctrlKey: true,
        metaKey: false,
        shiftKey: false
      } as MouseEvent<HTMLButtonElement>)
    )
    expect(run).toHaveBeenLastCalledWith(false, undefined, 'polish_then_translate')

    await act(async () =>
      result.current.handlePrimaryClick({
        altKey: false,
        ctrlKey: true,
        metaKey: false,
        shiftKey: false
      } as MouseEvent<HTMLButtonElement>)
    )
    expect(run).toHaveBeenLastCalledWith(true, undefined, 'translate')
  })

  it('clears temporary Alt mode during Activity cleanup', async () => {
    const run = vi.fn(async () => undefined)
    const { result, unmount } = renderHook(() => useTranslateInvocationMode({ persistentPolishEnabled: false, run }))

    void act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' })))
    const trigger = result.current.trigger
    unmount()

    await trigger()
    expect(run).toHaveBeenLastCalledWith(false, undefined, 'translate')
  })
})
