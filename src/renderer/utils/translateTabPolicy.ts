import type { Tab } from '@shared/data/cache/cacheValueTypes'

export const TRANSLATE_TAB_ID = 'translate'
export const TRANSLATE_TAB_URL = '/app/translate'

export const isTranslateTab = (tab: Pick<Tab, 'type' | 'url'>): boolean => {
  if (tab.type !== 'route') return false
  try {
    return new URL(tab.url, 'app://cherry').pathname === TRANSLATE_TAB_URL
  } catch {
    return false
  }
}

export const isProtectedAppTab = (tab: Pick<Tab, 'type' | 'url'>): boolean => isTranslateTab(tab)

export const createProtectedTranslateTab = (): Tab => ({
  id: TRANSLATE_TAB_ID,
  type: 'route',
  url: TRANSLATE_TAB_URL,
  title: '',
  lastAccessTime: Date.now(),
  isDormant: true,
  isPinned: false
})

/** Keep exactly one base-route Translate tab in the normal tab zone. */
export const reconcileProtectedTranslateTab = (tabs: Tab[]): { tabs: Tab[]; changed: boolean } => {
  const translateTabs = tabs.filter(isTranslateTab)
  if (translateTabs.length === 1 && translateTabs[0].url === TRANSLATE_TAB_URL && !translateTabs[0].isPinned) {
    return { tabs, changed: false }
  }

  const retained = translateTabs[0]
    ? { ...translateTabs[0], url: TRANSLATE_TAB_URL, isPinned: false }
    : createProtectedTranslateTab()

  return {
    tabs: [...tabs.filter((tab) => !isTranslateTab(tab)), retained],
    changed: true
  }
}
