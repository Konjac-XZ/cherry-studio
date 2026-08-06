import { describe, expect, it } from 'vitest'

import { normalizeJsonStructureSelection } from '../jsonStructureCopy'

describe('normalizeJsonStructureSelection', () => {
  it.each([
    ['colon-space', '规则描述: 规则内容'],
    ['colon-newline', '规则描述:\n规则内容'],
    ['chinese-colon', '规则描述：规则内容'],
    ['chinese-colon-newline', '规则描述：\n规则内容']
  ] as const)('uses the %s separator', (copySeparator, expected) => {
    expect(normalizeJsonStructureSelection('规则描述\n:\n规则内容', copySeparator, false)).toBe(expected)
  })

  it('preserves CRLF row separators while normalizing flex column boundaries', () => {
    expect(
      normalizeJsonStructureSelection('规则描述\r\n : \r\n规则内容\r\n偏差描述\r\n:\r\n偏差内容', 'colon-space', false)
    ).toBe('规则描述: 规则内容\r\n偏差描述: 偏差内容')
  })

  it('adds one blank line between rows without doubling a newline-bearing column separator', () => {
    expect(normalizeJsonStructureSelection('规则描述\n:\n规则内容\n偏差描述\n:\n偏差内容', 'colon-newline', true)).toBe(
      '规则描述:\n规则内容\n\n偏差描述:\n偏差内容'
    )
  })

  it('leaves a selection without flex column boundaries untouched', () => {
    expect(normalizeJsonStructureSelection('规则内容', 'colon-space', true)).toBe('规则内容')
  })
})
