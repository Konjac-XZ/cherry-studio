import { describe, expect, it } from 'vitest'

import {
  applyRegexReplacementRules,
  applyTranslationPostProcessors,
  normalizeZhCnMarkdownQuotes,
  normalizeZhMarkdownTextSpacing,
  type RegexReplacementRule,
  shouldApplyZhCnMarkdownSmartQuotes,
  shouldApplyZhMarkdownTextSpacing,
  type TranslationPostProcessorContext
} from '../translationPostProcessors'

type TestContextOverrides = Omit<Partial<TranslationPostProcessorContext>, 'features'> & {
  features?: Partial<TranslationPostProcessorContext['features']>
}

const enabledContext = (overrides: TestContextOverrides = {}): TranslationPostProcessorContext => {
  const featureOverrides = overrides.features

  return {
    features: {
      zhCnMarkdownSmartQuotes: featureOverrides?.zhCnMarkdownSmartQuotes ?? true,
      zhMarkdownTextSpacing: featureOverrides?.zhMarkdownTextSpacing ?? true
    },
    markdownEnabled: overrides.markdownEnabled ?? true,
    targetLanguage: overrides.targetLanguage ?? 'zh-cn'
  }
}

describe('translationPostProcessors', () => {
  describe('normalizeZhCnMarkdownQuotes', () => {
    it('converts standard prose double quotes to Chinese typography quotes', () => {
      expect(normalizeZhCnMarkdownQuotes('他说"你好"。')).toBe('他说“你好”。')
    })

    it('converts nested quotes', () => {
      expect(normalizeZhCnMarkdownQuotes('她说"他回答\'好的\'"。')).toBe('她说“他回答‘好的’”。')
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
      const input = ['```ts', 'const value = "test"', '```', '', '正文里的"引号"和 `const name = "value"`'].join('\n')
      const expected = ['```ts', 'const value = "test"', '```', '', '正文里的“引号”和 `const name = "value"`'].join(
        '\n'
      )
      expect(normalizeZhCnMarkdownQuotes(input)).toBe(expected)
    })

    it('skips math and html fragments while still processing surrounding prose', () => {
      const input = '正文"引号"，公式 $f("x")$，以及 <span data-title="raw">"html"</span>。'
      const expected = '正文“引号”，公式 $f("x")$，以及 <span data-title="raw">"html"</span>。'
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
      expect(normalizeZhCnMarkdownQuotes('他说"这段**加粗**文本"值得看。')).toBe('他说“这段**加粗**文本”值得看。')
    })

    it('handles mixed Chinese and English prose', () => {
      expect(normalizeZhCnMarkdownQuotes('Claude said "hello", 她回答\'没问题\'。')).toBe(
        'Claude said “hello”, 她回答‘没问题’。'
      )
    })

    it('preserves unrelated markdown structure without stringify normalization', () => {
      const input = '段落前有 [link](https://example.com "title") 和 `code`，再说"你好"。'
      const expected = '段落前有 [link](https://example.com "title") 和 `code`，再说“你好”。'
      expect(normalizeZhCnMarkdownQuotes(input)).toBe(expected)
    })

    it('skips structured JSON-like paragraphs', () => {
      const input = '{"message": "hello", "path": "C:\\Temp\\app"}'
      expect(normalizeZhCnMarkdownQuotes(input)).toBe(input)
    })

    it('skips frontmatter and still processes later prose', () => {
      const input = ['---', 'title: "raw"', '---', '', '正文说"你好"。'].join('\n')
      const expected = ['---', 'title: "raw"', '---', '', '正文说“你好”。'].join('\n')
      expect(normalizeZhCnMarkdownQuotes(input)).toBe(expected)
    })
  })

  describe('applyTranslationPostProcessors', () => {
    it('applies the processor only for zh-cn markdown output when enabled', () => {
      expect(applyTranslationPostProcessors('他说"你好"。', enabledContext())).toBe('他说“你好”。')
    })

    it('does not apply when markdown is disabled', () => {
      expect(applyTranslationPostProcessors('他说"你好"。', enabledContext({ markdownEnabled: false }))).toBe(
        '他说"你好"。'
      )
    })

    it('does not apply when the feature switch is disabled', () => {
      expect(
        applyTranslationPostProcessors('他说"你好"。', enabledContext({ features: { zhCnMarkdownSmartQuotes: false } }))
      ).toBe('他说"你好"。')
    })

    it('does not apply for non zh-cn targets', () => {
      expect(applyTranslationPostProcessors('他说"你好"。', enabledContext({ targetLanguage: 'en-us' }))).toBe(
        '他说"你好"。'
      )
    })

    it('exposes the same gate logic through shouldApplyZhCnMarkdownSmartQuotes', () => {
      expect(shouldApplyZhCnMarkdownSmartQuotes(enabledContext())).toBe(true)
      expect(shouldApplyZhCnMarkdownSmartQuotes(enabledContext({ targetLanguage: 'zh-tw' }))).toBe(false)
    })

    it('applies zh markdown text spacing for zh-cn and zh-tw when enabled', () => {
      expect(
        applyTranslationPostProcessors('这是OpenAI开发的模型。', enabledContext({ targetLanguage: 'zh-cn' }))
      ).toBe('这是 OpenAI 开发的模型。')
      expect(
        applyTranslationPostProcessors('這是OpenAI開發的模型。', enabledContext({ targetLanguage: 'zh-tw' }))
      ).toBe('這是 OpenAI 開發的模型。')
    })

    it('does not apply zh markdown text spacing when markdown is disabled', () => {
      expect(
        applyTranslationPostProcessors(
          '这是OpenAI开发的模型。',
          enabledContext({ markdownEnabled: false, targetLanguage: 'zh-cn' })
        )
      ).toBe('这是OpenAI开发的模型。')
    })

    it('does not apply zh markdown text spacing when feature switch is disabled', () => {
      expect(
        applyTranslationPostProcessors(
          '这是OpenAI开发的模型。',
          enabledContext({ features: { zhMarkdownTextSpacing: false }, targetLanguage: 'zh-cn' })
        )
      ).toBe('这是OpenAI开发的模型。')
    })

    it('does not apply zh markdown text spacing for non-Chinese targets', () => {
      expect(
        applyTranslationPostProcessors('这是OpenAI开发的模型。', enabledContext({ targetLanguage: 'en-us' }))
      ).toBe('这是OpenAI开发的模型。')
    })

    it('applies smart quotes before spacing when both are enabled', () => {
      expect(applyTranslationPostProcessors('他说"OpenAI"很厉害。', enabledContext({ targetLanguage: 'zh-cn' }))).toBe(
        '他说“OpenAI”很厉害。'
      )
    })

    it('exposes zh markdown spacing gate logic through shouldApplyZhMarkdownTextSpacing', () => {
      expect(shouldApplyZhMarkdownTextSpacing(enabledContext({ targetLanguage: 'zh-cn' }))).toBe(true)
      expect(shouldApplyZhMarkdownTextSpacing(enabledContext({ targetLanguage: 'zh-tw' }))).toBe(true)
      expect(shouldApplyZhMarkdownTextSpacing(enabledContext({ targetLanguage: 'en-us' }))).toBe(false)
    })
  })

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
  })

  describe('applyRegexReplacementRules', () => {
    const rule = (pattern: string, replacement: string, flags = 'g'): RegexReplacementRule => ({
      id: pattern,
      pattern,
      flags,
      replacement
    })

    it('returns text unchanged when no rules are provided', () => {
      expect(applyRegexReplacementRules('hello world', [])).toBe('hello world')
    })

    it('applies a simple string replacement', () => {
      expect(applyRegexReplacementRules('foo bar foo', [rule('foo', 'baz')])).toBe('baz bar baz')
    })

    it('applies replacement with capture groups', () => {
      expect(applyRegexReplacementRules('2024-01-15', [rule('(\\d{4})-(\\d{2})-(\\d{2})', '$3/$2/$1')])).toBe(
        '15/01/2024'
      )
    })

    it('applies multiple rules sequentially', () => {
      const rules = [rule('foo', 'bar'), rule('bar', 'baz')]
      expect(applyRegexReplacementRules('foo', rules)).toBe('baz')
    })

    it('skips invalid regex patterns without throwing', () => {
      const badRule = rule('[(', 'replacement')
      expect(applyRegexReplacementRules('hello', [badRule])).toBe('hello')
    })

    it('skips invalid flags without throwing', () => {
      const badRule = rule('hello', 'hi', 'z')
      expect(applyRegexReplacementRules('hello world', [badRule])).toBe('hello world')
    })

    it('applies case-insensitive matching when i flag is set', () => {
      expect(applyRegexReplacementRules('Hello HELLO hello', [rule('hello', 'hi', 'gi')])).toBe('hi hi hi')
    })

    it('applies only the first match when g flag is absent', () => {
      expect(applyRegexReplacementRules('foo foo foo', [rule('foo', 'bar', '')])).toBe('bar foo foo')
    })

    it("leaves other rules's output intact if one rule has invalid pattern", () => {
      const rules = [rule('[(', 'bad'), rule('world', 'earth')]
      expect(applyRegexReplacementRules('hello world', rules)).toBe('hello earth')
    })
  })

  describe('applyTranslationPostProcessors with regex rules', () => {
    const regexContext = (rules: RegexReplacementRule[]): TranslationPostProcessorContext => ({
      features: {
        zhCnMarkdownSmartQuotes: false,
        zhMarkdownTextSpacing: false
      },
      markdownEnabled: false,
      targetLanguage: 'en-us',
      regexReplacementRules: rules
    })

    it('does not apply regex processor when regexReplacementRules is empty', () => {
      expect(applyTranslationPostProcessors('hello', regexContext([]))).toBe('hello')
    })

    it('does not apply regex processor when regexReplacementRules is absent', () => {
      const ctx: TranslationPostProcessorContext = {
        features: { zhCnMarkdownSmartQuotes: false, zhMarkdownTextSpacing: false },
        markdownEnabled: false,
        targetLanguage: 'en-us'
      }
      expect(applyTranslationPostProcessors('hello', ctx)).toBe('hello')
    })

    it('applies regex rules when provided', () => {
      const rules: RegexReplacementRule[] = [{ id: '1', pattern: 'foo', flags: 'g', replacement: 'bar' }]
      expect(applyTranslationPostProcessors('foo baz foo', regexContext(rules))).toBe('bar baz bar')
    })

    it('applies regex rules after other post-processors', () => {
      // Both zh spacing and regex operate; regex must run after spacing
      const ctx: TranslationPostProcessorContext = {
        features: { zhCnMarkdownSmartQuotes: false, zhMarkdownTextSpacing: true },
        markdownEnabled: true,
        targetLanguage: 'zh-cn',
        regexReplacementRules: [{ id: '1', pattern: 'OpenAI', flags: 'g', replacement: 'AI' }]
      }
      expect(applyTranslationPostProcessors('这是OpenAI开发的模型。', ctx)).toBe('这是 AI 开发的模型。')
    })
  })
})
