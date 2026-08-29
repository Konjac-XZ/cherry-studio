import { translationWorkspaceService } from '@renderer/services/translation'
import { parseTranslateLangCode } from '@shared/data/preference/preferenceTypes'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Activity, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  translateText: vi.fn()
}))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@renderer/utils/translate', () => ({
  translateText: (...args: unknown[]) => mocks.translateText(...args)
}))
vi.mock('@renderer/utils/error', () => ({
  formatErrorMessageWithPrefix: (error: Error) => error.message,
  isAbortError: (error: unknown) => error instanceof Error && error.name === 'AbortError'
}))

import { useTranslate } from '../useTranslate'

function WorkspaceTranslateHarness() {
  const [result, setResult] = useState('')
  const { isTranslating, translate } = useTranslate({ taskOwner: translationWorkspaceService })

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void translate('source', parseTranslateLangCode('en-us')).then((value) => setResult(value ?? ''))
        }}>
        Start
      </button>
      <div data-testid="busy">{String(isTranslating)}</div>
      <div data-testid="result">{result}</div>
    </>
  )
}

function ActivityScreen({ mode }: { mode: 'visible' | 'hidden' }) {
  return (
    <Activity mode={mode}>
      <WorkspaceTranslateHarness />
    </Activity>
  )
}

afterEach(() => {
  act(() => translationWorkspaceService.resetForTests())
  vi.clearAllMocks()
})

describe('useTranslate with a workspace owner inside Activity', () => {
  it('continues while hidden and exposes the terminal result when visible again', async () => {
    let resolveTranslation!: (value: string) => void
    mocks.translateText.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveTranslation = resolve
        })
    )
    const view = render(<ActivityScreen mode="visible" />)

    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(screen.getByTestId('busy')).toHaveTextContent('true'))
    const signal = mocks.translateText.mock.calls[0][3] as AbortSignal

    view.rerender(<ActivityScreen mode="hidden" />)
    expect(signal.aborted).toBe(false)

    await act(async () => {
      resolveTranslation('completed while hidden')
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(signal.aborted).toBe(false)

    view.rerender(<ActivityScreen mode="visible" />)
    await waitFor(() => expect(screen.getByTestId('result')).toHaveTextContent('completed while hidden'))
    expect(screen.getByTestId('busy')).toHaveTextContent('false')
  })
})
