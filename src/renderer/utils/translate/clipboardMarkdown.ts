import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

const turndown = new TurndownService({
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  fence: '```',
  headingStyle: 'atx',
  hr: '---',
  preformattedCode: true,
  strongDelimiter: '**'
})

turndown.use(gfm)
turndown.addRule('typoraCodeFence', {
  filter: (node) =>
    node.nodeName === 'PRE' && (node.classList?.contains('md-fences') || Boolean(node.querySelector('code'))),
  replacement: (_content, node) => {
    const pre = node
    const code = pre.querySelector('code')
    const raw = (code?.textContent ?? pre.textContent ?? '').replace(/\n$/, '')
    const classes = [...Array.from(code?.classList ?? []), ...Array.from(pre.classList ?? [])]
    const language =
      code?.getAttribute('data-language') ??
      code?.getAttribute('data-lang') ??
      pre.getAttribute('data-language') ??
      pre.getAttribute('data-lang') ??
      classes.map((name) => name.match(/^(?:language-|lang-)(.+)$/)?.[1]).find(Boolean) ??
      ''
    return `\n\n\`\`\`${language}\n${raw}\n\`\`\`\n\n`
  }
})

export const htmlToTranslateMarkdown = (html: string): string => (html.trim() ? turndown.turndown(html).trimEnd() : '')

export const shouldPreferPlainTextCodeBlock = (html: string, plainText: string): boolean => {
  if (!html || !plainText.trim()) return false
  const hasCodeBlockHtml = /<(pre|code)\b/i.test(html) || /md-fences/i.test(html)
  if (!hasCodeBlockHtml) return false
  const normalized = plainText.replace(/\r\n/g, '\n')
  return /```[\s\S]*```/.test(normalized) || /(^|\n)(\t| {2,})\S/.test(normalized)
}

const MARKDOWN_BLOCK_PATTERN = /(^|\n)\s{0,3}(?:#{1,6}\s|>\s?|[-+*]\s|\d+[.)]\s|```|~~~|\|[^\n]+\|)/
const EDITOR_WRAPPER_TAGS = new Set(['html', 'head', 'meta', 'style', 'body', 'div', 'span', 'br'])

/** Prefer authoritative Markdown text when HTML contains syntax-highlighting wrappers only. */
export const shouldPreferPlainTextClipboard = (html: string, plainText: string): boolean => {
  if (shouldPreferPlainTextCodeBlock(html, plainText)) return true
  if (!html.trim() || !MARKDOWN_BLOCK_PATTERN.test(plainText.replace(/\r\n/g, '\n'))) return false

  if (typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(html, 'text/html')
    return Array.from(document.querySelectorAll('*')).every((element) =>
      EDITOR_WRAPPER_TAGS.has(element.tagName.toLowerCase())
    )
  }

  const tags = html.match(/<\/?([a-z][\w-]*)\b[^>]*>/gi) ?? []
  return tags.every((tag) => {
    const name = tag.match(/^<\/?([a-z][\w-]*)/i)?.[1]?.toLowerCase()
    return name !== undefined && EDITOR_WRAPPER_TAGS.has(name)
  })
}

export const clipboardFingerprint = (text: string): string => text.trim().replace(/\r\n/g, '\n')
