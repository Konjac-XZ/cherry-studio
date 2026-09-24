import { useMemo } from 'react'

import { type TabsContextValue, useOptionalTabsContext } from '@renderer/hooks/tab'
import { useWindowFrame } from '@renderer/hooks/useWindowFrame'
import { ipcApi } from '@renderer/ipc'
import type { ConversationAppId } from '@renderer/types/conversation'
import { getSidebarApp } from '@renderer/utils/sidebar'

export interface ConversationNavigation {
  /**
   * Open a new tab on the conversation's own URL. Detached windows return
   * `undefined` instead of creating a hidden internal tab. The legacy
   * `forceNew` hint is accepted for upstream call-site compatibility but is
   * intentionally not forwarded to the unique-tab boundary.
   */
  openConversationTab: (key: string, title?: string, options?: { forceNew?: boolean }) => string | undefined
  /**
   * Open conversation `key` in the current tabs context when available; otherwise
   * open it in a detached window. Detached host windows always open elsewhere.
   */
  openConversation: (key: string, title?: string) => string | undefined
  /**
   * Open conversation `key` in a fresh detached window, leaving the current window's
   * tabs untouched. Unlike a tab detach this does not require `key` to be an open tab.
   */
  openConversationWindow: (key: string, title?: string) => void
}

function openConversationTabImpl(
  tabs: TabsContextValue | null,
  appId: ConversationAppId,
  key: string,
  title?: string
): string | undefined {
  const app = getSidebarApp(appId)
  if (!tabs || !app?.conversationRoute) return
  return tabs.openTab(app.conversationRoute.urlForKey(key), { title })
}

function openConversationWindowImpl(appId: ConversationAppId, key: string, title?: string): void {
  void ipcApi.request('navigation.focus_or_open_conversation', {
    target: {
      conversationType: appId === 'assistants' ? 'assistant' : 'agent',
      conversationId: key
    },
    title: title ?? ''
  })
}

/**
 * Single boundary for "navigate to a conversation tab" intents (chat topic / agent
 * session), bound to one app. Built on the SIDEBAR_APPS registry's key↔URL mapping
 * (`conversationRoute`), so pages and lists stop touching the tabs context, `openTab`, or URL
 * helpers directly.
 *
 * Degrades to no-ops when there is no TabsProvider (tests, detached popups) or when the
 * app has no `conversationRoute`.
 */
export function useConversationNavigation(appId: ConversationAppId): ConversationNavigation {
  const tabs = useOptionalTabsContext()
  const isDetachedWindowFrame = useWindowFrame().mode === 'window'

  return useMemo<ConversationNavigation>(
    () => ({
      openConversationTab: (key, title) =>
        isDetachedWindowFrame ? undefined : openConversationTabImpl(tabs, appId, key, title),
      openConversation: (key, title) => {
        if (tabs && !isDetachedWindowFrame) return openConversationTabImpl(tabs, appId, key, title)
        openConversationWindowImpl(appId, key, title)
        return undefined
      },
      openConversationWindow: (key, title) => openConversationWindowImpl(appId, key, title)
    }),
    [appId, isDetachedWindowFrame, tabs]
  )
}
