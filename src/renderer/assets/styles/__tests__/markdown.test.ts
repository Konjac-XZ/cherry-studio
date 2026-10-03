import { readFileSync } from 'node:fs'

import postcss, { type Rule } from 'postcss'
import { describe, expect, it } from 'vitest'

const markdownStyles = readFileSync('src/renderer/assets/styles/markdown.css', 'utf8')

describe('translate code block styles', () => {
  it('reserves separate header space for the toolbar without clipping its sticky container', () => {
    const declarationsFor = (selector: string) => {
      const declarations: Record<string, string> = {}
      postcss.parse(markdownStyles).walkRules((rule) => {
        if (rule.selectors.includes(selector)) {
          rule.walkDecls((declaration) => {
            declarations[declaration.prop] = declaration.value
          })
        }
      })
      return declarations
    }
    const scope = "[data-ui~='translate.output'] .markdown"

    expect(declarationsFor(`${scope} pre:has(> .code-block)`)).toMatchObject({ overflow: 'visible' })
    expect(declarationsFor(`${scope} .code-block`)).toMatchObject({
      display: 'grid',
      'grid-template-columns': 'minmax(0, 1fr) auto'
    })
    expect(declarationsFor(`${scope} .code-block > .code-block-header`)).toMatchObject({
      'grid-area': '1 / 1',
      overflow: 'hidden',
      'white-space': 'nowrap'
    })
    expect(declarationsFor(`${scope} .code-block > [data-ui~='ui.code-toolbar']`)).toMatchObject({
      'grid-area': '1 / 2',
      height: 'auto'
    })
    expect(declarationsFor(`${scope} .code-block .code-toolbar`)).toMatchObject({
      position: 'static',
      height: 'auto',
      'flex-wrap': 'wrap'
    })
    expect(declarationsFor(`${scope} .code-block > .split-view-wrapper`)).toMatchObject({
      'grid-column': '1 / -1'
    })
  })
})

describe('markdown image capture styles', () => {
  it('unclips inline and block formula bounds while capturing', () => {
    const expectedSelectors = [
      '[data-image-capturing] .katex',
      '[data-image-capturing] .katex-display',
      '[data-image-capturing] mjx-container'
    ]
    let captureRule: Rule | undefined

    postcss.parse(markdownStyles).walkRules((rule) => {
      if (expectedSelectors.every((selector) => rule.selectors.includes(selector))) {
        captureRule = rule
      }
    })

    // The capture marker is the layout contract; static exports cannot scroll clipped formula boxes.
    const overflow = captureRule?.nodes.find((node) => node.type === 'decl' && node.prop === 'overflow')
    expect(overflow).toMatchObject({ value: 'visible', important: true })
  })
})

describe('markdown table styles', () => {
  it('preserves word boundaries in intrinsically sized cells', () => {
    let tableCellRule: Rule | undefined

    postcss.parse(markdownStyles).walkRules((rule) => {
      if (rule.selectors.includes('.markdown th') && rule.selectors.includes('.markdown td')) {
        tableCellRule = rule
      }
    })

    const declarations = Object.fromEntries(
      tableCellRule?.nodes
        .filter((node) => node.type === 'decl')
        .map((declaration) => [declaration.prop, declaration.value]) ?? []
    )

    expect(declarations).toMatchObject({
      'overflow-wrap': 'break-word',
      'word-break': 'normal'
    })
  })
})
