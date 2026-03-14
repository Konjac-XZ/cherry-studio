import type { JSONValue } from 'ai'

export function getQuickModelProviderOptionsOverrides(modelId: string): Record<string, JSONValue> | undefined {
  const normalizedModelId = modelId.toLowerCase()
  const providerOptionsOverrides: Record<string, JSONValue> = {}

  if (normalizedModelId.includes('qwen')) {
    providerOptionsOverrides.enable_thinking = false
  }

  if (normalizedModelId.includes('doubao')) {
    providerOptionsOverrides.reasoningEffort = 'minimal'
  }

  if (normalizedModelId.includes('glm')) {
    providerOptionsOverrides.thinking = {
      type: 'disabled'
    }
  }

  return Object.keys(providerOptionsOverrides).length > 0 ? providerOptionsOverrides : undefined
}
