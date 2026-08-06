import { describe, expect, it, vi } from 'vitest'

import { coordinateComposerInputTranslation } from '../composerInputTranslation'

const targetLanguage = 'en-us' as const

function createOptions(overrides: Record<string, unknown> = {}) {
  return {
    text: '你好',
    targetLanguage,
    signal: new AbortController().signal,
    translate: vi.fn().mockResolvedValue('Hello'),
    isCurrent: vi.fn(() => true),
    onTranslated: vi.fn(),
    onError: vi.fn(),
    onSettledFocus: vi.fn(),
    ...overrides
  }
}

describe('coordinateComposerInputTranslation', () => {
  it('applies a current result and restores focus after success', async () => {
    const options = createOptions()

    await coordinateComposerInputTranslation(options)

    expect(options.onTranslated).toHaveBeenCalledWith('Hello')
    expect(options.onError).not.toHaveBeenCalled()
    expect(options.onSettledFocus).toHaveBeenCalledOnce()
  })

  it.each([
    ['cancellation', new DOMException('cancelled', 'AbortError'), false],
    ['failure', new Error('provider failed'), true]
  ] as const)(
    'restores focus after a current %s and reports only real failures',
    async (_label, error, reportError) => {
      const options = createOptions({ translate: vi.fn().mockRejectedValue(error) })

      await coordinateComposerInputTranslation(options)

      expect(options.onTranslated).not.toHaveBeenCalled()
      expect(options.onError).toHaveBeenCalledTimes(reportError ? 1 : 0)
      expect(options.onSettledFocus).toHaveBeenCalledOnce()
    }
  )

  it('drops both the result and focus when the composer scope is no longer current', async () => {
    const options = createOptions({ isCurrent: vi.fn(() => false) })

    await coordinateComposerInputTranslation(options)

    expect(options.onTranslated).not.toHaveBeenCalled()
    expect(options.onError).not.toHaveBeenCalled()
    expect(options.onSettledFocus).not.toHaveBeenCalled()
  })
})
