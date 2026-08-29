export type LocaleCatalog = Record<string, string>

/**
 * Compose the effective renderer catalog without mutating any source object.
 *
 * Downstream English additions provide the fallback for every supported
 * locale. Sparse locale translations override those additions, while the
 * explicit override layer preserves intentional changes to upstream-owned
 * keys.
 */
export function composeLocale(
  upstream: LocaleCatalog,
  customEnglish: LocaleCatalog,
  customLocale: LocaleCatalog = {},
  overrides: LocaleCatalog = {}
): LocaleCatalog {
  return { ...upstream, ...customEnglish, ...customLocale, ...overrides }
}
