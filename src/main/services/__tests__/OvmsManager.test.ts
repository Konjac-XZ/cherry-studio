import { describe, expect, it, vi } from 'vitest'

import { parseOvmsProcessIds, stopOvmsProcessIds } from '@main/services/OvmsManager'

describe('OvmsManager shutdown helpers', () => {
  it('parses no, one, and many PowerShell process ids', () => {
    expect(parseOvmsProcessIds('')).toEqual([])
    expect(parseOvmsProcessIds('123')).toEqual([123])
    expect(parseOvmsProcessIds('[123,456,123]')).toEqual([123, 456])
  })

  it('attempts every pid and reports the first partial failure', async () => {
    const stop = vi
      .fn()
      .mockResolvedValueOnce({ success: false, message: 'first failed' })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, message: 'later failed' })

    await expect(stopOvmsProcessIds([1, 2, 3], stop)).resolves.toEqual({ success: false, message: 'first failed' })
    expect(stop.mock.calls.map(([pid]) => pid)).toEqual([1, 2, 3])
  })
})
