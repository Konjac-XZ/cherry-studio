import type { TranslateLanguageCode } from '@renderer/types'
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

export const TRANSLATION_POST_PROCESSOR_SETTING_KEYS = {
  zhCnMarkdownSmartQuotes: 'translate:postprocess:zhQuotes:enabled'
} as const

export type TranslationPostProcessorFeatures = {
  zhCnMarkdownSmartQuotes: boolean
}

export type TranslationPostProcessorContext = {
  features: TranslationPostProcessorFeatures
  markdownEnabled: boolean
  targetLanguage: TranslateLanguageCode
}

export const DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES: TranslationPostProcessorFeatures = {
  zhCnMarkdownSmartQuotes: false
}

const SIMPLIFIED_CHINESE_LANGUAGE_CODE = 'zh-cn'

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
const LETTER_OR_DIGIT_PATTERN = /[\p{L}\p{N}]/u
const LETTER_PATTERN = /\p{L}/u
const DIGIT_PATTERN = /\p{N}/u

const translationPostProcessors: TranslationPostProcessor[] = [
  {
    id: 'zh-cn-markdown-smart-quotes',
    process: (text) => normalizeZhCnMarkdownQuotes(text),
    shouldApply: shouldApplyZhCnMarkdownSmartQuotes
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

  const visitNode = (currentNode: MarkdownNode) => {
    if (!currentNode.type) {
      for (const child of currentNode.children || []) {
        visitNode(child)
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
      for (const child of currentNode.children || []) {
        visitNode(child)
      }
      return
    }

    if (currentNode.type === 'text') {
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

    for (const child of currentNode.children || []) {
      visitNode(child)
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
    let replacement: string | undefined

    if (character === "'" && isPrimeMark(previous, next)) {
      replacement = '′'
    } else if (character === '"' && isPrimeMark(previous, next)) {
      replacement = '″'
    } else if (character === "'" && isApostrophe(previous, next)) {
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
      edits.push({ offset: sourceOffset, replacement })
    }
  }

  return edits
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

function isApostrophe(previous: string | null, next: string | null): boolean {
  if (isLetterOrDigit(previous) && isLetterOrDigit(next)) {
    return true
  }

  if (isLetter(previous) && (!next || isWhitespace(next) || CLOSING_PUNCTUATION.has(next))) {
    return true
  }

  return (!previous || isWhitespace(previous) || OPENING_PUNCTUATION.has(previous)) && isDigit(next)
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

function applyOffsetEdits(source: string, edits: OffsetEdit[]): string {
  const uniqueEdits = new Map<number, string>()
  for (const edit of edits) {
    uniqueEdits.set(edit.offset, edit.replacement)
  }

  return [...uniqueEdits.entries()]
    .sort((left, right) => right[0] - left[0])
    .reduce((current, [offset, replacement]) => {
      return `${current.slice(0, offset)}${replacement}${current.slice(offset + 1)}`
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

function isLetterOrDigit(value: string | null): boolean {
  return value !== null && LETTER_OR_DIGIT_PATTERN.test(value)
}

function isLetter(value: string | null): boolean {
  return value !== null && LETTER_PATTERN.test(value)
}

function isDigit(value: string | null): boolean {
  return value !== null && DIGIT_PATTERN.test(value)
}
