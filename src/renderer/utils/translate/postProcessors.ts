import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import type { TranslateLangCode } from '@shared/data/preference/preferenceTypes'

import { normalizeZhMarkdownTextSpacing } from './zhMarkdownSpacing'

type MarkdownNode = {
  type?: string
  value?: string
  url?: string
  position?: {
    start?: { offset?: number }
    end?: { offset?: number }
  }
  children?: MarkdownNode[]
}

type EditableTextFragment = {
  start: number
  text: string
}

type OffsetEdit = {
  deleteCount: number
  offset: number
  replacement: string
}

type ProtectedRange = {
  end: number
  start: number
}

type QuoteState = {
  doubleDepth: number
  singleDepth: number
}

type TranslationPostProcessor = {
  id: string
  process: (text: string, context: TranslationPostProcessorContext) => string
  shouldApply: (context: TranslationPostProcessorContext) => boolean
}

type VirtualTextBuffer = {
  offsets: number[]
  text: string
}

export type RegexReplacementRule = {
  id: string
  pattern: string
  flags: string
  replacement: string
  enabled?: boolean
}

export type RegexReplacementIssue = {
  ruleId: string
  ruleIndex: number
  field: 'flags' | 'pattern' | 'replacement'
  message: string
}

export type RegexReplacementEvaluation = {
  text: string
  issues: RegexReplacementIssue[]
}

export type TranslationPostProcessorFeatures = {
  enMarkdownStraightQuotes: boolean
  zhCnMarkdownSmartQuotes: boolean
  zhMarkdownTextSpacing: boolean
}

export type TranslationPostProcessorContext = {
  enabled?: boolean
  features: TranslationPostProcessorFeatures
  markdownEnabled: boolean
  targetLanguage: TranslateLangCode
  regexReplacementRules?: RegexReplacementRule[]
}

export const DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES: TranslationPostProcessorFeatures = {
  enMarkdownStraightQuotes: false,
  zhCnMarkdownSmartQuotes: false,
  zhMarkdownTextSpacing: false
}

const ENGLISH_LANGUAGE_CODE = 'en'
const SIMPLIFIED_CHINESE_LANGUAGE_CODE = 'zh-cn'
const TRADITIONAL_CHINESE_LANGUAGE_CODE = 'zh-tw'
const CHINESE_TARGET_LANGUAGE_CODES = new Set([SIMPLIFIED_CHINESE_LANGUAGE_CODE, TRADITIONAL_CHINESE_LANGUAGE_CODE])

const CONTAINER_TYPES = new Set(['heading', 'paragraph', 'tableCell'])
const SKIPPED_NODE_TYPES = new Set(['code', 'definition', 'html', 'inlineCode', 'inlineMath', 'math', 'toml', 'yaml'])
const OPENING_PUNCTUATION = new Set(['(', '<', '[', '{', '«', '“', '‘', '（', '【', '《', '「', '『'])
const CLOSING_PUNCTUATION = new Set([
  '!',
  ')',
  ',',
  '.',
  ':',
  ';',
  '?',
  '>',
  '»',
  '”',
  '’',
  '）',
  '】',
  '》',
  '」',
  '』',
  '、',
  '。',
  '，',
  '：',
  '；',
  '！',
  '？'
])

