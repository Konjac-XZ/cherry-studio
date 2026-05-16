import type { GlossaryEntry } from '@renderer/types'
import { describe, expect, it } from 'vitest'

import { buildCustomizedDictionary, buildFullCustomizedDictionary } from '../GlossaryService'

const createGlossaryEntry = (sourcePhrase: string, targetPhrase: string, targetLanguage = 'zh-cn'): GlossaryEntry => ({
  id: `${sourcePhrase}-${targetLanguage}`,
  sourcePhrase,
  targetPhrase,
  targetLanguage,
  createdAt: 1,
  updatedAt: 1
})

describe('GlossaryService dictionary builders', () => {
  it('builds a full customized dictionary with all entries', () => {
    const entries = [createGlossaryEntry('Cherry Studio', 'Cherry Studio'), createGlossaryEntry('prompt', '提示词')]

    expect(buildFullCustomizedDictionary(entries)).toBe('Cherry Studio -> Cherry Studio\nprompt -> 提示词')
  })

  it('returns an empty-state message for a full customized dictionary with no entries', () => {
    expect(buildFullCustomizedDictionary([])).toBe('[No glossary entries configured]')
  })

  it('keeps source-text matching behavior for translation dictionaries', () => {
    const entries = [createGlossaryEntry('Cherry Studio', 'Cherry Studio'), createGlossaryEntry('prompt', '提示词')]

    expect(buildCustomizedDictionary(entries, 'Use Cherry Studio for translation.')).toBe(
      'Cherry Studio -> Cherry Studio'
    )
  })
})
