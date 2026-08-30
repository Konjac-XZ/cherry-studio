import { describe, expect, it } from 'vitest'

import {
  applyRegexReplacementRules,
  applyRegexReplacementRulesThrough,
  applyTranslationPostProcessors,
  DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES,
  type RegexReplacementRule,
  shouldApplyEnMarkdownStraightQuotes,
  shouldApplyZhCnMarkdownSmartQuotes,
  shouldApplyZhMarkdownTextSpacing,
  type TranslationPostProcessorContext
} from '../postProcessors'

type ContextOverrides = Omit<Partial<TranslationPostProcessorContext>, 'features'> & {
  features?: Partial<TranslationPostProcessorContext['features']>
}

const enabledContext = (overrides: ContextOverrides = {}): TranslationPostProcessorContext => ({
  enabled: overrides.enabled,
  features: {
    enMarkdownStraightQuotes: overrides.features?.enMarkdownStraightQuotes ?? true,
    zhCnMarkdownSmartQuotes: overrides.features?.zhCnMarkdownSmartQuotes ?? true,
    zhMarkdownTextSpacing: overrides.features?.zhMarkdownTextSpacing ?? true
  },
  markdownEnabled: overrides.markdownEnabled ?? true,
  regexReplacementRules: overrides.regexReplacementRules,
  targetLanguage: overrides.targetLanguage ?? 'zh-cn'
})

const rule = (pattern: string, replacement: string, flags = 'g'): RegexReplacementRule => ({
  flags,
  id: pattern,
  pattern,
  replacement
})

describe('translation post-processor pipeline', () => {
  it('keeps every built-in processor disabled by default', () => {
    expect(DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES).toEqual({
      enMarkdownStraightQuotes: false,
      zhCnMarkdownSmartQuotes: false,
      zhMarkdownTextSpacing: false
    })
  })

  it('applies smart quotes, spacing, then regex rules in that order', () => {
    const context = enabledContext({
      regexReplacementRules: [rule('OpenAI', 'AI')]
    })

    expect(applyTranslationPostProcessors('他说"OpenAI"开发得很好。', context)).toBe('他说“AI”开发得很好。')
  })

  it.each([
    ['master switch', enabledContext({ enabled: false }), '他说"OpenAI"。'],
    ['Markdown switch', enabledContext({ markdownEnabled: false }), '他说"OpenAI"。'],
    [
      'feature switch',
      enabledContext({ features: { zhCnMarkdownSmartQuotes: false, zhMarkdownTextSpacing: false } }),
      '他说"OpenAI"。'
    ],
    ['target-language gate', enabledContext({ targetLanguage: 'ja-jp' }), '他说"OpenAI"。']
  ] as const)('honors the %s', (_name, context, expected) => {
    expect(applyTranslationPostProcessors('他说"OpenAI"。', context)).toBe(expected)
  })

  it('uses exact Chinese and primary English language gates', () => {
    expect(shouldApplyZhCnMarkdownSmartQuotes(enabledContext({ targetLanguage: 'zh-cn' }))).toBe(true)
    expect(shouldApplyZhCnMarkdownSmartQuotes(enabledContext({ targetLanguage: 'zh-tw' }))).toBe(false)
    expect(shouldApplyZhMarkdownTextSpacing(enabledContext({ targetLanguage: 'zh-tw' }))).toBe(true)
    expect(shouldApplyEnMarkdownStraightQuotes(enabledContext({ targetLanguage: 'en-us' }))).toBe(true)
    expect(shouldApplyEnMarkdownStraightQuotes(enabledContext({ targetLanguage: 'zh-cn' }))).toBe(false)
  })

  it('applies enabled regex rules sequentially and preserves capture groups', () => {
    expect(
      applyRegexReplacementRules('foo 2024-01-15', [
        rule('foo', 'bar'),
        rule('bar', 'baz'),
        rule('(\\d{4})-(\\d{2})-(\\d{2})', '$3/$2/$1')
      ])
    ).toBe('baz 15/01/2024')
  })

  it.each([
    [String.raw`\n`, 'a\nb'],
    [String.raw`\t`, 'a\tb'],
    [String.raw`\r`, 'a\rb'],
    [String.raw`\f`, 'a\fb'],
    [String.raw`\0`, 'a\0b'],
    [String.raw`\b`, 'a\bb'],
    [String.raw`\v`, 'a\vb'],
    [String.raw`\x41`, 'aAb'],
    [String.raw`\u0041`, 'aAb'],
    [String.raw`\[`, 'a[b'],
    [String.raw`\\n`, String.raw`a\nb`]
  ])('decodes the regex101 JavaScript substitution %s', (replacement, expected) => {
    expect(applyRegexReplacementRules('a,b', [rule(',', replacement)])).toBe(expected)
  })

  it('applies JavaScript substitution tokens after decoding replacement escapes', () => {
    expect(
      applyRegexReplacementRules('a,b', [
        rule('(,)', String.raw`\x241`),
        rule('(b)', '$&$$'),
        rule('(?<letter>a)', '$<letter>')
      ])
    ).toBe('a,b$')
  })

  it.each([String.raw`\xZ`, String.raw`\x1`, String.raw`\u12`, String.raw`\u12XZ`, '\\'])(
    'skips the invalid regex101 substitution %s and continues with later rules',
    (replacement) => {
      expect(applyRegexReplacementRules('a,b', [rule(',', replacement), rule('b', 'c')])).toBe('a,c')
    }
  )

  it('applies regex rules only through the selected list position', () => {
    const rules = [rule('foo', 'bar'), { ...rule('bar', 'ignored'), enabled: false }, rule('bar', 'baz')]

    expect(applyRegexReplacementRulesThrough('foo', rules, 0)).toBe('foo')
    expect(applyRegexReplacementRulesThrough('foo', rules, 1)).toBe('bar')
    expect(applyRegexReplacementRulesThrough('foo', rules, 2)).toBe('bar')
    expect(applyRegexReplacementRulesThrough('foo', rules, 3)).toBe('baz')
  })

  it('skips disabled, empty, invalid-pattern, and invalid-flag regex rules independently', () => {
    const rules: RegexReplacementRule[] = [
      { ...rule('hello', 'ignored'), enabled: false },
      rule('', '', 'g'),
      rule('[(', 'invalid'),
      rule('hello', 'invalid flag', 'z'),
      rule('world', 'earth')
    ]

    expect(applyRegexReplacementRules('hello world', rules)).toBe('hello earth')
  })

  it('keeps empty input unchanged', () => {
    expect(applyTranslationPostProcessors('', enabledContext())).toBe('')
  })
})
