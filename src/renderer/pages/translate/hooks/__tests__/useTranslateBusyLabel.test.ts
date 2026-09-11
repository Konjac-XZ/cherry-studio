import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type TranslateBusyStatus, useTranslateBusyLabel } from '../useTranslateBusyLabel'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('useTranslateBusyLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('updates the active status timer to one decimal place every 100 ms', () => {
    const { result } = renderHook(() => useTranslateBusyLabel('processing'))

    expect(result.current).toBe('translate.processing 0.0s')

    void act(() => vi.advanceTimersByTime(300))

    expect(result.current).toBe('translate.processing 0.3s')
  })

  it('restarts the timer when the visible status changes and clears it when idle', () => {
    const { result, rerender } = renderHook(
      ({ status }: { status: TranslateBusyStatus | null }) => useTranslateBusyLabel(status),
      { initialProps: { status: 'detecting' as TranslateBusyStatus | null } }
    )

    void act(() => vi.advanceTimersByTime(500))
    expect(result.current).toBe('translate.detecting 0.5s')

    rerender({ status: 'polishing' })
    expect(result.current).toBe('translate.polishing 0.0s')

    void act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe('translate.polishing 0.2s')

    rerender({ status: null })
    expect(result.current).toBeNull()
  })

  it('includes time elapsed before the hook mounts when given a workspace start time', () => {
    const startedAt = Date.now()
    vi.advanceTimersByTime(1200)

    const { result } = renderHook(() => useTranslateBusyLabel('processing', startedAt))

    expect(result.current).toBe('translate.processing 1.2s')
  })
})