const URL_PATTERN = /\b(?:https?:\/\/|mailto:|www\.)[^\s<>()\]]+/giu
const WINDOWS_PATH_PATTERN = /\b[a-zA-Z]:\\(?:[^\\\s]+\\)*[^\\\s]+/g
const UNIX_PATH_PATTERN = /(?:^|\s)(?:\.\.\/|\.\/|\/)(?:[^\s/]+\/)+[^\s/]+/g
const STRUCTURED_JSON_PATTERN = /^\s*[[{][\s\S]*[\]}]\s*$/u
const YAML_LINE_PATTERN = /^\s*[A-Za-z0-9_-]+\s*:\s*.+$/u
const SHELL_COMMAND_PATTERN =
  /^(?:[$>#]\s*)?(?:pnpm|npm|yarn|git|node|python|bash|sh|pwsh|powershell|curl|wget|cd|ls|cat)\b/u
const CJK_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/u
const DIGIT_PATTERN = /\p{N}/u
const LATIN_LETTER_PATTERN = /[A-Za-z]/u
const HEX_ESCAPE_PATTERN = /^[\dA-Fa-f]+$/u
const REGEX_REPLACEMENT_ESCAPES: Record<string, string> = {
  '0': '\0',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v'
}

export { normalizeZhMarkdownTextSpacing }

const translationPostProcessors: TranslationPostProcessor[] = [
  {
    id: 'zh-cn-markdown-smart-quotes',
    process: (text) => normalizeZhCnMarkdownQuotes(text),
    shouldApply: shouldApplyZhCnMarkdownSmartQuotes
  },
  {
    id: 'zh-markdown-text-spacing',
    process: (text) => normalizeZhMarkdownTextSpacing(text),
    shouldApply: shouldApplyZhMarkdownTextSpacing
  },
  {
    id: 'en-markdown-straight-quotes',
    process: (text) => normalizeEnMarkdownStraightQuotes(text),
    shouldApply: shouldApplyEnMarkdownStraightQuotes
  },
  {
    id: 'regex-replacement',
    process: (text, context) => applyRegexReplacementRules(text, context.regexReplacementRules ?? []),
    shouldApply: (context) => (context.regexReplacementRules?.length ?? 0) > 0
  }
]

export function applyRegexReplacementRules(text: string, rules: RegexReplacementRule[]): string {
  return applyRegexReplacementRulesThrough(text, rules, rules.length)
}

export function applyRegexReplacementRulesThrough(
  text: string,
  rules: RegexReplacementRule[],
  ruleCount: number
): string {
  return evaluateRegexReplacementRulesThrough(text, rules, ruleCount).text
}

export function evaluateRegexReplacementRulesThrough(
  text: string,
  rules: RegexReplacementRule[],
  ruleCount: number
): RegexReplacementEvaluation {
  const issues: RegexReplacementIssue[] = []
  let current = text

  for (const [ruleIndex, rule] of rules.slice(0, Math.max(0, ruleCount)).entries()) {
    if (!isRuleEnabled(rule)) continue

    try {
      RegExp('', rule.flags)
    } catch (error) {
      issues.push({ ruleId: rule.id, ruleIndex, field: 'flags', message: getErrorMessage(error) })
      continue
    }

    let regex: RegExp
    try {
      regex = new RegExp(rule.pattern, rule.flags)
    } catch (error) {
      issues.push({ ruleId: rule.id, ruleIndex, field: 'pattern', message: getErrorMessage(error) })
      continue
    }

    try {
      current = current.replace(regex, parseRegex101Replacement(rule.replacement))
    } catch (error) {
      issues.push({ ruleId: rule.id, ruleIndex, field: 'replacement', message: getErrorMessage(error) })
    }
  }

  return { text: current, issues }
}

function parseRegex101Replacement(replacement: string): string {
  let decoded = ''

  for (let index = 0; index < replacement.length; index += 1) {
    const character = replacement[index]
    if (character !== '\\') {
      decoded += character
      continue
    }

    index += 1
    if (index >= replacement.length) {
      throw new SyntaxError('Incomplete regex replacement escape')
    }

    const escaped = replacement[index]
    const hexLength = escaped === 'x' ? 2 : escaped === 'u' ? 4 : 0
    if (hexLength > 0) {
      const hexValue = replacement.slice(index + 1, index + 1 + hexLength)
      if (hexValue.length !== hexLength || !HEX_ESCAPE_PATTERN.test(hexValue)) {
        throw new SyntaxError('Invalid hexadecimal regex replacement escape')
      }
      decoded += String.fromCharCode(Number.parseInt(hexValue, 16))
      index += hexLength
      continue
    }

    decoded += REGEX_REPLACEMENT_ESCAPES[escaped] ?? escaped
  }

  return decoded
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isRuleEnabled(rule: RegexReplacementRule): boolean {
  return rule.enabled !== false
}

export function applyTranslationPostProcessors(text: string, context: TranslationPostProcessorContext): string {
  if (!text) {
    return text
  }

  if (context.enabled === false) {
    return text
  }

  return translationPostProcessors.reduce((currentText, processor) => {
    if (!processor.shouldApply(context)) {
      return currentText
    }
    return processor.process(currentText, context)
  }, text)
}

export function shouldApplyZhCnMarkdownSmartQuotes(context: TranslationPostProcessorContext): boolean {
  return (
    context.markdownEnabled &&
    context.features.zhCnMarkdownSmartQuotes &&
    normalizeLanguageCode(context.targetLanguage) === SIMPLIFIED_CHINESE_LANGUAGE_CODE
  )
}

export function shouldApplyZhMarkdownTextSpacing(context: TranslationPostProcessorContext): boolean {
  return (
    context.markdownEnabled &&
    context.features.zhMarkdownTextSpacing &&
    CHINESE_TARGET_LANGUAGE_CODES.has(normalizeLanguageCode(context.targetLanguage))
  )
}

export function shouldApplyEnMarkdownStraightQuotes(context: TranslationPostProcessorContext): boolean {
  return (
    context.markdownEnabled &&
    context.features.enMarkdownStraightQuotes &&
    getPrimaryLanguageCode(context.targetLanguage) === ENGLISH_LANGUAGE_CODE
  )
}

export function normalizeEnMarkdownStraightQuotes(markdown: string): string {
  if (!markdown || !/[“”‘’„‟‚‛]/u.test(markdown)) {
    return markdown
  }

  const protectedRanges = detectLeadingFrontmatterRanges(markdown)

  let root: MarkdownNode
  try {
    root = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(markdown)
  } catch {
    return markdown
  }

  const edits: OffsetEdit[] = []
  collectContainerEdits(root, markdown, protectedRanges, edits, collectStraightQuoteEdits)

  if (edits.length === 0) {
    return markdown
  }

  return applyOffsetEdits(markdown, edits)
}

export function normalizeZhCnMarkdownQuotes(markdown: string): string {
  if (!markdown || !/["']/.test(markdown)) {
    return markdown
  }

  const protectedRanges = detectLeadingFrontmatterRanges(markdown)

  let root: MarkdownNode
  try {
    root = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(markdown)
  } catch {
    return markdown
  }

  const edits: OffsetEdit[] = []
  collectContainerEdits(root, markdown, protectedRanges, edits, collectQuoteEdits)

  if (edits.length === 0) {
    return markdown
  }

  return applyOffsetEdits(markdown, edits)
}

function collectContainerEdits(
  node: MarkdownNode,
  markdown: string,
  protectedRanges: ProtectedRange[],
  edits: OffsetEdit[],
  collectEdits: (buffer: VirtualTextBuffer, markdown: string) => OffsetEdit[]
): void {
  if (!node.type) {
    for (const child of node.children || []) {
      collectContainerEdits(child, markdown, protectedRanges, edits, collectEdits)
    }
    return
  }

  if (CONTAINER_TYPES.has(node.type)) {
    const fragments = collectEditableTextFragments(node, protectedRanges)
    if (fragments.length > 0) {
      const virtualText = buildVirtualTextBuffer(fragments)
      if (!looksLikeStructuredText(virtualText.text)) {
        edits.push(...collectEdits(virtualText, markdown))
      }
    }
    return
  }

  for (const child of node.children || []) {
    collectContainerEdits(child, markdown, protectedRanges, edits, collectEdits)
  }
}

function collectEditableTextFragments(node: MarkdownNode, protectedRanges: ProtectedRange[]): EditableTextFragment[] {
  const fragments: EditableTextFragment[] = []

  const visitNode = (currentNode: MarkdownNode, parentNode?: MarkdownNode, childIndex?: number) => {
    if (!currentNode.type) {
      for (const [index, child] of (currentNode.children || []).entries()) {
        visitNode(child, currentNode, index)
      }
      return
    }

    if (SKIPPED_NODE_TYPES.has(currentNode.type)) {
      return
    }

    if (currentNode.type === 'link') {
      if (isAutolinkLikeLink(currentNode)) {
        return
      }
      for (const [index, child] of (currentNode.children || []).entries()) {
        visitNode(child, currentNode, index)
      }
      return
    }

    if (currentNode.type === 'text') {
      if (
        isTextWrappedByHtmlSiblings(parentNode, childIndex) ||
        isTrailingQuoteAfterAutolink(parentNode, childIndex, currentNode)
      ) {
        return
      }

      const start = currentNode.position?.start?.offset
      const end = currentNode.position?.end?.offset

      if (typeof start !== 'number' || typeof end !== 'number' || end <= start || !currentNode.value) {
        return
      }

      if (isProtectedOffsetRange(start, end, protectedRanges)) {
        return
      }

      fragments.push({ start, text: currentNode.value })
      return
    }

    for (const [index, child] of (currentNode.children || []).entries()) {
      visitNode(child, currentNode, index)
    }
  }

  visitNode(node)
  return fragments
}

function buildVirtualTextBuffer(fragments: EditableTextFragment[]): VirtualTextBuffer {
  const offsets: number[] = []
  let text = ''

  for (const fragment of fragments) {
    text += fragment.text
    for (let index = 0; index < fragment.text.length; index += 1) {
      offsets.push(fragment.start + index)
    }
  }

  return { offsets, text }
}

function collectQuoteEdits(buffer: VirtualTextBuffer, markdown: string): OffsetEdit[] {
  const edits: OffsetEdit[] = []
  const protectedTextRanges = collectInlineProtectedRanges(buffer.text)
  const state: QuoteState = { doubleDepth: 0, singleDepth: 0 }

  for (let index = 0; index < buffer.text.length; index += 1) {
    const character = buffer.text[index]
    if (character !== '"' && character !== "'") {
      continue
    }

    if (isProtectedVirtualOffset(index, protectedTextRanges)) {
      continue
    }

    const previous = findPreviousVisibleChar(buffer.text, index)
    const next = findNextVisibleChar(buffer.text, index)
    const previousImmediate = index > 0 ? buffer.text[index - 1] : null
    const nextImmediate = index + 1 < buffer.text.length ? buffer.text[index + 1] : null
    let replacement: string | undefined

    if (character === "'" && isPrimeMark(previousImmediate, nextImmediate)) {
      replacement = '′'
    } else if (character === '"' && isPrimeMark(previousImmediate, nextImmediate)) {
      replacement = '″'
    } else if (character === "'" && isApostrophe(previousImmediate, nextImmediate, previous, next)) {
      replacement = '’'
    } else if (character === '"') {
      replacement = resolveDoubleQuote(previous, next, state)
    } else {
      replacement = resolveSingleQuote(previous, next, state)
    }

    if (!replacement || replacement === character) {
      continue
    }

    const sourceOffset = buffer.offsets[index]
    if (markdown[sourceOffset] === character) {
      edits.push({ deleteCount: 1, offset: sourceOffset, replacement })
    }
  }

  return edits
}

function collectStraightQuoteEdits(buffer: VirtualTextBuffer, markdown: string): OffsetEdit[] {
  const edits: OffsetEdit[] = []
  const protectedTextRanges = collectInlineProtectedRanges(buffer.text)

  for (let index = 0; index < buffer.text.length; index += 1) {
    if (isProtectedVirtualOffset(index, protectedTextRanges)) {
      continue
    }

    const character = buffer.text[index]
    const replacement = getStraightQuoteReplacement(character)
    if (!replacement) {
      continue
    }

    const sourceOffset = buffer.offsets[index]
    if (markdown[sourceOffset] === character) {
      edits.push({ deleteCount: 1, offset: sourceOffset, replacement })
    }
  }

  return edits
}

function getStraightQuoteReplacement(character: string): string | undefined {
  if (character === '“' || character === '”' || character === '„' || character === '‟') {
    return '"'
  }

  if (character === '‘' || character === '’' || character === '‚' || character === '‛') {
    return "'"
  }

  return undefined
}

function resolveDoubleQuote(previous: string | null, next: string | null, state: QuoteState): string {
  const open = shouldOpenQuote(previous, next)
  const close = shouldCloseQuote(previous, next)

  if (open && !close) {
    state.doubleDepth += 1
    return '“'
  }

  if (close && !open) {
    state.doubleDepth = Math.max(0, state.doubleDepth - 1)
    return '”'
  }

  if (state.doubleDepth === 0) {
    state.doubleDepth += 1
    return '“'
  }

  state.doubleDepth = Math.max(0, state.doubleDepth - 1)
  return '”'
}

function resolveSingleQuote(previous: string | null, next: string | null, state: QuoteState): string {
  const open = shouldOpenQuote(previous, next)
  const close = shouldCloseQuote(previous, next)

  if (open && !close) {
    state.singleDepth += 1
    return '‘'
  }

  if (close && !open) {
    state.singleDepth = Math.max(0, state.singleDepth - 1)
    return '’'
  }

  if (state.singleDepth === 0) {
    state.singleDepth += 1
    return '‘'
  }

  state.singleDepth = Math.max(0, state.singleDepth - 1)
  return '’'
}

function shouldOpenQuote(previous: string | null, next: string | null): boolean {
  if (!next) {
    return false
  }

  if (!previous) {
    return true
  }

  return isWhitespace(previous) || OPENING_PUNCTUATION.has(previous)
}

function shouldCloseQuote(previous: string | null, next: string | null): boolean {
  if (!previous) {
    return false
  }

  if (!next) {
    return true
  }

  return isWhitespace(next) || CLOSING_PUNCTUATION.has(next)
}

function isApostrophe(
  previousImmediate: string | null,
  nextImmediate: string | null,
  previousVisible: string | null,
  nextVisible: string | null
): boolean {
  if (isLatinLetter(previousImmediate) && isLatinLetter(nextImmediate)) {
    return true
  }

  if (isLatinLetter(previousVisible) && (!nextVisible || CLOSING_PUNCTUATION.has(nextVisible))) {
    return true
  }

  return (
    (!previousVisible || isWhitespace(previousImmediate) || OPENING_PUNCTUATION.has(previousVisible)) &&
    isDigit(nextImmediate)
  )
}

function isPrimeMark(previous: string | null, next: string | null): boolean {
  if (!isDigit(previous)) {
    return false
  }

  return !next || isDigit(next) || isWhitespace(next) || CLOSING_PUNCTUATION.has(next)
}

function collectInlineProtectedRanges(text: string): ProtectedRange[] {
  return [URL_PATTERN, WINDOWS_PATH_PATTERN, UNIX_PATH_PATTERN].flatMap((pattern) => {
    const ranges: ProtectedRange[] = []
    pattern.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const matchedText = match[0]
      const start = match.index + (pattern === UNIX_PATH_PATTERN && /^\s/u.test(matchedText) ? 1 : 0)
      const normalizedText = pattern === UNIX_PATH_PATTERN ? matchedText.trimStart() : matchedText

      ranges.push({
        end: start + normalizedText.length,
        start
      })
    }

    return ranges
  })
}

function looksLikeStructuredText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) {
    return false
  }

  if (STRUCTURED_JSON_PATTERN.test(trimmed) && /[:[\]{},]/u.test(trimmed)) {
    return true
  }

  const lines = trimmed
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length > 0 && lines.every((line) => YAML_LINE_PATTERN.test(line))) {
    return true
  }

  if (
    lines.length === 1 &&
    (SHELL_COMMAND_PATTERN.test(lines[0]) ||
      hasPatternMatch(lines[0], WINDOWS_PATH_PATTERN) ||
      /^[./~]/u.test(lines[0]))
  ) {
    return true
  }

  const cjkCount = countMatches(text, CJK_PATTERN)
  const urlCount = countMatches(text, URL_PATTERN)
  if (cjkCount === 0 && urlCount > 0) {
    return true
  }

  return false
}

