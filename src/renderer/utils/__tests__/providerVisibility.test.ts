import { describe, expect, it } from 'vitest'

import { CHERRYAI_PROVIDER_ID } from '@shared/data/presets/cherryai'
import type { Provider } from '@shared/data/types/provider'

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
  const migratedCanonicalHunyuan = provider('hunyuan', 'hunyuan')

  it('recognizes hidden canonical built-ins but never hidden custom instances', () => {
    expect(isHiddenBuiltInProvider(canonicalOpenAi, ['openai'])).toBe(true)
    expect(isHiddenBuiltInProvider(customOpenAi, ['openai-work'])).toBe(false)
  })

  it('recognizes hidden migrated canonical presets that are absent from the current registry', () => {
    expect(isHiddenBuiltInProvider(migratedCanonicalHunyuan, ['hunyuan'])).toBe(true)
    expect(filterRuntimeVisibleProviders([migratedCanonicalHunyuan, canonicalAnthropic], ['hunyuan'])).toEqual([
      canonicalAnthropic
    ])
  })

  it('hides every runtime instance of a hidden preset while keeping only its canonical row recoverable', () => {
    const providers = [canonicalOpenAi, customOpenAi, canonicalAnthropic]

    expect(filterRuntimeVisibleProviders(providers, ['openai'])).toEqual([canonicalAnthropic])
    expect(filterHiddenBuiltInProviders(providers, ['openai', 'openai-work'])).toEqual([canonicalOpenAi])
  })

  it('hides the managed CherryAI model entry together with CherryIN', () => {
    const cherryIn = provider('cherryin', 'cherryin')
    const cherryAi = provider(CHERRYAI_PROVIDER_ID, CHERRYAI_PROVIDER_ID)

    expect(filterRuntimeVisibleProviders([cherryIn, cherryAi, canonicalAnthropic], ['cherryin'])).toEqual([
      canonicalAnthropic
    ])
  })
})
