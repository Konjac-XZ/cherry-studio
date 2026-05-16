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

type OffsetEdit = {
  deleteCount: number
  offset: number
  replacement: string
}

type ProtectedRange = {
  end: number
  start: number
}

type InlineSpacingUnit = {
  end: number
  firstVisible: string | null
  lastVisible: string | null
  raw: string
  start: number
  visibleText: string
}

type TextSpacingToken = {
  firstVisible: string | null
  lastVisible: string | null
  raw: string
  visibleText: string
}

const CONTAINER_TYPES = new Set(['heading', 'paragraph', 'tableCell'])
const OPAQUE_INLINE_NODE_TYPES = new Set(['break', 'image', 'imageReference', 'inlineCode', 'inlineMath'])
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
const QUOTE_PUNCTUATION = new Set(['"', "'"])

const URL_PATTERN = /\b(?:https?:\/\/|mailto:|www\.)[^\s<>()\]]+/giu
const WINDOWS_PATH_PATTERN = /\b[a-zA-Z]:\\(?:[^\\\s]+\\)*[^\\\s]+/g
const UNIX_PATH_PATTERN = /(?:^|\s)(?:\.\.\/|\.\/|\/)(?:[^\s/]+\/)+[^\s/]+/g
const SLASH_COMPOUND_PATTERN =
  /(?:[\u3400-\u9fff\uf900-\ufaff]{1,2}\/[\u3400-\u9fff\uf900-\ufaff]{1,2}|[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)/gu
const FILE_EXTENSION_PATTERN = /\.[A-Za-z][A-Za-z0-9_-]*/gu
const STRUCTURED_JSON_PATTERN = /^\s*[[{][\s\S]*[\]}]\s*$/u
const YAML_LINE_PATTERN = /^\s*[A-Za-z0-9_-]+\s*:\s*.+$/u
const SHELL_COMMAND_PATTERN =
  /^(?:[$>#]\s*)?(?:pnpm|npm|yarn|git|node|python|bash|sh|pwsh|powershell|curl|wget|cd|ls|cat)\b/u
const CJK_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/u
const DIGIT_PATTERN = /\p{N}/u
const LATIN_LETTER_PATTERN = /[A-Za-z]/u

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

  const edits: OffsetEdit[] = []
  collectContainerSpacingEdits(root, markdown, protectedRanges, edits)

  if (edits.length === 0) {
    return markdown
  }

  return applyOffsetEdits(markdown, edits)
}

function collectContainerSpacingEdits(
  node: MarkdownNode,
  markdown: string,
  protectedRanges: ProtectedRange[],
  edits: OffsetEdit[]
): void {
  if (!node.type) {
    for (const child of node.children || []) {
      collectContainerSpacingEdits(child, markdown, protectedRanges, edits)
    }
    return
  }

  if (CONTAINER_TYPES.has(node.type)) {
    const nodeRange = getNodeRange(node)
    if (!nodeRange || isProtectedOffsetRange(nodeRange.start, nodeRange.end, protectedRanges)) {
      return
    }

    const visibleText = collectContainerVisibleText(node)
    if (visibleText && looksLikeStructuredText(visibleText)) {
      return
    }

    const spacedContainer = buildSpacedCompositeUnit(node, markdown, protectedRanges)
    if (spacedContainer && spacedContainer.raw !== markdown.slice(nodeRange.start, nodeRange.end)) {
      edits.push({
        deleteCount: nodeRange.end - nodeRange.start,
        offset: nodeRange.start,
        replacement: spacedContainer.raw
      })
    }
    return
  }

  for (const child of node.children || []) {
    collectContainerSpacingEdits(child, markdown, protectedRanges, edits)
  }
}

function buildSpacedCompositeUnit(
  node: MarkdownNode,
  markdown: string,
  protectedRanges: ProtectedRange[]
): InlineSpacingUnit | null {
  const nodeRange = getNodeRange(node)
  if (!nodeRange) {
    return null
  }

  const childUnits = buildInlineSpacingUnits(node.children || [], markdown, protectedRanges)
  if (childUnits.length === 0) {
    const raw = markdown.slice(nodeRange.start, nodeRange.end)
    return {
      end: nodeRange.end,
      firstVisible: findFirstVisibleChar(raw),
      lastVisible: findLastVisibleChar(raw),
      raw,
      start: nodeRange.start,
      visibleText: raw
    }
  }

  let raw = ''
  let cursor = nodeRange.start
  let previousVisibleUnit: InlineSpacingUnit | null = null

  for (const childUnit of childUnits) {
    if (cursor <= childUnit.start) {
      const gap = markdown.slice(cursor, childUnit.start)
      raw += normalizeInlineSlotGap(gap, previousVisibleUnit, childUnit)
    }

    raw += childUnit.raw
    cursor = childUnit.end

    if (childUnit.firstVisible) {
      previousVisibleUnit = childUnit
    }
  }

  if (cursor < nodeRange.end) {
    raw += markdown.slice(cursor, nodeRange.end)
  }

  return {
    end: nodeRange.end,
    firstVisible: findFirstVisibleChild(childUnits),
    lastVisible: findLastVisibleChild(childUnits),
    raw,
    start: nodeRange.start,
    visibleText: childUnits.map((childUnit) => childUnit.visibleText).join('')
  }
}

function buildInlineSpacingUnits(
  nodes: MarkdownNode[],
  markdown: string,
  protectedRanges: ProtectedRange[]
): InlineSpacingUnit[] {
  const units: InlineSpacingUnit[] = []

  for (let index = 0; index < nodes.length; index += 1) {
    const htmlAtom = matchHtmlInlineAtom(nodes, index, markdown)
    if (htmlAtom) {
      units.push(htmlAtom.unit)
      index = htmlAtom.endIndex
      continue
    }

    const unit = buildInlineSpacingUnit(nodes[index], markdown, protectedRanges)
    if (unit) {
      units.push(unit)
    }
  }

  return units
}

function buildInlineSpacingUnit(
  node: MarkdownNode,
  markdown: string,
  protectedRanges: ProtectedRange[]
): InlineSpacingUnit | null {
  if (!node.type) {
    return null
  }

  if (node.type === 'text') {
    return buildTextSpacingUnit(node, markdown, protectedRanges)
  }

  if (node.type === 'link' && isAutolinkLikeLink(node)) {
    return buildOpaqueInlineUnit(node, markdown, collectNodeVisibleText(node))
  }

  if (OPAQUE_INLINE_NODE_TYPES.has(node.type) || node.type === 'html') {
    return buildOpaqueInlineUnit(node, markdown, collectNodeVisibleText(node))
  }

  if (node.children?.length) {
    return buildSpacedCompositeUnit(node, markdown, protectedRanges)
  }

  return buildOpaqueInlineUnit(node, markdown, collectNodeVisibleText(node))
}

function buildTextSpacingUnit(
  node: MarkdownNode,
  markdown: string,
  protectedRanges: ProtectedRange[]
): InlineSpacingUnit | null {
  const nodeRange = getNodeRange(node)
  if (!nodeRange) {
    return null
  }

  const raw = markdown.slice(nodeRange.start, nodeRange.end)
  const spaced = isProtectedOffsetRange(nodeRange.start, nodeRange.end, protectedRanges)
    ? raw
    : normalizeTextSpacingWithAtoms(raw)

  return {
    end: nodeRange.end,
    firstVisible: findFirstVisibleChar(spaced),
    lastVisible: findLastVisibleChar(spaced),
    raw: spaced,
    start: nodeRange.start,
    visibleText: spaced
  }
}

function buildOpaqueInlineUnit(node: MarkdownNode, markdown: string, visibleText: string): InlineSpacingUnit | null {
  const nodeRange = getNodeRange(node)
  if (!nodeRange) {
    return null
  }

  const raw = markdown.slice(nodeRange.start, nodeRange.end)
  return {
    end: nodeRange.end,
    firstVisible: findFirstAtomBoundaryChar(visibleText),
    lastVisible: findLastAtomBoundaryChar(visibleText),
    raw,
    start: nodeRange.start,
    visibleText
  }
}

function matchHtmlInlineAtom(
  nodes: MarkdownNode[],
  startIndex: number,
  markdown: string
): { endIndex: number; unit: InlineSpacingUnit } | null {
  const startNode = nodes[startIndex]
  if (startNode.type !== 'html' || !startNode.value) {
    return null
  }

  const tagName = getHtmlTagName(startNode.value)
  if (!tagName || !isOpeningHtmlTag(startNode.value)) {
    return buildOpaqueInlineAtomMatch(nodes, startIndex, startIndex, markdown)
  }

  let depth = 1
  for (let index = startIndex + 1; index < nodes.length; index += 1) {
    const currentNode = nodes[index]
    if (currentNode.type !== 'html' || !currentNode.value || getHtmlTagName(currentNode.value) !== tagName) {
      continue
    }

    if (isOpeningHtmlTag(currentNode.value)) {
      depth += 1
      continue
    }

    if (isClosingHtmlTag(currentNode.value)) {
      depth -= 1
      if (depth === 0) {
        return buildOpaqueInlineAtomMatch(nodes, startIndex, index, markdown)
      }
    }
  }

  return buildOpaqueInlineAtomMatch(nodes, startIndex, startIndex, markdown)
}

function buildOpaqueInlineAtomMatch(
  nodes: MarkdownNode[],
  startIndex: number,
  endIndex: number,
  markdown: string
): { endIndex: number; unit: InlineSpacingUnit } | null {
  const startRange = getNodeRange(nodes[startIndex])
  const endRange = getNodeRange(nodes[endIndex])
  if (!startRange || !endRange) {
    return null
  }

  const visibleText = nodes
    .slice(startIndex, endIndex + 1)
    .map((node) => collectNodeVisibleText(node))
    .join('')
  return {
    endIndex,
    unit: {
      end: endRange.end,
      firstVisible: findFirstAtomBoundaryChar(visibleText),
      lastVisible: findLastAtomBoundaryChar(visibleText),
      raw: markdown.slice(startRange.start, endRange.end),
      start: startRange.start,
      visibleText
    }
  }
}

function normalizeInlineSlotGap(gap: string, leftUnit: InlineSpacingUnit | null, rightUnit: InlineSpacingUnit): string {
  const leftVisible = leftUnit?.lastVisible ?? null
  const rightVisible = rightUnit.firstVisible
  if (!leftVisible || !rightVisible) {
    return gap
  }

  if (gap.includes('\n') || gap.includes('\r') || (gap && !/^\s+$/u.test(gap))) {
    return gap
  }

  if (leftUnit && (endsWithWhitespace(leftUnit.raw) || startsWithWhitespace(rightUnit.raw))) {
    return gap
  }

  return shouldInsertSpaceBetween(leftVisible, rightVisible) ? ' ' : ''
}

function shouldInsertSpaceBetween(leftVisible: string, rightVisible: string): boolean {
  const leftClass = classifyVisibleBoundary(leftVisible)
  const rightClass = classifyVisibleBoundary(rightVisible)

  if (
    leftClass === 'closing-punctuation' ||
    leftClass === 'dash' ||
    leftClass === 'opening-punctuation' ||
    rightClass === 'closing-punctuation' ||
    rightClass === 'dash' ||
    rightClass === 'opening-punctuation'
  ) {
    return false
  }

  return spacingWithPangu(`${leftVisible}${rightVisible}`) === `${leftVisible} ${rightVisible}`
}

function classifyVisibleBoundary(
  value: string
): 'cjk' | 'closing-punctuation' | 'dash' | 'digit' | 'latin' | 'opening-punctuation' | 'other' {
  if (value === '—') {
    return 'dash'
  }

  if (OPENING_PUNCTUATION.has(value) || QUOTE_PUNCTUATION.has(value)) {
    return 'opening-punctuation'
  }

  if (CLOSING_PUNCTUATION.has(value) || QUOTE_PUNCTUATION.has(value)) {
    return 'closing-punctuation'
  }

  if (CJK_PATTERN.test(value)) {
    return 'cjk'
  }

  if (DIGIT_PATTERN.test(value)) {
    return 'digit'
  }

  if (LATIN_LETTER_PATTERN.test(value)) {
    return 'latin'
  }

  return 'other'
}

function collectContainerVisibleText(node: MarkdownNode): string {
  return (node.children || []).map((child) => collectNodeVisibleText(child)).join('')
}

function collectNodeVisibleText(node: MarkdownNode): string {
  if (node.type === 'html' || node.type === 'break') {
    return ''
  }

  if (typeof node.value === 'string') {
    return node.value
  }

  return (node.children || []).map((child) => collectNodeVisibleText(child)).join('')
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

function normalizeTextSpacingWithAtoms(text: string): string {
  const atomRanges = normalizeRanges(collectTextAtomRanges(text))
  if (atomRanges.length === 0) {
    return cleanupZhMarkdownSpacing(spacingWithPangu(text))
  }

  const tokens: TextSpacingToken[] = []
  let cursor = 0

  for (const range of atomRanges) {
    if (cursor < range.start) {
      tokens.push(buildMutableTextToken(text.slice(cursor, range.start)))
    }

    tokens.push(buildAtomTextToken(text.slice(range.start, range.end)))
    cursor = range.end
  }

  if (cursor < text.length) {
    tokens.push(buildMutableTextToken(text.slice(cursor)))
  }

  return composeTextSpacingTokens(tokens)
}

function collectTextAtomRanges(text: string): ProtectedRange[] {
  return [URL_PATTERN, WINDOWS_PATH_PATTERN, UNIX_PATH_PATTERN, SLASH_COMPOUND_PATTERN, FILE_EXTENSION_PATTERN].flatMap(
    (pattern) => {
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
    }
  )
}

function buildMutableTextToken(raw: string): TextSpacingToken {
  const spaced = cleanupZhMarkdownSpacing(spacingWithPangu(raw))
  return {
    firstVisible: findFirstVisibleChar(spaced),
    lastVisible: findLastVisibleChar(spaced),
    raw: spaced,
    visibleText: spaced
  }
}

function buildAtomTextToken(raw: string): TextSpacingToken {
  return buildTextSpacingToken(raw, raw)
}

function buildTextSpacingToken(raw: string, visibleText: string): TextSpacingToken {
  return {
    firstVisible: findFirstAtomBoundaryChar(visibleText),
    lastVisible: findLastAtomBoundaryChar(visibleText),
    raw,
    visibleText
  }
}

function composeTextSpacingTokens(tokens: TextSpacingToken[]): string {
  let result = ''
  let previousVisibleToken: TextSpacingToken | null = null

  for (const token of tokens) {
    result += normalizeTextTokenBoundary(previousVisibleToken, token)
    result += token.raw

    if (token.firstVisible) {
      previousVisibleToken = token
    }
  }

  return result
}

function normalizeTextTokenBoundary(leftToken: TextSpacingToken | null, rightToken: TextSpacingToken): string {
  const leftVisible = leftToken?.lastVisible ?? null
  const rightVisible = rightToken.firstVisible
  if (!leftVisible || !rightVisible) {
    return ''
  }

  if (leftToken && (endsWithWhitespace(leftToken.raw) || startsWithWhitespace(rightToken.raw))) {
    return ''
  }

  return shouldInsertSpaceBetween(leftVisible, rightVisible) ? ' ' : ''
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

function cleanupZhMarkdownSpacing(text: string): string {
  return text
    .replace(/(\*\*|__)\s+([\u3400-\u9fff\uf900-\ufaff\p{N}])/gu, '$1$2')
    .replace(/([\u3400-\u9fff\uf900-\ufaff\p{N}])\s+(\*\*|__)/gu, '$1$2')
    .replace(/([\u3400-\u9fff\uf900-\ufaff])\s+(["“‘])/gu, '$1$2')
    .replace(/(["”’])\s+([\u3400-\u9fff\uf900-\ufaff])/gu, '$1$2')
    .replace(/(["”’])\s+([、。！，；：？！])/gu, '$1$2')
    .replace(/([^\s])\s+(——)\s+([^\s])/gu, '$1$2$3')
    .replace(/([^\s])\s+(——)/gu, '$1$2')
    .replace(/(——)\s+([^\s])/gu, '$1$2')
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

function findFirstVisibleChar(text: string): string | null {
  for (let index = 0; index < text.length; index += 1) {
    if (!isWhitespace(text[index])) {
      return text[index]
    }
  }

  return null
}

function findLastVisibleChar(text: string): string | null {
  for (let index = text.length - 1; index >= 0; index -= 1) {
    if (!isWhitespace(text[index])) {
      return text[index]
    }
  }

  return null
}

function findFirstAtomBoundaryChar(text: string): string | null {
  return findSemanticBoundaryChar(text, 0, 1) ?? findFirstVisibleChar(text)
}

function findLastAtomBoundaryChar(text: string): string | null {
  return findSemanticBoundaryChar(text, text.length - 1, -1) ?? findLastVisibleChar(text)
}

function findSemanticBoundaryChar(text: string, startIndex: number, step: 1 | -1): string | null {
  for (let index = startIndex; index >= 0 && index < text.length; index += step) {
    const character = text[index]
    if (CJK_PATTERN.test(character) || DIGIT_PATTERN.test(character) || LATIN_LETTER_PATTERN.test(character)) {
      return character
    }
  }

  return null
}

function findFirstVisibleChild(units: InlineSpacingUnit[]): string | null {
  for (const unit of units) {
    if (unit.firstVisible) {
      return unit.firstVisible
    }
  }

  return null
}

function findLastVisibleChild(units: InlineSpacingUnit[]): string | null {
  for (let index = units.length - 1; index >= 0; index -= 1) {
    if (units[index].lastVisible) {
      return units[index].lastVisible
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

function isWhitespace(value: string | null): boolean {
  return value !== null && /\s/u.test(value)
}

function startsWithWhitespace(value: string): boolean {
  return value.length > 0 && isWhitespace(value[0])
}

function endsWithWhitespace(value: string): boolean {
  return value.length > 0 && isWhitespace(value[value.length - 1])
}