function detectLeadingFrontmatterRanges(markdown: string): ProtectedRange[] {
  if (!markdown.startsWith('---\n') && !markdown.startsWith('+++\n')) {
    return []
  }

  const delimiter = markdown.slice(0, 3)
  const closingMarker = `\n${delimiter}\n`
  const closingIndex = markdown.indexOf(closingMarker, 3)

  if (closingIndex === -1) {
    return []
  }

  return [
    {
      end: closingIndex + closingMarker.length,
      start: 0
    }
  ]
}

function applyOffsetEdits(source: string, edits: OffsetEdit[]): string {
  return [...edits]
    .sort((left, right) => {
      if (left.offset !== right.offset) {
        return right.offset - left.offset
      }
      return right.deleteCount - left.deleteCount
    })
    .reduce((current, edit) => {
      return `${current.slice(0, edit.offset)}${edit.replacement}${current.slice(edit.offset + edit.deleteCount)}`
    }, source)
}

function isAutolinkLikeLink(node: MarkdownNode): boolean {
  if (!node.url || !node.children || node.children.length !== 1 || node.children[0].type !== 'text') {
    return false
  }

  const label = node.children[0].value?.trim()
  if (!label) {
    return false
  }

  return normalizeUrlLikeValue(label) === normalizeUrlLikeValue(node.url)
}

