import {
  isTranslateToolbarCompact,
  TRANSLATE_TOOLBAR_COMPACT_WIDTH
} from '@renderer/pages/translate/hooks/useTranslateToolbarVisibility'
import { describe, expect, it } from 'vitest'

describe('translate toolbar visibility', () => {
  it('switches to compact priorities below the 900px container threshold', () => {
    expect(isTranslateToolbarCompact(TRANSLATE_TOOLBAR_COMPACT_WIDTH - 1)).toBe(true)
    expect(isTranslateToolbarCompact(TRANSLATE_TOOLBAR_COMPACT_WIDTH)).toBe(false)
  })
})
