import type { Tab } from '@shared/data/cache/cacheValueTypes'
import { canonicalizeFilePath } from '@shared/utils/file'

const FILE_PREVIEW_ROUTE = '/app/file-preview'
const MINI_APP_ROUTE_PREFIX = '/app/mini-app/'
const SINGLETON_ROUTE_PATHS = new Set([
  '/app/code',
  '/app/files',
  '/app/knowledge',
  '/app/launchpad',
  '/app/notes',
  '/app/release-notes'
])

const routeIdentity = (parsed: URL): string => {
  const { pathname, searchParams } = parsed
  if (pathname === '/app/translate') return '/app/translate'
  if (pathname === '/app/paintings' || pathname.startsWith('/app/paintings/')) return '/app/paintings'
  if (pathname === '/settings' || pathname.startsWith('/settings/')) return '/settings'
  if (SINGLETON_ROUTE_PATHS.has(pathname)) return pathname

  if (pathname.startsWith(MINI_APP_ROUTE_PREFIX)) {
    const appId = pathname.slice(MINI_APP_ROUTE_PREFIX.length).split('/', 1)[0]
    if (appId) return `${MINI_APP_ROUTE_PREFIX}${encodeURIComponent(appId)}`
  }

  if (pathname === '/app/chat') {
    const topicId = searchParams.get('topicId')
    if (topicId) return `/app/chat?topicId=${encodeURIComponent(topicId)}`
    const assistantId = searchParams.get('assistantId')
    return assistantId ? `/app/chat?assistantId=${encodeURIComponent(assistantId)}` : pathname
  }

  if (pathname === '/app/agents') {
    const sessionId = searchParams.get('sessionId')
    if (sessionId) return `/app/agents?sessionId=${encodeURIComponent(sessionId)}`
    const agentId = searchParams.get('agentId')
    return agentId ? `/app/agents?agentId=${encodeURIComponent(agentId)}` : pathname
  }

  if (pathname === FILE_PREVIEW_ROUTE) {
    const path = searchParams.get('path')
    if (!path) return FILE_PREVIEW_ROUTE
    try {
      return `${FILE_PREVIEW_ROUTE}?path=${encodeURIComponent(canonicalizeFilePath(path))}`
    } catch {
      return FILE_PREVIEW_ROUTE
    }
  }

  searchParams.sort()
  return `${pathname}${parsed.search}`
}

const normalizeUrl = (type: Tab['type'], url: string): string => {
  try {
    const parsed = new URL(url, 'app://cherry')
    if (type === 'route') {
      if (
        parsed.pathname.startsWith('/app/') ||
        parsed.pathname === '/settings' ||
        parsed.pathname.startsWith('/settings/')
      ) {
        return routeIdentity(parsed)
      }
      if (parsed.protocol === 'app:') return `${parsed.pathname}${parsed.search}`
      parsed.searchParams.sort()
      return parsed.href
    }
    parsed.searchParams.sort()
    return parsed.href
  } catch {
    return url
  }
}

/** Semantic page identity shared by renderer tabs and detached windows. */
export const getTabPageIdentity = (tab: Pick<Tab, 'type' | 'url'>): string =>
  `${tab.type}:${normalizeUrl(tab.type, tab.url)}`

export const isSameTabPage = (left: Pick<Tab, 'type' | 'url'>, right: Pick<Tab, 'type' | 'url'>): boolean =>
  getTabPageIdentity(left) === getTabPageIdentity(right)

export const deduplicateTabsByPage = (tabs: Tab[], preferredTabId?: string): { tabs: Tab[]; changed: boolean } => {
  const uniqueTabs: Tab[] = []
  const identityIndexes = new Map<string, number>()

  for (const tab of tabs) {
    const identity = getTabPageIdentity(tab)
    const existingIndex = identityIndexes.get(identity)
    if (existingIndex === undefined) {
      identityIndexes.set(identity, uniqueTabs.length)
      uniqueTabs.push(tab)
      continue
    }

    if (tab.id === preferredTabId && uniqueTabs[existingIndex].id !== preferredTabId) {
      uniqueTabs[existingIndex] = tab
    }
  }

  return { tabs: uniqueTabs, changed: uniqueTabs.length !== tabs.length }
}