function isTextWrappedByHtmlSiblings(parentNode: MarkdownNode | undefined, childIndex: number | undefined): boolean {
  if (!parentNode?.children || typeof childIndex !== 'number') {
    return false
  }

  const previousSibling = parentNode.children[childIndex - 1]
  const nextSibling = parentNode.children[childIndex + 1]

  return Boolean(
    previousSibling?.type === 'html' &&
    previousSibling.value &&
    isOpeningHtmlTag(previousSibling.value) &&
    nextSibling?.type === 'html' &&
    nextSibling.value &&
    isClosingHtmlTag(nextSibling.value)
  )
}

function isTrailingQuoteAfterAutolink(
  parentNode: MarkdownNode | undefined,
  childIndex: number | undefined,
  currentNode: MarkdownNode
): boolean {
  if (!parentNode?.children || typeof childIndex !== 'number' || currentNode.value !== '"') {
    return false
  }

  const previousSibling = parentNode.children[childIndex - 1]
  if (!previousSibling || previousSibling.type !== 'link' || !isAutolinkLikeLink(previousSibling)) {
    return false
  }

  const previousEnd = previousSibling.position?.end?.offset
  const currentStart = currentNode.position?.start?.offset
  return typeof previousEnd === 'number' && typeof currentStart === 'number' && previousEnd === currentStart
}

