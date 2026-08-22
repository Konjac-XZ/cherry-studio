import { CHERRYAI_PROVIDER_ID } from '@shared/data/presets/cherryai'
import type { Provider } from '@shared/data/types/provider'
import { canManageProvider } from '@shared/utils/provider'
import { SystemProviderIds } from '@shared/utils/systemProviderId'

/** Shared runtime/settings policy for user-hidden canonical built-in providers. */
export function isHiddenBuiltInProvider(provider: Provider, hiddenProviderIds: readonly string[]): boolean {
  return !canManageProvider(provider) && hiddenProviderIds.includes(provider.id)
}

export function filterRuntimeVisibleProviders(
  providers: readonly Provider[],
  hiddenProviderIds: readonly string[]
): Provider[] {
  return providers.filter((provider) => {
    const hiddenPreset = provider.presetProviderId && hiddenProviderIds.includes(provider.presetProviderId)
    const hiddenCherryAi =
      provider.id === CHERRYAI_PROVIDER_ID && hiddenProviderIds.includes(SystemProviderIds.cherryin)

    return !isHiddenBuiltInProvider(provider, hiddenProviderIds) && !hiddenPreset && !hiddenCherryAi
  })
}

export function filterHiddenBuiltInProviders(
  providers: readonly Provider[],
  hiddenProviderIds: readonly string[]
): Provider[] {
  return providers.filter((provider) => isHiddenBuiltInProvider(provider, hiddenProviderIds))
}
