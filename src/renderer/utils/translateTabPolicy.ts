import type { Tab } from '@shared/data/cache/cacheValueTypes'

export const TRANSLATE_TAB_ID = 'translate'
export const TRANSLATE_TAB_URL = '/app/translate'
export const CHAT_HOME_TAB_ID = 'home'
export const CHAT_HOME_TAB_URL = '/app/chat'

const routePath = (tab: Pick<Tab, 'type' | 'url'>): string | null => {
  if (tab.type !== 'route') return null
  try {
    return new URL(tab.url, 'app://cherry').pathname
  } catch {
    return null
  }
}

export const isTranslateTab = (tab: Pick<Tab, 'type' | 'url'>): boolean => {
  return routePath(tab) === TRANSLATE_TAB_URL
}

export const isChatRouteTab = (tab: Pick<Tab, 'type' | 'url'>): boolean => routePath(tab) === CHAT_HOME_TAB_URL

export const isChatHomeEntryUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url, 'app://cherry')
    return parsed.pathname === CHAT_HOME_TAB_URL && parsed.search === ''
  } catch {
    return false
  }
}

export const isProtectedChatTab = (tab: Pick<Tab, 'id'>): boolean => tab.id === CHAT_HOME_TAB_ID

export const isProtectedTranslateTab = (tab: Pick<Tab, 'id'>): boolean => tab.id === TRANSLATE_TAB_ID

export const isProtectedAppTab = (tab: Pick<Tab, 'id'>): boolean =>
  isProtectedChatTab(tab) || isProtectedTranslateTab(tab)

export const canUpdateProtectedAppTabUrl = (tab: Pick<Tab, 'id' | 'type' | 'url'>, url: string): boolean => {
  if (isProtectedChatTab(tab)) return isChatRouteTab({ type: 'route', url })
  if (isProtectedTranslateTab(tab)) return isTranslateTab({ type: 'route', url })
  return true
}

export const createProtectedChatTab = (): Tab => ({
  id: CHAT_HOME_TAB_ID,
  type: 'route',
  url: CHAT_HOME_TAB_URL,
  title: '',
  lastAccessTime: Date.now(),
  isDormant: false,
  isPinned: false
})

export const createProtectedTranslateTab = (): Tab => ({
  id: TRANSLATE_TAB_ID,
  type: 'route',
  url: TRANSLATE_TAB_URL,
  title: '',
  lastAccessTime: Date.now(),
  isDormant: false,
  isPinned: false
})

/** Keep exactly one protected Translate tab in the normal tab zone. */
export const reconcileProtectedTranslateTab = (tabs: Tab[]): { tabs: Tab[]; changed: boolean } => {
  const translateTabs = tabs.filter(isTranslateTab)
  if (
    translateTabs.length === 1 &&
    translateTabs[0].id === TRANSLATE_TAB_ID &&
    !translateTabs[0].isPinned &&
    !translateTabs[0].isDormant
  ) {
    return { tabs, changed: false }
  }

  const retained = translateTabs[0]
    ? { ...translateTabs[0], id: TRANSLATE_TAB_ID, isDormant: false, isPinned: false }
    : createProtectedTranslateTab()

  return {
    tabs: [...tabs.filter((tab) => !isTranslateTab(tab)), retained],
    changed: true
  }
}

/** Keep the dedicated Chat and Translate workspaces in the normal tab zone. */
export const reconcileProtectedAppTabs = (tabs: Tab[]): { tabs: Tab[]; changed: boolean } => {
  const homeTab = tabs.find(isProtectedChatTab)
  const retainedHome = homeTab && isChatRouteTab(homeTab) ? homeTab : createProtectedChatTab()
  const translateTabs = tabs.filter(isTranslateTab)
  const retainedTranslateSource = translateTabs.find(isProtectedTranslateTab) ?? translateTabs[0]
  const retainedTranslate = retainedTranslateSource
    ? { ...retainedTranslateSource, id: TRANSLATE_TAB_ID, isDormant: false, isPinned: false }
    : createProtectedTranslateTab()
  const normalizedHome = {
    ...retainedHome,
    id: CHAT_HOME_TAB_ID,
    isDormant: false,
    isPinned: false
  }
  const tabsWithProtected = [
    ...tabs.filter((tab) => !isProtectedAppTab(tab) && !isTranslateTab(tab)),
    normalizedHome,
    retainedTranslate
  ]
  const changed =
    translateTabs.length !== 1 ||
    translateTabs[0]?.id !== TRANSLATE_TAB_ID ||
    translateTabs[0]?.isPinned === true ||
    translateTabs[0]?.isDormant === true ||
    !homeTab ||
    !isChatRouteTab(homeTab) ||
    homeTab.isPinned === true ||
    homeTab.isDormant === true ||
    tabs.filter(isProtectedChatTab).length !== 1

  return { tabs: tabsWithProtected, changed }
}
