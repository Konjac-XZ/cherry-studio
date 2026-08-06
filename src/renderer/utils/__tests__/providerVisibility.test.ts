import type { Provider } from '@shared/data/types/provider'
import { describe, expect, it } from 'vitest'

import {
  filterHiddenBuiltInProviders,
  filterRuntimeVisibleProviders,
  isHiddenBuiltInProvider
} from '../providerVisibility'

const provider = (id: string, presetProviderId?: string) => ({ id, presetProviderId }) as Provider

describe('providerVisibility', () => {
  const canonicalOpenAi = provider('openai', 'openai')
  const customOpenAi = provider('openai-work', 'openai')
  const canonicalAnthropic = provider('anthropic', 'anthropic')

  it('recognizes hidden canonical built-ins but never hidden custom instances', () => {
    expect(isHiddenBuiltInProvider(canonicalOpenAi, ['openai'])).toBe(true)
    expect(isHiddenBuiltInProvider(customOpenAi, ['openai-work'])).toBe(false)
  })

  it('uses complementary runtime and recovery projections', () => {
    const providers = [canonicalOpenAi, customOpenAi, canonicalAnthropic]

    expect(filterRuntimeVisibleProviders(providers, ['openai'])).toEqual([customOpenAi, canonicalAnthropic])
    expect(filterHiddenBuiltInProviders(providers, ['openai', 'openai-work'])).toEqual([canonicalOpenAi])
  })
})
