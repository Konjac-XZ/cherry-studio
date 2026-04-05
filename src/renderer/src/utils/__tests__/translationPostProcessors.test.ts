import { describe, expect, it } from 'vitest'

import {
  applyTranslationPostProcessors,
  DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES,
  normalizeZhCnMarkdownQuotes,
  shouldApplyZhCnMarkdownSmartQuotes,
  type TranslationPostProcessorContext
} from '../translationPostProcessors'

const enabledContext = (overrides: Partial<TranslationPostProcessorContext> = {}): TranslationPostProcessorContext => ({
  features: {
    ...DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES,
    zhCnMarkdownSmartQuotes: true,
    ...overrides.features
  },
  markdownEnabled: true,
  targetLanguage: 'zh-cn',
  ...overrides
})

describe('translationPostProcessors', () => {
  describe('normalizeZhCnMarkdownQuotes', () => {
    it('converts standard prose double quotes to Chinese typography quotes', () => {
      expect(normalizeZhCnMarkdownQuotes('他说 "你好"。')).toBe('他说 “你好”。')
    })

    it('converts nested quotes', () => {
      expect(normalizeZhCnMarkdownQuotes('她说 "他回答 \'好的\'"。')).toBe('她说 “他回答 ‘好的’”。')
    })

    it('keeps apostrophes as right single quotes', () => {
      expect(normalizeZhCnMarkdownQuotes("don't I'm students'")).toBe('don’t I’m students’')
    })

    it('converts measurement primes instead of Chinese quotes', () => {
      expect(normalizeZhCnMarkdownQuotes('He is 6\'2" tall, the board is 5\' wide, and the pipe is 30".')).toBe(
        'He is 6′2″ tall, the board is 5′ wide, and the pipe is 30″.'
      )
    })

    it('skips fenced code blocks and inline code', () => {
      const input = ['```ts', 'const value = "test"', '```', '', '正文里的 "引号" 和 `const name = \"value\"`'].join(
        '\n'
      )
      const expected = ['```ts', 'const value = "test"', '```', '', '正文里的 “引号” 和 `const name = \"value\"`'].join(
        '\n'
      )
      expect(normalizeZhCnMarkdownQuotes(input)).toBe(expected)
    })

    it('skips math and html fragments while still processing surrounding prose', () => {
      const input = '正文 "引号"，公式 $f("x")$，以及 <span data-title="raw">"html"</span>。'
      const expected = '正文 “引号”，公式 $f("x")$，以及 <span data-title="raw">"html"</span>。'
      expect(normalizeZhCnMarkdownQuotes(input)).toBe(expected)
    })

    it('processes link text but skips link destination', () => {
      expect(normalizeZhCnMarkdownQuotes('["标题"](https://example.com/?q="raw")')).toBe(
        '[“标题”](https://example.com/?q="raw")'
      )
    })

    it('skips autolinks and bare URLs', () => {
      const input = '<https://example.com/?q="raw"> 和 https://example.com/?q="raw"'
      expect(normalizeZhCnMarkdownQuotes(input)).toBe(input)
    })

    it('processes headings, lists, and blockquotes as prose containers', () => {
      const input = ['# "标题"', '', '- "列表项"', '', '> "引用块"'].join('\n')
      const expected = ['# “标题”', '', '- “列表项”', '', '> “引用块”'].join('\n')
      expect(normalizeZhCnMarkdownQuotes(input)).toBe(expected)
    })

    it('pairs quotes across multiple text nodes inside formatting spans', () => {
      expect(normalizeZhCnMarkdownQuotes('他说 "这段 **加粗** 文本" 值得看。')).toBe(
        '他说 “这段 **加粗** 文本” 值得看。'
      )
    })

    it('handles mixed Chinese and English prose', () => {
      expect(normalizeZhCnMarkdownQuotes('Claude said "hello", 她回答 \'没问题\'。')).toBe(
        'Claude said “hello”, 她回答 ‘没问题’。'
      )
    })

    it('preserves unrelated markdown structure without stringify normalization', () => {
      const input = '段落前有 [link](https://example.com "title") 和 `code`，再说 "你好"。'
      const expected = '段落前有 [link](https://example.com "title") 和 `code`，再说 “你好”。'
      expect(normalizeZhCnMarkdownQuotes(input)).toBe(expected)
    })

    it('skips structured JSON-like paragraphs', () => {
      const input = '{"message": "hello", "path": "C:\\Temp\\app"}'
      expect(normalizeZhCnMarkdownQuotes(input)).toBe(input)
    })

    it('skips frontmatter and still processes later prose', () => {
      const input = ['---', 'title: "raw"', '---', '', '正文说 "你好"。'].join('\n')
      const expected = ['---', 'title: "raw"', '---', '', '正文说 “你好”。'].join('\n')
      expect(normalizeZhCnMarkdownQuotes(input)).toBe(expected)
    })
  })

  describe('applyTranslationPostProcessors', () => {
    it('applies the processor only for zh-cn markdown output when enabled', () => {
      expect(applyTranslationPostProcessors('他说 "你好"。', enabledContext())).toBe('他说 “你好”。')
    })

    it('does not apply when markdown is disabled', () => {
      expect(applyTranslationPostProcessors('他说 "你好"。', enabledContext({ markdownEnabled: false }))).toBe(
        '他说 "你好"。'
      )
    })

    it('does not apply when the feature switch is disabled', () => {
      expect(
        applyTranslationPostProcessors(
          '他说 "你好"。',
          enabledContext({ features: { zhCnMarkdownSmartQuotes: false } })
        )
      ).toBe('他说 "你好"。')
    })

    it('does not apply for non zh-cn targets', () => {
      expect(applyTranslationPostProcessors('他说 "你好"。', enabledContext({ targetLanguage: 'en-us' }))).toBe(
        '他说 "你好"。'
      )
    })

    it('exposes the same gate logic through shouldApplyZhCnMarkdownSmartQuotes', () => {
      expect(shouldApplyZhCnMarkdownSmartQuotes(enabledContext())).toBe(true)
      expect(shouldApplyZhCnMarkdownSmartQuotes(enabledContext({ targetLanguage: 'zh-tw' }))).toBe(false)
    })
  })
})
