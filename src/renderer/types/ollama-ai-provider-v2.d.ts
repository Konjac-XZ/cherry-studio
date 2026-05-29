declare module 'ollama-ai-provider-v2' {
  export interface OllamaCompletionProviderOptions {
    model?: string
    stream?: boolean
    baseURL?: string
    headers?: Record<string, string>
    [key: string]: unknown
  }

  // Factory function provided by the package; typed as any to avoid breaking typecheck
  export function createOllama(options?: Record<string, unknown>): any
}