function isOpeningHtmlTag(value: string): boolean {
  return /^<[A-Za-z][\w:-]*\b[^>]*>$/u.test(value) && !value.startsWith('</') && !/\/\s*>$/u.test(value)
}

function isClosingHtmlTag(value: string): boolean {
  return /^<\/[A-Za-z][\w:-]*\s*>$/u.test(value)
}

function normalizeUrlLikeValue(value: string): string {
  return value
    .replace(/^mailto:/iu, '')
    .replace(/^https?:\/\//iu, '')
    .replace(/\/$/u, '')
    .toLowerCase()
}

function isProtectedOffsetRange(start: number, end: number, protectedRanges: ProtectedRange[]): boolean {
  return protectedRanges.some((range) => start < range.end && end > range.start)
}

function isProtectedVirtualOffset(offset: number, ranges: ProtectedRange[]): boolean {
  return ranges.some((range) => offset >= range.start && offset < range.end)
}

function findPreviousVisibleChar(text: string, index: number): string | null {
  for (let pointer = index - 1; pointer >= 0; pointer -= 1) {
    if (!isWhitespace(text[pointer])) {
      return text[pointer]
    }
  }

  return null
}

function findNextVisibleChar(text: string, index: number): string | null {
  for (let pointer = index + 1; pointer < text.length; pointer += 1) {
    if (!isWhitespace(text[pointer])) {
      return text[pointer]
    }
  }

  return null
}

function countMatches(text: string, pattern: RegExp): number {
  return text.match(toGlobalPattern(pattern))?.length ?? 0
}

function hasPatternMatch(text: string, pattern: RegExp): boolean {
  return toGlobalPattern(pattern).test(text)
}

function toGlobalPattern(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  return new RegExp(pattern.source, flags)
}

function normalizeLanguageCode(languageCode: string): string {
  return languageCode.trim().toLowerCase()
}

function getPrimaryLanguageCode(languageCode: string): string {
  return normalizeLanguageCode(languageCode).split('-')[0]
}

function isWhitespace(value: string | null): boolean {
  return value !== null && /\s/u.test(value)
}

function isDigit(value: string | null): boolean {
  return value !== null && DIGIT_PATTERN.test(value)
}

function isLatinLetter(value: string | null): boolean {
  return value !== null && LATIN_LETTER_PATTERN.test(value)
}
