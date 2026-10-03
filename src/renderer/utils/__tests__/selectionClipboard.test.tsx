import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { copySelectionAsSemanticHtml } from '../selectionClipboard'

function select(start: Node, startOffset = 0, end = start, endOffset = start.textContent!.length) {
  const range = document.createRange()
  range.setStart(start, startOffset)
  range.setEnd(end, endOffset)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

function copy(target: Element) {
  const data = new Map<string, string>()
  const event = new Event('copy', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: { setData: (type: string, value: string) => data.set(type, value) }
  })
  fireEvent(target, event)
  const html = document.createElement('div')
  html.innerHTML = data.get('text/html') ?? ''
  return { data, html, event }
}

afterEach(() => window.getSelection()?.removeAllRanges())

describe('semantic selection clipboard', () => {
  it('copies partial body text without display styles or heading semantics', () => {
    render(
      <div
        style={{ fontSize: 20, fontFamily: 'UI Font', background: 'red' }}
        onCopy={(event) => copySelectionAsSemanticHtml(event, false)}>
        <p className="text-foreground" style={{ fontSize: 20 }}>
          <span data-ui="body">ordinary body text</span>
        </p>
      </div>
    )
    const body = screen.getByText('ordinary body text')
    select(body.firstChild!, 9, body.firstChild!, 13)
    const { data, html, event } = copy(body)
    expect(event.defaultPrevented).toBe(true)
    expect(data.get('text/plain')).toBe('body')
    expect(html.querySelector('p')?.textContent).toBe('body')
    expect(html.querySelector('h1, [style], [class], [data-ui], [role], [aria-level]')).toBeNull()
  })

  it('preserves partially selected links and Streamdown emphasis as semantic HTML', () => {
    render(
      <div onCopy={(event) => copySelectionAsSemanticHtml(event, false)}>
        <p>
          <a href="https://example.com/article" className="text-link">
            <span data-streamdown="strong" className="font-semibold">
              <em>linked words</em>
            </span>
          </a>
        </p>
      </div>
    )
    const text = screen.getByText('linked words')
    select(text.firstChild!, 0, text.firstChild!, 6)
    const { html } = copy(text)
    expect(html.querySelector('a')?.getAttribute('href')).toBe('https://example.com/article')
    expect(html.querySelector('a strong em')?.textContent).toBe('linked')
    expect(html.querySelector('[class], [data-streamdown]')).toBeNull()
  })

  it('keeps paragraphs, real headings, lists, tables and code while excluding action chrome', () => {
    const { container } = render(
      <div onCopy={(event) => copySelectionAsSemanticHtml(event, false)}>
        <h2>Real heading</h2>
        <p>
          Body <code>inline</code>
        </p>
        <ol start={3}>
          <li>First</li>
          <li>Second</li>
        </ol>
        <table>
          <tbody>
            <tr>
              <td colSpan={2}>Cell</td>
            </tr>
          </tbody>
        </table>
        <div data-streamdown="code-block-header">typescript</div>
        <button type="button">Copy</button>
        <pre style={{ background: 'black' }}>
          <code>
            <span style={{ color: 'red' }}>{'line one\nline two'}</span>
          </code>
        </pre>
      </div>
    )
    const root = container.firstElementChild!
    const range = document.createRange()
    range.selectNodeContents(root)
    window.getSelection()!.addRange(range)
    const { html } = copy(root)
    expect(html.querySelector('h2')?.textContent).toBe('Real heading')
    expect(html.querySelector('p code')?.textContent).toBe('inline')
    expect(html.querySelector('ol')?.getAttribute('start')).toBe('3')
    expect(html.querySelectorAll('li')).toHaveLength(2)
    expect(html.querySelector('td')?.getAttribute('colspan')).toBe('2')
    expect(html.querySelector('pre code')?.textContent).toBe('line one\nline two')
    expect(html.textContent).not.toContain('typescript')
    expect(html.querySelector('button, [style], [class], [data-streamdown]')).toBeNull()
  })

  it('exports selected CodeViewer lines as code without line numbers or syntax colors', () => {
    render(
      <div onCopy={(event) => copySelectionAsSemanticHtml(event, false)}>
        <div className="shiki-scroller">
          <div>
            <div>
              <span className="line-number">1</span>
              <span className="line-content">
                <span style={{ color: 'red' }}>{'  first line'}</span>
              </span>
            </div>
            <div>
              <span className="line-number">2</span>
              <span className="line-content">{'  second line'}</span>
            </div>
          </div>
        </div>
      </div>
    )
    const first = screen.getByText('first line')
    const second = screen.getByText('second line')
    select(first.firstChild!, 2, second.firstChild!, 8)
    const { html } = copy(first)
    expect(html.querySelector('pre code')?.textContent).toBe('first line\n  second')
    expect(html.querySelector('[class], [style]')).toBeNull()
  })
  it('preserves literal Markdown, escaping and line breaks in plain-text output', () => {
    render(
      <div onCopy={(event) => copySelectionAsSemanticHtml(event, true)}>
        <div>{'**literal** <tag> & text\nnext line'}</div>
      </div>
    )
    const body = screen.getByText(/literal/)
    select(body.firstChild!)
    const { data, html } = copy(body)
    expect(data.get('text/plain')).toBe('**literal** <tag> & text\nnext line')
    expect(html.innerHTML).toBe('**literal** &lt;tag&gt; &amp; text<br>next line')
    expect(html.querySelector('strong, pre')).toBeNull()
  })

  it('leaves cross-boundary selections and already handled child copies alone', () => {
    render(
      <>
        <div onCopy={(event) => copySelectionAsSemanticHtml(event, false)}>
          <p>Inside</p>
          <pre
            onCopy={(event) => {
              event.clipboardData.setData('text/plain', 'complete virtualized code')
              event.preventDefault()
            }}>
            Code
          </pre>
        </div>
        <p>Outside</p>
      </>
    )
    const inside = screen.getByText('Inside')
    const outside = screen.getByText('Outside')
    select(inside.firstChild!, 0, outside.firstChild!, 7)
    expect(copy(inside).event.defaultPrevented).toBe(false)
    const code = screen.getByText('Code')
    select(code.firstChild!)
    const { data } = copy(code)
    expect(data.get('text/plain')).toBe('complete virtualized code')
    expect(data.has('text/html')).toBe(false)
  })

  it('leaves formula selections to the existing TeX copy handler', () => {
    render(
      <div onCopy={(event) => copySelectionAsSemanticHtml(event, false)}>
        <span className="katex">
          <span>formula</span>
        </span>
      </div>
    )
    const formula = screen.getByText('formula')
    select(formula.firstChild!)
    expect(copy(formula).event.defaultPrevented).toBe(false)
  })
})
