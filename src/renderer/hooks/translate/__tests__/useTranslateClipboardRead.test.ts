import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ClipboardGateway } from '@renderer/services/translatePlatform'

import { useTranslateClipboardRead } from '../useTranslateClipboardRead'

vi.mock('@logger', () => ({
  loggerService: { withContext: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }) }
}))

const gateway = (overrides: Partial<ClipboardGateway> = {}): ClipboardGateway => ({
  readBrowserRich: vi.fn(async () => ({ html: '', plainText: '' })),
  readBrowserPlainText: vi.fn(async () => ''),
  readNative: vi.fn(async () => ({ html: '', plainText: 'native plain' })),
  writeBrowserText: vi.fn(),
  writeNativeText: vi.fn(),
  startWatch: vi.fn(async () => true),
  stopWatch: vi.fn(),
  onChanged: vi.fn(() => vi.fn()),
  onWatchUnavailable: vi.fn(() => vi.fn()),
  ...overrides
})

describe('useTranslateClipboardRead', () => {
  it('converts rich HTML before using its plain representation', async () => {
    const clipboardGateway = gateway({
      readBrowserRich: vi.fn(async () => ({ html: '<p><strong>rich</strong> text</p>', plainText: 'rich text' }))
    })
    const { result } = renderHook(() => useTranslateClipboardRead({ htmlConversionEnabled: true, clipboardGateway }))

    await expect(result.current.readClipboardForTranslate()).resolves.toBe('**rich** text')
    expect(clipboardGateway.readBrowserPlainText).not.toHaveBeenCalled()
  })

  it('keeps a fenced plain-text code block instead of reconverting HTML', async () => {
    const plainText = '```ts\nconst value = 1\n```'
    const clipboardGateway = gateway({
      readBrowserRich: vi.fn(async () => ({ html: '<pre><code>const value = 1</code></pre>', plainText }))
    })
    const { result } = renderHook(() => useTranslateClipboardRead({ htmlConversionEnabled: true, clipboardGateway }))

    await expect(result.current.readClipboardForTranslate()).resolves.toBe(plainText)
  })

  it('keeps authoritative Markdown from editor wrapper HTML', async () => {
    const plainText = '# Heading\n\n- item'
    const clipboardGateway = gateway({
      readBrowserRich: vi.fn(async () => ({
        html: '<div><span># Heading</span><br><span>- item</span></div>',
        plainText
      }))
    })
    const { result } = renderHook(() => useTranslateClipboardRead({ htmlConversionEnabled: true, clipboardGateway }))

    await expect(result.current.readClipboardForTranslate()).resolves.toBe(plainText)
  })

  it('formats recognized Markdown when clipboard formatting is enabled', async () => {
    const clipboardGateway = gateway({
      readBrowserRich: vi.fn(async () => ({ html: '', plainText: '# Heading\ntext\n\n* item' }))
    })
    const { result } = renderHook(() =>
      useTranslateClipboardRead({
        htmlConversionEnabled: false,
        markdownFormattingEnabled: true,
        clipboardGateway
      })
    )

    await expect(result.current.readClipboardForTranslate()).resolves.toBe('# Heading\n\ntext\n\n- item')
  })

  it('preprocesses clipboard text before formatting Markdown', async () => {
    const clipboardGateway = gateway({
      readBrowserRich: vi.fn(async () => ({ html: '', plainText: '# Heading\ntext\n\n* item' }))
    })
    const preprocessText = vi.fn((text: string) => text.replace('* item', '* normalized'))
    const { result } = renderHook(() =>
      useTranslateClipboardRead({
        htmlConversionEnabled: false,
        markdownFormattingEnabled: true,
        preprocessText,
        clipboardGateway
      })
    )

    await expect(result.current.readClipboardForTranslate()).resolves.toBe('# Heading\n\ntext\n\n- normalized')
    expect(preprocessText).toHaveBeenCalledWith('# Heading\ntext\n\n* item')
  })

  it('falls back through browser plain text to native clipboard', async () => {
    const clipboardGateway = gateway({
      readBrowserRich: vi.fn(async () => {
        throw new Error('denied')
      }),
      readBrowserPlainText: vi.fn(async () => {
        throw new Error('denied')
      })
    })
    const { result } = renderHook(() => useTranslateClipboardRead({ htmlConversionEnabled: true, clipboardGateway }))

    await expect(result.current.readClipboardForTranslate()).resolves.toBe('native plain')
  })

  it('uses native plain text as the watch fingerprint source', async () => {
    const clipboardGateway = gateway()
    const { result } = renderHook(() => useTranslateClipboardRead({ htmlConversionEnabled: true, clipboardGateway }))

    await expect(result.current.readClipboardPlainTextForWatch()).resolves.toBe('native plain')
    expect(clipboardGateway.readBrowserPlainText).not.toHaveBeenCalled()
  })
})
