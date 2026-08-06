import { describe, expect, it } from 'vitest'

import {
  htmlToTranslateMarkdown,
  shouldPreferPlainTextClipboard,
  shouldPreferPlainTextCodeBlock
} from '../clipboardMarkdown'

describe('translate clipboard Markdown selection', () => {
  it('preserves authoritative Markdown headings from syntax-highlight wrappers', () => {
    const plainText = '# Heading\n\n- first\n- second'
    const html = '<div><span style="color:#569cd6">#</span><span> Heading</span><br><br><span>- first</span></div>'

    expect(shouldPreferPlainTextClipboard(html, plainText)).toBe(true)
  })

  it('preserves Markdown quotes and numbered lists from wrapper-only HTML', () => {
    expect(shouldPreferPlainTextClipboard('<div><span>&gt; quote</span></div>', '> quote\n\n1. item')).toBe(true)
  })

  it('retains HTML conversion when genuine rich semantics are present', () => {
    const html = '<div><strong># Heading</strong><ul><li>item</li></ul></div>'
    expect(shouldPreferPlainTextClipboard(html, '# Heading\n\n- item')).toBe(false)
    expect(htmlToTranslateMarkdown(html)).toContain('**\\# Heading**')
  })

  it('does not classify ordinary wrapper text as authoritative Markdown', () => {
    expect(shouldPreferPlainTextClipboard('<div><span>ordinary text</span></div>', 'ordinary text')).toBe(false)
  })

  it('recognizes fenced and indented code blocks', () => {
    expect(shouldPreferPlainTextCodeBlock('<pre>code</pre>', '```ts\ncode\n```')).toBe(true)
    expect(shouldPreferPlainTextCodeBlock('<code>code</code>', '    code')).toBe(true)
  })

  it('preserves Typora fence language and indentation', () => {
    expect(
      htmlToTranslateMarkdown('<pre class="md-fences" data-lang="ts"><code>if (ok) {\n  run()\n}</code></pre>')
    ).toBe('```ts\nif (ok) {\n  run()\n}\n```')
  })
})
