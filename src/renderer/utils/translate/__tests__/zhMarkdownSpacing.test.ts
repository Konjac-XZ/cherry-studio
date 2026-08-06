import { describe, expect, it } from 'vitest'

import { normalizeZhMarkdownTextSpacing } from '../zhMarkdownSpacing'

describe('normalizeZhMarkdownTextSpacing', () => {
  it('adds spacing across emphasis boundaries and inside table cells without changing Markdown structure', () => {
    const input = [
      '这是**OpenAI**开发的模型。',
      '',
      '| 名称 | 描述 |',
      '| --- | --- |',
      '| GPT-4 | 由OpenAI开发 |'
    ].join('\n')
    const expected = [
      '这是 **OpenAI** 开发的模型。',
      '',
      '| 名称 | 描述 |',
      '| --- | --- |',
      '| GPT-4 | 由 OpenAI 开发 |'
    ].join('\n')

    expect(normalizeZhMarkdownTextSpacing(input)).toBe(expected)
  })

  it('preserves inline/fenced code, math, and HTML contents while spacing their prose boundaries', () => {
    const input = [
      '```ts',
      'const foo="bar"',
      '```',
      '',
      '请调用`fooBar()`函数，设函数为$f(x)=x^2$，并展示<span>OpenAI测试</span>。'
    ].join('\n')
    const expected = [
      '```ts',
      'const foo="bar"',
      '```',
      '',
      '请调用 `fooBar()` 函数，设函数为 $f(x)=x^2$，并展示 <span>OpenAI测试</span>。'
    ].join('\n')

    expect(normalizeZhMarkdownTextSpacing(input)).toBe(expected)
  })

  it('preserves link destinations, autolinks, URLs, and filesystem paths', () => {
    const input = [
      '访问[OpenAI文档](https://example.com/中文?q=OpenAI测试)。',
      '网址https://example.com/中文?q=OpenAI测试和<https://example.com/中文?q=OpenAI测试>。',
      '路径C:\\Program Files\\Cherry Studio\\app.exe和/usr/local/bin/cherry-studio保持不变。'
    ].join('\n')
    const expected = [
      '访问 [OpenAI 文档](https://example.com/中文?q=OpenAI测试)。',
      '网址 https://example.com/中文?q=OpenAI测试和 <https://example.com/中文?q=OpenAI测试>。',
      '路径 C:\\Program Files\\Cherry Studio\\app.exe 和/usr/local/bin/cherry-studio 保持不变。'
    ].join('\n')

    expect(normalizeZhMarkdownTextSpacing(input)).toBe(expected)
  })

  it('keeps compact slash compounds and hyphenated identifiers intact while spacing their boundaries', () => {
    expect(normalizeZhMarkdownTextSpacing('在macOS/Linux上使用HTTP/2和cherry-studio处理Zynq/PYNQ开发板。')).toBe(
      '在 macOS/Linux 上使用 HTTP/2 和 cherry-studio 处理 Zynq/PYNQ 开发板。'
    )
  })

  it('spaces file extensions adjacent to Chinese prose without changing the extension', () => {
    expect(normalizeZhMarkdownTextSpacing('镜像是.zip压缩包，选择.img镜像。')).toBe(
      '镜像是 .zip 压缩包，选择 .img 镜像。'
    )
  })

  it('preserves frontmatter, structured JSON/YAML, and shell-like input', () => {
    const frontmatter = ['---', 'title: OpenAI测试', '---', '', '正文OpenAI测试。'].join('\n')
    expect(normalizeZhMarkdownTextSpacing(frontmatter)).toBe(
      ['---', 'title: OpenAI测试', '---', '', '正文 OpenAI 测试。'].join('\n')
    )
    expect(normalizeZhMarkdownTextSpacing('{"message":"OpenAI测试"}')).toBe('{"message":"OpenAI测试"}')
    expect(normalizeZhMarkdownTextSpacing('name: OpenAI测试')).toBe('name: OpenAI测试')
    expect(normalizeZhMarkdownTextSpacing('pnpm run测试')).toBe('pnpm run测试')
  })

  it('does not add spaces around Chinese fullwidth quotes, bold Chinese text, or em dashes', () => {
    const input = '在你的实际设置中，“阴性”**不只是**证据——而是**明确结论**。'
    expect(normalizeZhMarkdownTextSpacing(input)).toBe(input)
  })
})
