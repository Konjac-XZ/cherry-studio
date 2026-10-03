import DOMPurify from 'dompurify'
import type { ClipboardEvent } from 'react'

const semanticTags = [
  'p',
  'br',
  'div',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'sup',
  'sub',
  'blockquote',
  'ul',
  'ol',
  'li',
  'a',
  'pre',
  'code',
  'hr',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'img'
]
const semanticAttributes = [
  'href',
  'src',
  'alt',
  'title',
  'start',
  'reversed',
  'value',
  'colspan',
  'rowspan',
  'scope',
  'dir',
  'lang'
]

export function copySelectionAsSemanticHtml(event: ClipboardEvent<HTMLDivElement>, plainText: boolean): void {
  if (event.defaultPrevented || !event.clipboardData) return

  const root = event.currentTarget
  const selection = root.ownerDocument.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return

  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return

  const container = root.ownerDocument.createElement('div')
  const selectedText = selection.toString()
  if (plainText) {
    for (const [index, line] of selectedText.split(/\r\n?|\n/).entries()) {
      if (index) container.append(root.ownerDocument.createElement('br'))
      container.append(root.ownerDocument.createTextNode(line))
    }
  } else {
    let contents: Node = range.cloneContents()
    let ancestor = range.commonAncestorContainer
    if (ancestor.nodeType !== Node.ELEMENT_NODE) ancestor = ancestor.parentNode!

    // cloneContents omits shared ancestors, including a partially selected link or emphasis.
    while (ancestor !== root) {
      const wrapper = ancestor.cloneNode(false)
      wrapper.appendChild(contents)
      contents = wrapper
      ancestor = ancestor.parentNode!
    }
    container.append(contents)

    // KaTeX's copy-tex handler owns formula selections and restores their TeX source.
    if (container.querySelector('.katex')) return

    // CodeViewer uses virtualized divs; export selected visible lines as a code block.
    for (const viewer of container.querySelectorAll('.shiki-scroller')) {
      const pre = root.ownerDocument.createElement('pre')
      const code = root.ownerDocument.createElement('code')
      code.textContent = Array.from(viewer.querySelectorAll('.line-content'), (line) => line.textContent).join('\n')
      pre.append(code)
      viewer.replaceWith(pre)
    }
    for (const span of container.querySelectorAll('[data-streamdown="strong"]')) {
      const strong = root.ownerDocument.createElement('strong')
      strong.append(...span.childNodes)
      span.replaceWith(strong)
    }
    container
      .querySelectorAll('button, [data-streamdown="code-block-header"], [data-streamdown="code-block-actions"]')
      .forEach((node) => node.remove())
  }

  // Supplying detached DOM HTML avoids Chromium's computed-style selection serializer.
  const html = DOMPurify.sanitize(container.innerHTML, {
    ALLOWED_TAGS: semanticTags,
    ALLOWED_ATTR: semanticAttributes,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false
  })
  event.clipboardData.setData('text/plain', selectedText)
  event.clipboardData.setData('text/html', html)
  event.preventDefault()
}
