import { describe, expect, it } from 'vitest'

import { normalizeEnMarkdownStraightQuotes, normalizeZhCnMarkdownQuotes } from '../postProcessors'

describe('translate Markdown quote normalization', () => {
  describe('normalizeZhCnMarkdownQuotes', () => {
    it.each([
      ['他说"你好"。', '他说“你好”。'],
      ['她说"他回答\'好的\'"。', '她说“他回答‘好的’”。'],
      ["don't I'm students'", 'don’t I’m students’'],
      [
        'He is 6\'2" tall, the board is 5\' wide, and the pipe is 30".',
        'He is 6′2″ tall, the board is 5′ wide, and the pipe is 30″.'
      ]
    ])('normalizes prose punctuation in %s', (input, expected) => {
      expect(normalizeZhCnMarkdownQuotes(input)).toBe(expected)
    })

    it('preserves code, math, and HTML while normalizing surrounding prose', () => {
      const input = [
        '```ts',
        'const value = "test"',
        '```',
        '',
        '正文"引号"，`const name = "value"`，公式 $f("x")$，以及 <span data-title="raw">"html"</span>。'
      ].join('\n')
      const expected = [
        '```ts',
        'const value = "test"',
        '```',
        '',
        '正文“引号”，`const name = "value"`，公式 $f("x")$，以及 <span data-title="raw">"html"</span>。'
      ].join('\n')

      expect(normalizeZhCnMarkdownQuotes(input)).toBe(expected)
    })

    it('normalizes link labels but preserves destinations, autolinks, and bare URLs', () => {
      expect(normalizeZhCnMarkdownQuotes('["标题"](https://example.com/?q="raw")')).toBe(
        '[“标题”](https://example.com/?q="raw")'
      )

      const urlInput = '<https://example.com/?q="raw"> 和 https://example.com/?q="raw"'
      expect(normalizeZhCnMarkdownQuotes(urlInput)).toBe(urlInput)
    })

    it('preserves frontmatter and structured text while processing later prose', () => {
      const input = [
        '---',
        'title: "raw"',
        '---',
        '',
        '{"message": "raw", "path": "C:\\Temp\\app"}',
        '',
        '正文说"你好"。'
      ].join('\n')
      const expected = [
        '---',
        'title: "raw"',
        '---',
        '',
        '{"message": "raw", "path": "C:\\Temp\\app"}',
        '',
        '正文说“你好”。'
      ].join('\n')

      expect(normalizeZhCnMarkdownQuotes(input)).toBe(expected)
    })

    it('preserves shell-like and filesystem-path structured lines', () => {
      const input = '命令 /usr/bin/printf "raw"；路径 C:\\Temp\\"raw"\\file.txt。'
      expect(normalizeZhCnMarkdownQuotes(input)).toBe(input)
    })
  })

  describe('normalizeEnMarkdownStraightQuotes', () => {
    it('normalizes smart quote variants without converting prime symbols', () => {
      expect(normalizeEnMarkdownStraightQuotes('He said “hello”, then ‚yes‛. He is 6′2″ tall.')).toBe(
        'He said "hello", then \'yes\'. He is 6′2″ tall.'
      )
    })

    it('preserves protected Markdown ranges while normalizing prose and link labels', () => {
      const input = [
        '---',
        'title: “raw”',
        '---',
        '',
        '```ts',
        'const value = “raw”',
        '```',
        '',
        '[“Label”](https://example.com/?q=“raw”) https://example.com/?q=“raw”',
        'Formula $f(“x”)$ and <span data-title="raw">“html”</span>.',
        'Plain “text” and `“code”`.'
      ].join('\n')
      const expected = [
        '---',
        'title: “raw”',
        '---',
        '',
        '```ts',
        'const value = “raw”',
        '```',
        '',
        '["Label"](https://example.com/?q=“raw”) https://example.com/?q=“raw”',
        'Formula $f(“x”)$ and <span data-title="raw">“html”</span>.',
        'Plain "text" and `“code”`.'
      ].join('\n')

      expect(normalizeEnMarkdownStraightQuotes(input)).toBe(expected)
    })
  })
})
