import { describe, expect, it } from 'vitest'

import { normalizeZhMarkdownTextSpacing } from '..'

describe('normalizeZhMarkdownTextSpacing', () => {
  it('adds spaces across formatting boundaries while keeping markdown markers', () => {
    expect(normalizeZhMarkdownTextSpacing('这是**OpenAI**开发的模型。')).toBe('这是 **OpenAI** 开发的模型。')
  })

  it('skips spacing changes inside inline code and fenced code blocks', () => {
    const input = ['```ts', 'const foo="bar"', '```', '', '请调用`fooBar()`函数'].join('\n')
    const expected = ['```ts', 'const foo="bar"', '```', '', '请调用 `fooBar()` 函数'].join('\n')
    expect(normalizeZhMarkdownTextSpacing(input)).toBe(expected)
  })

  it('skips spacing changes inside math and html fragments', () => {
    const input = '设函数为$f(x)=x^2$，并展示<span>OpenAI测试</span>。'
    const expected = '设函数为 $f(x)=x^2$，并展示 <span>OpenAI测试</span>。'
    expect(normalizeZhMarkdownTextSpacing(input)).toBe(expected)
  })

  it('processes table cell text without changing table structure', () => {
    const input = ['| 名称 | 描述 |', '| --- | --- |', '| GPT-4 | 由OpenAI开发 |'].join('\n')
    const expected = ['| 名称 | 描述 |', '| --- | --- |', '| GPT-4 | 由 OpenAI 开发 |'].join('\n')
    expect(normalizeZhMarkdownTextSpacing(input)).toBe(expected)
  })

  it('does not add spaces when fullwidth quotes are adjacent to Chinese bold text', () => {
    const input = '在你的实际设置中，“阴性”**不只是**证据的模糊缺失。'
    expect(normalizeZhMarkdownTextSpacing(input)).toBe(input)
  })

  it('adds space between bold text ending with ASCII and following Chinese character', () => {
    expect(normalizeZhMarkdownTextSpacing('**数据库 A**回答："我们目前对这个缺陷的判断是什么？"')).toBe(
      '**数据库 A** 回答："我们目前对这个缺陷的判断是什么？"'
    )
  })

  it('adds spaces between Chinese text and numbers inside bold spans', () => {
    expect(
      normalizeZhMarkdownTextSpacing(
        '你总共有**57个目标**，在目标层有**15个阴性**、**13个阳性**、**2个不确定**和**27个待分析**。'
      )
    ).toBe('你总共有 **57 个目标**，在目标层有 **15 个阴性**、**13 个阳性**、**2 个不确定**和 **27 个待分析**。')
  })

  it('does not add spaces #2', () => {
    expect(
      normalizeZhMarkdownTextSpacing(
        '是的，该论文描述了若干**不合规漏洞**的实例，这些漏洞对现有工具来说是“隐藏”的，因为它们不会引发崩溃，且通常涉及复杂的**多方通信逻辑**。'
      )
    ).toBe(
      '是的，该论文描述了若干**不合规漏洞**的实例，这些漏洞对现有工具来说是“隐藏”的，因为它们不会引发崩溃，且通常涉及复杂的**多方通信逻辑**。'
    )
  })

  it('real-world #0', () => {
    expect(
      normalizeZhMarkdownTextSpacing(
        '为了发现这类漏洞，MBFuzzer采用**differential testing**——即对比多个代理实现之间的差异——来找出不一致之处，这些不一致表明一个或多个实现未遵守共同的协议规范。'
      )
    ).toBe(
      '为了发现这类漏洞，MBFuzzer 采用 **differential testing**——即对比多个代理实现之间的差异——来找出不一致之处，这些不一致表明一个或多个实现未遵守共同的协议规范。'
    )
  })

  it('keeps existing spaces around markdown emphasis boundaries', () => {
    expect(normalizeZhMarkdownTextSpacing('点击 **Flash** 并等待验证完成。')).toBe('点击 **Flash** 并等待验证完成。')
  })

  it('does not expand compact slash compounds', () => {
    expect(normalizeZhMarkdownTextSpacing('安装/打开工具，在 macOS/Linux 上写入/烧录镜像。')).toBe(
      '安装/打开工具，在 macOS/Linux 上写入/烧录镜像。'
    )
  })

  it('adds spaces around file extensions adjacent to Chinese text', () => {
    expect(normalizeZhMarkdownTextSpacing('镜像是.zip压缩包，选择.img镜像。')).toBe(
      '镜像是 .zip 压缩包，选择 .img 镜像。'
    )
  })

  it('adds boundary spaces around protected slash compounds', () => {
    expect(normalizeZhMarkdownTextSpacing('在macOS/Linux上使用，插入Zynq/PYNQ开发板。')).toBe(
      '在 macOS/Linux 上使用，插入 Zynq/PYNQ 开发板。'
    )
  })
})
