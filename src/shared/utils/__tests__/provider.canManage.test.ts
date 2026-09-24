import { describe, expect, it } from 'vitest'

import type { Provider } from '@shared/data/types/provider'

import { canManageProvider } from '../provider'

const provider = (id: string, presetProviderId?: string) => ({ id, presetProviderId }) as Provider

describe('canManageProvider', () => {
  it('rejects registry providers whose runtime and preset IDs differ', () => {
    expect(canManageProvider(provider('zai', 'zhipu'))).toBe(false)
  })

  it('rejects migrated canonical presets that are no longer in the registry', () => {
    expect(canManageProvider(provider('hunyuan', 'hunyuan'))).toBe(false)
  })

  it('allows user-created preset instances', () => {
    expect(canManageProvider(provider('openai-work', 'openai'))).toBe(true)
  })
})
