import { describe, expect, it } from 'vitest'

import { getJsonStructureForDisplay, type JsonStructure, parseJsonStructure } from '../jsonStructure'

describe('parseJsonStructure', () => {
  it('parses strict roots, standalone fences, and copied-property wrappers', () => {
    const cases: Array<[string, string, JsonStructure]> = [
      ['strict object', '{"name":"Cherry","enabled":true}', { name: 'Cherry', enabled: true }],
      ['strict array', '[1,"two",null]', [1, 'two', null]],
      ['BOM and whitespace', '\uFEFF  \n {"value": 1} \n', { value: 1 }],
      ['unlabelled fence', '```\n{"value": 1}\n```', { value: 1 }],
      ['JSON fence', '```json\n{"value": 1}\n```', { value: 1 }],
      ['JSONC fence', '```jsonc\n{"value": 1,}\n```', { value: 1 }],
      ['JSON5 tilde fence', '~~~json5\n{value: 1}\n~~~', { value: 1 }],
      ['leading property around an array', '"copied": [{"value": 1}]', [{ value: 1 }]],
      ['leading property around an object', '“copied”: {"value": 1}', { value: 1 }]
    ]

    for (const [name, content, expected] of cases) {
      expect(parseJsonStructure(content), name).toEqual(expected)
    }
  })

  it('repairs tolerant JSON only after native parsing fails', () => {
    const cases: Array<[string, string, JsonStructure]> = [
      ['single quotes and unquoted keys', "{name: 'Cherry'}", { name: 'Cherry' }],
      ['curly formatter quotes', '{“中文键”: “中文值”}', { 中文键: '中文值' }],
      ['comments and trailing commas', '{/* note */ "items": [1, 2,],}', { items: [1, 2] }],
      ['missing comma', '{"first": 1 "second": 2}', { first: 1, second: 2 }],
      ['missing object closure', '{"value": 1', { value: 1 }],
      ['missing array closure', '[1, 2', [1, 2]]
    ]

    for (const [name, content, expected] of cases) {
      expect(parseJsonStructure(content), name).toEqual(expected)
    }
  })

  it('does not rewrite curly quotes inside valid string values', () => {
    expect(parseJsonStructure('{"message":"他说“你好”"}')).toEqual({ message: '他说“你好”' })
  })

  it('rejects scalar roots, explanations, trailing content, and multiple fences', () => {
    const cases = [
      '',
      'ordinary text',
      '"string scalar"',
      '42',
      'Before\n{"value": 1}',
      '{"value": 1}\nAfter',
      '{"value": 1},\nAfter',
      '{"value": 1},,',
      '[1, 2]\nAfter',
      '```json\n{"value": 1}\n```\nExtra',
      '```json\n{"value": 1}\n```\n```json\n{"value": 2}\n```',
      '```json\n```text\n{"value": 1}\n```\n```'
    ]

    for (const content of cases) {
      expect(parseJsonStructure(content), content).toBeNull()
    }
  })

  it('waits for completed translation and an enabled view', () => {
    const content = '{"value": 1}'

    expect(getJsonStructureForDisplay(content, true, true)).toBeNull()
    expect(getJsonStructureForDisplay(content, false, false)).toBeNull()
    expect(getJsonStructureForDisplay(content, true, false)).toEqual({ value: 1 })
  })
})
