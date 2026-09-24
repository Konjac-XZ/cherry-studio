import { describe, expect, it } from 'vitest'

import { normalizeEditedTranslateFontSize, normalizePersistedTranslateFontSize } from '@renderer/utils/translate'

describe('translate preference normalization', () => {
  it('accepts only persisted integer font sizes in the supported range', () => {
    expect(normalizePersistedTranslateFontSize(12)).toBe(12)
    expect(normalizePersistedTranslateFontSize(24)).toBe(24)
    expect(normalizePersistedTranslateFontSize(12.5)).toBe(16)
    expect(normalizePersistedTranslateFontSize(99)).toBe(16)
    expect(normalizePersistedTranslateFontSize('18')).toBe(16)
  })

  it('rounds and clamps user-edited font sizes', () => {
    expect(normalizeEditedTranslateFontSize('17.6')).toBe(18)
    expect(normalizeEditedTranslateFontSize(2)).toBe(12)
    expect(normalizeEditedTranslateFontSize(99)).toBe(24)
    expect(normalizeEditedTranslateFontSize('invalid')).toBe(16)
  })
})
