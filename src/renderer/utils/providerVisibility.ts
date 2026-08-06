import { isSystemProviderId } from '@renderer/types/provider'
import type { Provider } from '@shared/data/types/provider'

/** Shared runtime/settings policy for user-hidden canonical built-in providers. */
export function isHiddenBuiltInProvider(provider: Provider, hiddenProviderIds: readonly string[]): boolean {
  return isSystemProviderId(provider.id) && hiddenProviderIds.includes(provider.id)
}

export function filterRuntimeVisibleProviders(
  providers: readonly Provider[],
  hiddenProviderIds: readonly string[]
): Provider[] {
  return providers.filter((provider) => !isHiddenBuiltInProvider(provider, hiddenProviderIds))
}

export function filterHiddenBuiltInProviders(
  providers: readonly Provider[],
  hiddenProviderIds: readonly string[]
): Provider[] {
  return providers.filter((provider) => isHiddenBuiltInProvider(provider, hiddenProviderIds))
}
