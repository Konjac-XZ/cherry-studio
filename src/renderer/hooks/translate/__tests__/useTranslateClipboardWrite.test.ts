import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClipboardGateway } from '@renderer/services/translatePlatform'

import { useTranslateClipboardWrite } from '../useTranslateClipboardWrite'

vi.mock('@logger', () => ({
  loggerService: { withContext: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }) }
}))

const setCopied = vi.hoisted(() => vi.fn())
vi.mock('@renderer/hooks/useTemporaryValue', () => ({ useTemporaryValue: () => [false, setCopied] }))

const gateway = (overrides: Partial<ClipboardGateway> = {}): ClipboardGateway => ({
  readBrowserRich: vi.fn(),
  readBrowserPlainText: vi.fn(),
  readNative: vi.fn(),
  writeBrowserText: vi.fn(async () => undefined),
  writeNativeText: vi.fn(async () => undefined),
  startWatch: vi.fn(),
  stopWatch: vi.fn(),
  onChanged: vi.fn(() => vi.fn()),
  onWatchUnavailable: vi.fn(() => vi.fn()),
  ...overrides
})

describe('useTranslateClipboardWrite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks the normalized write fingerprint before browser clipboard write', async () => {
    let observedFingerprint = ''
    const clipboardGateway = gateway({
      writeBrowserText: vi.fn(async () => {
        observedFingerprint = result.current.lastWrittenRef.current
      })
    })
    const { result } = renderHook(() => useTranslateClipboardWrite(clipboardGateway))

    await act(() => result.current.copy('output\r\n'))

    expect(observedFingerprint).toBe('output')
    expect(clipboardGateway.writeNativeText).not.toHaveBeenCalled()
    expect(setCopied).toHaveBeenCalledWith(true)
  })

  it('falls back to typed native IPC when browser write fails', async () => {
    const clipboardGateway = gateway({
      writeBrowserText: vi.fn(async () => {
        throw new Error('permission denied')
      })
    })
    const { result } = renderHook(() => useTranslateClipboardWrite(clipboardGateway))

    await act(() => result.current.copy('translated output'))

    expect(clipboardGateway.writeNativeText).toHaveBeenCalledWith('translated output')
    expect(result.current.lastWrittenRef.current).toBe('translated output')
  })
})
