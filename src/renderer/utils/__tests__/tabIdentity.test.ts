import type { Tab } from '@shared/data/cache/cacheValueTypes'
import { deduplicateTabsByPage, getTabPageIdentity, isSameTabPage } from '@shared/utils/tabIdentity'
import { describe, expect, it } from 'vitest'

const tab = (id: string, url: string): Tab => ({ id, type: 'route', url, title: id })

describe('tabIdentity', () => {
  it('treats reordered query parameters as the same route page', () => {
    expect(
      isSameTabPage(
        { type: 'route', url: '/app/agents?sessionId=s1&agentId=a1' },
        { type: 'route', url: '/app/agents?agentId=a1&sessionId=s1' }
      )
    ).toBe(true)
  })

  it('keeps distinct entity routes and tab types separate', () => {
    expect(
      isSameTabPage({ type: 'route', url: '/app/chat?topicId=one' }, { type: 'route', url: '/app/chat?topicId=two' })
    ).toBe(false)
    expect(getTabPageIdentity({ type: 'route', url: 'https://example.com' })).not.toBe(
      getTabPageIdentity({ type: 'webview', url: 'https://example.com' })
    )
  })

  it('uses stable entity identity while ignoring conversation actions', () => {
    expect(
      isSameTabPage(
        { type: 'route', url: '/app/chat?topicId=t1&view=message&intent=feedback' },
        { type: 'route', url: '/app/chat?topicId=t1' }
      )
    ).toBe(true)
    expect(
      isSameTabPage(
        { type: 'route', url: '/app/agents?sessionId=s1&agentId=a1' },
        { type: 'route', url: '/app/agents?sessionId=s1' }
      )
    ).toBe(true)
  })

  it('collapses singleton workspace state without merging distinct mini apps or files', () => {
    expect(isSameTabPage({ type: 'route', url: '/settings/general' }, { type: 'route', url: '/settings/model' })).toBe(
      true
    )
    expect(isSameTabPage({ type: 'route', url: '/app/code?tool=a' }, { type: 'route', url: '/app/code?tool=b' })).toBe(
      true
    )
    expect(
      isSameTabPage(
        { type: 'route', url: '/app/mini-app/calculator?state=one' },
        { type: 'route', url: '/app/mini-app/calculator#two' }
      )
    ).toBe(true)
    expect(
      isSameTabPage({ type: 'route', url: '/app/mini-app/calculator' }, { type: 'route', url: '/app/mini-app/docs' })
    ).toBe(false)
    expect(
      isSameTabPage(
        { type: 'route', url: '/app/file-preview?path=C%3A%5Cdocs%5Ca.pdf' },
        { type: 'route', url: '/app/file-preview?path=C%3A%5Cdocs%5Cb.pdf' }
      )
    ).toBe(false)
  })

  it('deduplicates restored pages while retaining the active copy', () => {
    const result = deduplicateTabsByPage(
      [tab('first', '/app/knowledge?b=2&a=1'), tab('active', '/app/knowledge?a=1&b=2'), tab('other', '/app/files')],
      'active'
    )

    expect(result.changed).toBe(true)
    expect(result.tabs.map(({ id }) => id)).toEqual(['active', 'other'])
  })
})
