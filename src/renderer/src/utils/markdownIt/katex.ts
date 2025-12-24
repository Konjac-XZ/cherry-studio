import katex from 'katex'
import type MarkdownIt from 'markdown-it'
import type { RuleInline } from 'markdown-it/lib/parser_inline.mjs'
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs'
import type Token from 'markdown-it/lib/token.mjs'

interface KatexState {
  enabled: boolean
  allowSingleDollar: boolean
}

type KatexAwareMarkdownIt = MarkdownIt & { __cherryKatexState?: KatexState }

const DOLLAR = 0x24
const BACKSLASH = 0x5c
const SPACE = 0x20
const TAB = 0x09
const NEWLINE = 0x0a

const isWhitespace = (code: number) => code === SPACE || code === TAB || code === NEWLINE

const countBackslashes = (input: string, pos: number) => {
  let count = 0
  for (let i = pos - 1; i >= 0 && input.charCodeAt(i) === BACKSLASH; i--) {
    count++
  }
  return count
}

const findClosing = (src: string, marker: string, start: number) => {
  let pos = start
  const step = marker.length
  while (pos >= 0) {
    const found = src.indexOf(marker, pos)
    if (found === -1) {
      return -1
    }
    if (countBackslashes(src, found) % 2 === 0) {
      return found
    }
    pos = found + step
  }
  return -1
}

const createInlineRule = (state: KatexState): RuleInline => {
  return (inlineState: StateInline, silent: boolean) => {
    if (!state.enabled) return false

    const start = inlineState.pos
    const max = inlineState.posMax
    const src = inlineState.src

    if (start >= max) return false
    if (src.charCodeAt(start) !== DOLLAR) return false
    if (start > 0 && src.charCodeAt(start - 1) === BACKSLASH) return false

    const isDouble = start + 1 < max && src.charCodeAt(start + 1) === DOLLAR
    const marker = isDouble ? '$$' : '$'

    if (!isDouble && !state.allowSingleDollar) return false
    if (isDouble && start + 2 < max && src.charCodeAt(start + 2) === DOLLAR) return false

    const nextIndex = isDouble ? start + 2 : start + 1
    if (nextIndex >= max) return false
    if (!isDouble && isWhitespace(src.charCodeAt(nextIndex))) return false

    const end = findClosing(src, marker, nextIndex)
    if (end === -1) return false
    if (!isDouble && isWhitespace(src.charCodeAt(end - 1))) return false

    const content = src.slice(nextIndex, end).trim()
    if (!content) return false

    if (!silent) {
      const token = inlineState.push('cherry_katex_inline', 'math', 0)
      token.content = content
      token.meta = { ...(token.meta ?? {}), displayMode: isDouble }
    }

    inlineState.pos = end + marker.length
    return true
  }
}

const renderKatex = (token: Token) => {
  try {
    return katex.renderToString(token.content, {
      throwOnError: false,
      displayMode: Boolean((token.meta as Record<string, unknown> | undefined)?.displayMode)
    })
  } catch {
    return token.content
  }
}

export const configureKatex = (md: MarkdownIt, enabled: boolean, allowSingleDollar: boolean) => {
  const awareMd = md as KatexAwareMarkdownIt
  if (!awareMd.__cherryKatexState) {
    const initialState: KatexState = {
      enabled,
      allowSingleDollar
    }
    awareMd.__cherryKatexState = initialState
    md.inline.ruler.after('escape', 'cherry_katex', createInlineRule(initialState))
    md.renderer.rules.cherry_katex_inline = (tokens, idx) => renderKatex(tokens[idx])
  } else {
    awareMd.__cherryKatexState.enabled = enabled
    awareMd.__cherryKatexState.allowSingleDollar = allowSingleDollar
  }
}
