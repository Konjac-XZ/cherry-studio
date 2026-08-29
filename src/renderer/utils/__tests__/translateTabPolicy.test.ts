import type { Tab } from '@shared/data/cache/cacheValueTypes'
import { describe, expect, it } from 'vitest'

import {
  CHAT_HOME_TAB_ID,
  CHAT_HOME_TAB_URL,
  createProtectedChatTab,
  createProtectedTranslateTab,
  isProtectedAppTab,
  reconcileProtectedAppTabs,
  reconcileProtectedTranslateTab,
  TRANSLATE_TAB_ID,
  TRANSLATE_TAB_URL
} from '../translateTabPolicy'

const routeTab = (id: string, url: string, overrides: Partial<Tab> = {}): Tab => ({
  id,
  type: 'route',
  url,
  title: id,
  lastAccessTime: 0,
  isDormant: false,
  isPinned: false,
  ...overrides
})

describe('translateTabPolicy', () => {
  it('protects only fixed workspace ids while leaving illegal route duplicates removable', () => {
    expect(createProtectedChatTab()).toMatchObject({
      id: CHAT_HOME_TAB_ID,
      url: CHAT_HOME_TAB_URL,
      isDormant: false,
      isPinned: false
    })
    expect(isProtectedAppTab(routeTab('home', '/app/chat?topicId=active'))).toBe(true)
    expect(isProtectedAppTab(routeTab('another-chat', '/app/chat?topicId=other'))).toBe(false)
    expect(isProtectedAppTab(routeTab('translate', '/app/translate'))).toBe(true)
    expect(isProtectedAppTab(routeTab('duplicate-translate', '/app/translate'))).toBe(false)
  })

  it('creates one awake, unpinned Translate workspace with the stable id', () => {
    expect(createProtectedTranslateTab()).toMatchObject({
      id: TRANSLATE_TAB_ID,
      url: TRANSLATE_TAB_URL,
      isDormant: false,
      isPinned: false
    })
  })

  it('merges restored Translate duplicates and repairs protected state without losing a pending route command', () => {
    const result = reconcileProtectedTranslateTab([
      routeTab('home', '/app/chat'),
      routeTab('old-translate', '/app/translate?paste=1&nonce=abc', { isDormant: true, isPinned: true }),
      routeTab('duplicate', '/app/translate')
    ])

    expect(result.changed).toBe(true)
    expect(result.tabs.filter((tab) => tab.url.startsWith(TRANSLATE_TAB_URL))).toEqual([
      expect.objectContaining({
        id: TRANSLATE_TAB_ID,
        url: '/app/translate?paste=1&nonce=abc',
        isDormant: false,
        isPinned: false
      })
    ])
  })

  it('restores one fixed Chat workspace without merging separate conversation tabs', () => {
    const result = reconcileProtectedAppTabs([
      routeTab('home', '/app/chat?topicId=active', { isDormant: true, isPinned: true }),
      routeTab('conversation', '/app/chat?topicId=other'),
      routeTab('translate', '/app/translate')
    ])

    expect(result.tabs).toEqual([
      expect.objectContaining({ id: 'conversation', url: '/app/chat?topicId=other' }),
      expect.objectContaining({ id: 'home', url: '/app/chat?topicId=active', isDormant: false, isPinned: false }),
      expect.objectContaining({ id: 'translate', url: '/app/translate' })
    ])
  })
})
