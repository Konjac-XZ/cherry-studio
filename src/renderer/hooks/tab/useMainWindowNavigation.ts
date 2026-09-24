import { useCallback, useEffect, useRef } from 'react'

import { loggerService } from '@logger'
import { useWindowInitData } from '@renderer/hooks/useWindowInitData'
import i18n from '@renderer/i18n/resolver'
import { ipcApi } from '@renderer/ipc'
import { OPEN_MAIN_ROUTE_EVENT, type OpenMainRouteEvent } from '@renderer/services/mainWindowNavigation'
import { isSettingsPath, normalizeSettingsPath, type SettingsPath } from '@shared/data/types/settingsPath'
import type { MainWindowInitData } from '@shared/types/mainWindow'

import { useTabs } from './useTabs'

const logger = loggerService.withContext('MainWindowNavigation')

function normalizeTranslateTabUrl(url: string): string | null {
  const normalized = url === '/translate' || url.startsWith('/translate?') ? `/app${url}` : url
  return normalized === '/app/translate' || normalized.startsWith('/app/translate?') ? normalized : null
}
function useOpenSettingsRoute() {
  const { tabs, openTab, setActiveTab, updateTab } = useTabs()
  const settingsTabIdRef = useRef<string | null>(null)
  const pendingSettingsPathRef = useRef<SettingsPath | null>(null)

  useEffect(() => {
    const settingsTab = tabs.find((tab) => tab.type === 'route' && isSettingsPath(tab.url))

    if (!settingsTab) {
      settingsTabIdRef.current = null
      return
    }

    settingsTabIdRef.current = settingsTab.id

    const pendingPath = pendingSettingsPathRef.current
    if (!pendingPath) {
      return
    }

    pendingSettingsPathRef.current = null
    updateTab(settingsTab.id, {
      url: pendingPath,
      title: i18n.t('settings.title'),
      lastAccessTime: Date.now()
    })
    setActiveTab(settingsTab.id)
  }, [tabs, setActiveTab, updateTab])

  return useCallback(
    (path: SettingsPath) => {
      const targetPath = normalizeSettingsPath(path)
      const title = i18n.t('settings.title')
      const settingsTab = tabs.find((tab) => tab.type === 'route' && isSettingsPath(tab.url))

      if (settingsTab) {
        updateTab(settingsTab.id, {
          url: targetPath,
          title,
          lastAccessTime: Date.now()
        })
        setActiveTab(settingsTab.id)
        return
      }

      if (settingsTabIdRef.current) {
        pendingSettingsPathRef.current = targetPath
        return
      }

      const settingsTabId = openTab(targetPath, { title })
      settingsTabIdRef.current = settingsTabId
    },
    [tabs, openTab, setActiveTab, updateTab]
  )
}

function useOpenTranslateRoute() {
  const { tabs, openTab, setActiveTab, updateTab } = useTabs()
  const translateTabIdRef = useRef<string | null>(null)
  const pendingTranslatePathRef = useRef<string | null>(null)

  useEffect(() => {
    const translateTab = tabs.find((tab) => tab.type === 'route' && normalizeTranslateTabUrl(tab.url))
    if (!translateTab) {
      translateTabIdRef.current = null
      return
    }

    translateTabIdRef.current = translateTab.id
    const pendingPath = pendingTranslatePathRef.current
    if (!pendingPath) return

    pendingTranslatePathRef.current = null
    updateTab(translateTab.id, { url: pendingPath, lastAccessTime: Date.now() })
    setActiveTab(translateTab.id)
  }, [setActiveTab, tabs, updateTab])

  return useCallback(
    (path: string) => {
      const targetPath = normalizeTranslateTabUrl(path)
      if (!targetPath) return false

      const translateTab = tabs.find((tab) => tab.type === 'route' && normalizeTranslateTabUrl(tab.url))
      if (translateTab) {
        logger.info('Applying Translate route to existing tab', { path: targetPath, tabId: translateTab.id })
        updateTab(translateTab.id, { url: targetPath, lastAccessTime: Date.now() })
        setActiveTab(translateTab.id)
        return true
      }

      if (translateTabIdRef.current) {
        logger.info('Queueing Translate route while tab is opening', {
          path: targetPath,
          tabId: translateTabIdRef.current
        })
        pendingTranslatePathRef.current = targetPath
        return true
      }

      translateTabIdRef.current = openTab(targetPath)
      logger.info('Opened Translate route in a new tab', { path: targetPath, tabId: translateTabIdRef.current })
      return true
    },
    [openTab, setActiveTab, tabs, updateTab]
  )
}

function useMainRouteEventBridge(handleRoute: (path: string) => void) {
  useEffect(() => {
    const handleOpenMainRoute = (event: Event) => {
      event.preventDefault()
      handleRoute((event as OpenMainRouteEvent).detail.path)
    }

    window.addEventListener(OPEN_MAIN_ROUTE_EVENT, handleOpenMainRoute)
    return () => {
      window.removeEventListener(OPEN_MAIN_ROUTE_EVENT, handleOpenMainRoute)
    }
  }, [handleRoute])
}

/**
 * Single consumption point for main-window init data + navigation events, mounted once in
 * MainWindowRuntime. Delivery legs:
 *
 * - `OPEN_MAIN_ROUTE_EVENT` DOM event — the in-window fast path used by
 *   `openRoute()` callers living in this window (preventDefault = handled ACK).
 * - Navigation init data — both cold-start and live-window paths; `requestId`
 *   dedupes replays and is acknowledged after the route is committed.
 * - `tab-attach` init data — the cold-start path for a detached tab being
 *   re-attached (openTabInMainWindow rebuilt the window around it); same
 *   request-id dedupe, delivered to `attachTab`.
 *
 * Settings paths land in the singleton settings tab; everything else goes
 * through `openTab`'s exact-URL dedupe.
 */
export function useMainWindowNavigation() {
  const openSettingsRoute = useOpenSettingsRoute()
  const openTranslateRoute = useOpenTranslateRoute()
  const { attachTab, openTab } = useTabs()
  const initData = useWindowInitData<MainWindowInitData>()
  const handledNavigationRequestIdRef = useRef<number | null>(null)

  const handleRoute = useCallback(
    (to: string) => {
      logger.info('Main window route request received', { path: to })
      if (isSettingsPath(to)) {
        openSettingsRoute(to)
      } else if (openTranslateRoute(to)) {
        return
      } else {
        openTab(to)
      }
    },
    [openSettingsRoute, openTab, openTranslateRoute]
  )

  useEffect(() => {
    if (initData?.kind !== 'navigation') return
    if (handledNavigationRequestIdRef.current === initData.requestId) return

    handledNavigationRequestIdRef.current = initData.requestId
    handleRoute(initData.to)
    void ipcApi.request('navigation.ack_open_route', { requestId: initData.requestId })
  }, [initData, handleRoute])

  // Cold-start tab re-attach: the window was rebuilt around a detached tab. Same
  // ack/dedupe discipline as navigation init data — the payload must not replay on reload.
  useEffect(() => {
    if (initData?.kind !== 'tab-attach') return
    if (handledNavigationRequestIdRef.current === initData.requestId) return

    handledNavigationRequestIdRef.current = initData.requestId
    attachTab(initData.tab)
    void ipcApi.request('navigation.ack_open_route', { requestId: initData.requestId })
  }, [initData, attachTab])

  useMainRouteEventBridge(handleRoute)

  useEffect(() => {
    void ipcApi.request('navigation.protocol_dispatch_ready')
  }, [])
}
