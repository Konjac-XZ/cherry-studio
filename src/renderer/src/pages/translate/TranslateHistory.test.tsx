import type { TranslateHistory } from '@renderer/types'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const toArray = vi.fn()
  const limitToArray = vi.fn()
  const limit = vi.fn(() => ({ toArray: limitToArray }))
  const reverse = vi.fn(() => ({ limit, toArray }))
  const orderBy = vi.fn(() => ({ reverse }))
  const count = vi.fn()

  return {
    clearHistory: vi.fn(),
    deleteHistory: vi.fn(),
    updateTranslateHistory: vi.fn(),
    getLanguageByLangcode: vi.fn((langCode: string) => ({
      value: langCode,
      langCode,
      emoji: '',
      label: () => langCode
    })),
    orderBy,
    count,
    reverse,
    limit,
    toArray,
    limitToArray,
    virtualList: vi.fn()
  }
})

vi.mock('@renderer/databases', () => ({
  default: {
    translate_history: {
      orderBy: mocks.orderBy,
      count: mocks.count
    }
  }
}))

vi.mock('@renderer/hooks/useTranslate', () => ({
  default: () => ({
    getLanguageByLangcode: mocks.getLanguageByLangcode
  })
}))

vi.mock('@renderer/services/TranslateService', () => ({
  clearHistory: mocks.clearHistory,
  deleteHistory: mocks.deleteHistory,
  updateTranslateHistory: mocks.updateTranslateHistory
}))

vi.mock('@renderer/components/VirtualList', () => ({
  DynamicVirtualList: ({ list, children }: any) => {
    mocks.virtualList(list)

    return (
      <div data-testid="history-list">
        {list.map((item: TranslateHistory, index: number) => (
          <div key={item.id}>{children(item, index)}</div>
        ))}
      </div>
    )
  }
}))

vi.mock('@renderer/config/translate', () => ({
  UNKNOWN: {
    value: 'unknown',
    langCode: 'unknown',
    emoji: '',
    label: () => 'unknown'
  }
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (querier: () => TranslateHistory[] | Promise<TranslateHistory[]>) => querier()
}))

vi.mock('react-i18next', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

import TranslateHistoryList from './TranslateHistory'

const createHistory = (index: number, overrides: Partial<TranslateHistory> = {}): TranslateHistory => ({
  id: `history-${index}`,
  sourceText: `source ${index}`,
  targetText: `target ${index}`,
  sourceLanguage: 'en-us',
  targetLanguage: 'zh-cn',
  createdAt: new Date(2026, 0, 1, 0, index).toISOString(),
  ...overrides
})

const createHistories = (count: number) => Array.from({ length: count }, (_, index) => createHistory(index + 1))

describe('TranslateHistoryList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.limitToArray.mockReturnValue([])
    mocks.toArray.mockReturnValue([])
    mocks.count.mockReturnValue(0)

    Object.defineProperty(window, 'toast', {
      value: {
        error: vi.fn()
      },
      writable: true,
      configurable: true
    })
    Object.defineProperty(window, 'getComputedStyle', {
      value: vi.fn(() => ({
        getPropertyValue: vi.fn(() => '')
      })),
      writable: true,
      configurable: true
    })
  })

  it('loads only the newest render limit in default history view', () => {
    const limitedHistory = createHistories(200)
    mocks.limitToArray.mockReturnValue(limitedHistory)
    mocks.count.mockReturnValue(limitedHistory.length)

    render(<TranslateHistoryList isOpen onClose={vi.fn()} onHistoryItemClick={vi.fn()} />)

    expect(mocks.orderBy).toHaveBeenCalledWith('createdAt')
    expect(mocks.reverse).toHaveBeenCalled()
    expect(mocks.limit).toHaveBeenCalledWith(200)
    expect(mocks.toArray).not.toHaveBeenCalled()
    expect(mocks.virtualList).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'history-1' })])
    )
    expect(mocks.virtualList.mock.lastCall?.[0]).toHaveLength(200)
  })

  it('searches full history but renders at most the display limit', () => {
    const fullHistory = [
      ...createHistories(200),
      createHistory(201, { sourceText: 'needle source' }),
      ...Array.from({ length: 210 }, (_, index) => createHistory(index + 202, { sourceText: `needle ${index}` }))
    ]
    mocks.limitToArray.mockReturnValue(createHistories(200))
    mocks.toArray.mockReturnValue(fullHistory)

    render(<TranslateHistoryList isOpen onClose={vi.fn()} onHistoryItemClick={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('translate.history.search.placeholder'), {
      target: { value: 'needle' }
    })

    const renderedHistory = mocks.virtualList.mock.lastCall?.[0]

    expect(mocks.toArray).toHaveBeenCalled()
    expect(renderedHistory).toHaveLength(200)
    expect(renderedHistory[0]).toEqual(expect.objectContaining({ id: 'history-201' }))
  })

  it('loads all history for starred view and caps rendered starred entries', () => {
    const fullHistory = [
      ...createHistories(200),
      ...Array.from({ length: 210 }, (_, index) => createHistory(index + 201, { star: true }))
    ]
    mocks.limitToArray.mockReturnValue(createHistories(200))
    mocks.toArray.mockReturnValue(fullHistory)

    render(<TranslateHistoryList isOpen onClose={vi.fn()} onHistoryItemClick={vi.fn()} />)
    fireEvent.click(screen.getAllByRole('button')[0])

    const renderedHistory = mocks.virtualList.mock.lastCall?.[0]

    expect(mocks.toArray).toHaveBeenCalled()
    expect(renderedHistory).toHaveLength(200)
    expect(renderedHistory[0]).toEqual(expect.objectContaining({ id: 'history-201', star: true }))
  })
})
