import type { TranslateLanguageCode } from '@renderer/types'
import pangu from 'pangu'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

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

type ProtectedToken = {
  placeholder: string
  original: string
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

export const TRANSLATION_POST_PROCESSOR_SETTING_KEYS = {
  zhCnMarkdownSmartQuotes: 'translate:postprocess:zhQuotes:enabled',
  zhMarkdownTextSpacing: 'translate:postprocess:zhSpacing:enabled'
} as const

export type TranslationPostProcessorFeatures = {
  zhCnMarkdownSmartQuotes: boolean
  zhMarkdownTextSpacing: boolean
}

export type TranslationPostProcessorContext = {
  features: TranslationPostProcessorFeatures
  markdownEnabled: boolean
  targetLanguage: TranslateLanguageCode
}

export const DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES: TranslationPostProcessorFeatures = {
  zhCnMarkdownSmartQuotes: false,
  zhMarkdownTextSpacing: false
}

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
const STRUCTURED_JSON_PATTERN = /^\s*[\[{][\s\S]*[\]}]\s*$/u
const YAML_LINE_PATTERN = /^\s*[A-Za-z0-9_-]+\s*:\s*.+$/u
const SHELL_COMMAND_PATTERN =
  /^(?:[$>#]\s*)?(?:pnpm|npm|yarn|git|node|python|bash|sh|pwsh|powershell|curl|wget|cd|ls|cat)\b/u
const CJK_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/u
const DIGIT_PATTERN = /\p{N}/u
const LATIN_LETTER_PATTERN = /[A-Za-z]/u

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
  }
]

export function applyTranslationPostProcessors(text: string, context: TranslationPostProcessorContext): string {
  if (!text) {
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

export function normalizeZhCnMarkdownQuotes(markdown: string): string {
  if (!markdown || !/["']/.test(markdown)) {
    return markdown
  }

  const protectedRanges = detectLeadingFrontmatterRanges(markdown)

  let root: MarkdownNode
  try {
    root = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(markdown) as MarkdownNode
  } catch {
    return markdown
  }

  const edits: OffsetEdit[] = []
  collectContainerEdits(root, markdown, protectedRanges, edits)

  if (edits.length === 0) {
    return markdown
  }

  return applyOffsetEdits(markdown, edits)
}

export function normalizeZhMarkdownTextSpacing(markdown: string): string {
  if (!markdown || !CJK_PATTERN.test(markdown)) {
    return markdown
  }

  if (looksLikeStructuredText(markdown)) {
    return markdown
  }

  const protectedRanges = detectLeadingFrontmatterRanges(markdown)

  let root: MarkdownNode
  try {
    root = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(markdown) as MarkdownNode
  } catch {
    return markdown
  }

  const spacingProtectedRanges = normalizeRanges([
    ...protectedRanges,
    ...collectSpacingProtectedRanges(root, markdown),
    ...collectInlineProtectedRanges(markdown)
  ])
  const { text: placeholderText, tokens } = replaceProtectedRangesWithPlaceholders(markdown, spacingProtectedRanges)
  const spacedText = cleanupZhMarkdownSpacing(spacingWithPangu(placeholderText))
  const restoredText = restoreProtectedPlaceholders(spacedText, tokens)

  return restoredText === markdown ? markdown : restoredText
}

function collectContainerEdits(
  node: MarkdownNode,
  markdown: string,
  protectedRanges: ProtectedRange[],
  edits: OffsetEdit[]
): void {
  if (!node.type) {
    for (const child of node.children || []) {
      collectContainerEdits(child, markdown, protectedRanges, edits)
    }
    return
  }

  if (CONTAINER_TYPES.has(node.type)) {
    const fragments = collectEditableTextFragments(node, protectedRanges)
    if (fragments.length > 0) {
      const virtualText = buildVirtualTextBuffer(fragments)
      if (!looksLikeStructuredText(virtualText.text)) {
        edits.push(...collectQuoteEdits(virtualText, markdown))
      }
    }
    return
  }

  for (const child of node.children || []) {
    collectContainerEdits(child, markdown, protectedRanges, edits)
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

function spacingWithPangu(text: string): string {
  try {
    const spaced = pangu.spacingText(text)
    return typeof spaced === 'string' ? spaced : text
  } catch {
    return text
  }
}

function normalizeRanges(ranges: ProtectedRange[]): ProtectedRange[] {
  if (ranges.length <= 1) {
    return ranges
  }

  const sortedRanges = [...ranges].sort((left, right) => left.start - right.start)
  const mergedRanges: ProtectedRange[] = []

  for (const range of sortedRanges) {
    const lastRange = mergedRanges[mergedRanges.length - 1]
    if (!lastRange || range.start > lastRange.end) {
      mergedRanges.push({ ...range })
      continue
    }

    lastRange.end = Math.max(lastRange.end, range.end)
  }

  return mergedRanges
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

  if (STRUCTURED_JSON_PATTERN.test(trimmed) && /[:\[\]{},]/u.test(trimmed)) {
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

function collectSpacingProtectedRanges(root: MarkdownNode, markdown: string): ProtectedRange[] {
  const ranges: ProtectedRange[] = []

  const visitNode = (node: MarkdownNode) => {
    if (!node.type) {
      for (const child of node.children || []) {
        visitNode(child)
      }
      return
    }

    if (SKIPPED_NODE_TYPES.has(node.type) && hasValidNodeOffsets(node)) {
      ranges.push(getNodeRange(node)!)
      return
    }

    if (node.children?.length) {
      ranges.push(...collectHtmlElementRanges(node.children, markdown))
    }

    for (const child of node.children || []) {
      visitNode(child)
    }
  }

  visitNode(root)
  return ranges
}

function collectHtmlElementRanges(nodes: MarkdownNode[], markdown: string): ProtectedRange[] {
  const ranges: ProtectedRange[] = []
  const stack: Array<{ start: number; tagName: string }> = []

  for (const node of nodes) {
    if (node.type !== 'html' || !node.value || !hasValidNodeOffsets(node)) {
      continue
    }

    const tagName = getHtmlTagName(node.value)
    if (!tagName) {
      ranges.push(getNodeRange(node)!)
      continue
    }

    if (isOpeningHtmlTag(node.value)) {
      stack.push({ start: node.position!.start!.offset!, tagName })
      continue
    }

    if (!isClosingHtmlTag(node.value)) {
      ranges.push(getNodeRange(node)!)
      continue
    }

    const matchIndex = findLastMatchingHtmlOpenTag(stack, tagName)
    if (matchIndex === -1) {
      ranges.push(getNodeRange(node)!)
      continue
    }

    const [openingTag] = stack.splice(matchIndex, 1)
    ranges.push({
      end: node.position!.end!.offset!,
      start: openingTag.start
    })
  }

  return ranges.filter((range) => range.end > range.start && range.end <= markdown.length)
}

function replaceProtectedRangesWithPlaceholders(
  source: string,
  ranges: ProtectedRange[]
): { text: string; tokens: ProtectedToken[] } {
  if (ranges.length === 0) {
    return { text: source, tokens: [] }
  }

  const tokens: ProtectedToken[] = []
  let text = ''
  let cursor = 0

  for (const [index, range] of ranges.entries()) {
    if (range.start < cursor) {
      continue
    }

    const placeholder = `PHSPACINGTOKEN${index}`
    tokens.push({
      original: source.slice(range.start, range.end),
      placeholder
    })
    text += source.slice(cursor, range.start)
    text += placeholder
    cursor = range.end
  }

  text += source.slice(cursor)
  return { text, tokens }
}

function restoreProtectedPlaceholders(source: string, tokens: ProtectedToken[]): string {
  return tokens.reduce((current, token) => current.replaceAll(token.placeholder, token.original), source)
}

function cleanupZhMarkdownSpacing(text: string): string {
  return text
    .replace(/(\*\*|__)\s+([^*]+?)\s+(\1)/gu, '$1$2$3')
    .replace(/(\*\*|__)\s+([^*]+?)(\1)/gu, '$1$2$3')
    .replace(/(\*\*|__)([^*]+?)\s+(\1)/gu, '$1$2$3')
    .replace(/([\u3400-\u9fff\uf900-\ufaff])\s+(["“‘])/gu, '$1$2')
    .replace(/(["”’])\s+([\u3400-\u9fff\uf900-\ufaff])/gu, '$1$2')
    .replace(/(["”’])\s+([、。！，；：？！])/gu, '$1$2')
    .replace(/([\u3400-\u9fff\uf900-\ufaff])\s+(“[A-Za-z0-9][^”]*?”)\s+([\u3400-\u9fff\uf900-\ufaff])/gu, '$1$2$3')
    .replace(/([\u3400-\u9fff\uf900-\ufaff])\s+(‘[A-Za-z0-9][^’]*?’)\s+([\u3400-\u9fff\uf900-\ufaff])/gu, '$1$2$3')
    .replace(/(\*\*[^*]*[\u3400-\u9fff\uf900-\ufaff][^*]*\*\*)\s+([\u3400-\u9fff\uf900-\ufaff])/gu, '$1$2')
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

function hasValidNodeOffsets(node: MarkdownNode): boolean {
  return typeof node.position?.start?.offset === 'number' && typeof node.position?.end?.offset === 'number'
}

function getNodeRange(node: MarkdownNode): ProtectedRange | null {
  const start = node.position?.start?.offset
  const end = node.position?.end?.offset
  if (typeof start !== 'number' || typeof end !== 'number' || end <= start) {
    return null
  }

  return { end, start }
}

function getHtmlTagName(value: string): string | null {
  const match = value.match(/^<\/?([A-Za-z][\w:-]*)\b/u)
  return match?.[1]?.toLowerCase() ?? null
}

function isOpeningHtmlTag(value: string): boolean {
  return /^<[A-Za-z][\w:-]*\b[^>]*>$/u.test(value) && !/^<\//u.test(value) && !/\/\s*>$/u.test(value)
}

function isClosingHtmlTag(value: string): boolean {
  return /^<\/[A-Za-z][\w:-]*\s*>$/u.test(value)
}

function findLastMatchingHtmlOpenTag(stack: Array<{ start: number; tagName: string }>, tagName: string): number {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index].tagName === tagName) {
      return index
    }
  }

  return -1
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

function isWhitespace(value: string | null): boolean {
  return value !== null && /\s/u.test(value)
}

function isDigit(value: string | null): boolean {
  return value !== null && DIGIT_PATTERN.test(value)
}

function isLatinLetter(value: string | null): boolean {
  return value !== null && LATIN_LETTER_PATTERN.test(value)
}
