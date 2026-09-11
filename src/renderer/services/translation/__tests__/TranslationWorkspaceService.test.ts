import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AbsoluteFilePath } from '@shared/types/file'

import { translationWorkspaceService } from '../index'

afterEach(() => {
  vi.restoreAllMocks()
  translationWorkspaceService.resetForTests()
})

describe('TranslationWorkspaceService', () => {
  it.each(['cancelled', 'error', 'success'] as const)('keeps %s terminal despite late events', (status) => {
    const runId = translationWorkspaceService.begin('pdf')
    translationWorkspaceService.update(runId, { rawOutput: 'partial' })
    if (status === 'cancelled') translationWorkspaceService.cancel()
    else if (status === 'error') translationWorkspaceService.fail(runId, new Error('disconnected'))
    else translationWorkspaceService.complete(runId)

    translationWorkspaceService.update(runId, { status: 'running', progress: 90 })
    translationWorkspaceService.complete(runId, { rawOutput: 'late result' })
    translationWorkspaceService.fail(runId, new Error('late failure'))

    expect(translationWorkspaceService.getSnapshot()).toMatchObject({ status, rawOutput: 'partial' })
    expect(translationWorkspaceService.isBusy()).toBe(false)
    translationWorkspaceService.clearTerminal()
    translationWorkspaceService.update(runId, { status: 'running' })
    expect(translationWorkspaceService.getSnapshot().status).toBe('idle')
  })

  it('creates a fresh text-run trace topic and accepts trace identity only for the current run', () => {
    const oldRunId = translationWorkspaceService.begin('text')
    const oldTopicId = translationWorkspaceService.getSnapshot().traceTopicId
    expect(oldTopicId).toMatch(/^translate:/)
    expect(translationWorkspaceService.getSnapshot().traceId).toBeUndefined()

    const newRunId = translationWorkspaceService.begin('text')
    const newTopicId = translationWorkspaceService.getSnapshot().traceTopicId
    translationWorkspaceService.update(oldRunId, { traceId: 'stale' })
    translationWorkspaceService.update(newRunId, { traceId: 'current' })

    expect(newTopicId).not.toBe(oldTopicId)
    expect(translationWorkspaceService.getSnapshot().traceId).toBe('current')
  })

  it('does not expose a text trace identity for PDF and OCR work', () => {
    translationWorkspaceService.begin('pdf')
    expect(translationWorkspaceService.getSnapshot().traceTopicId).toBeUndefined()

    translationWorkspaceService.beginOcr('ocr-1')
    expect(translationWorkspaceService.getSnapshot().traceTopicId).toBeUndefined()
  })

  it('keeps a task alive when the last UI subscriber leaves and catches a later subscriber up synchronously', () => {
    const runId = translationWorkspaceService.begin('text', { sourceText: 'processed source' })
    const controller = new AbortController()
    const finish = translationWorkspaceService.addTask(controller)
    const firstListener = vi.fn()
    const unsubscribe = translationWorkspaceService.subscribe(firstListener)

    unsubscribe()
    translationWorkspaceService.update(runId, { rawOutput: 'partial', status: 'running' })

    expect(controller.signal.aborted).toBe(false)
    expect(translationWorkspaceService.getSnapshot()).toMatchObject({ rawOutput: 'partial', status: 'running' })
    expect(translationWorkspaceService.subscribe(vi.fn())).toBeTypeOf('function')
    finish()
  })

  it('only explicit cancellation aborts the active task', () => {
    const runId = translationWorkspaceService.begin('text')
    const controller = new AbortController()
    translationWorkspaceService.addTask(controller)
    translationWorkspaceService.update(runId, { status: 'running' })

    translationWorkspaceService.abortTasks()

    expect(controller.signal.aborted).toBe(true)
    expect(translationWorkspaceService.getSnapshot().status).toBe('cancelled')
  })

  it('drops late state from a superseded run', () => {
    const oldRunId = translationWorkspaceService.begin('text')
    const newRunId = translationWorkspaceService.begin('text', { sourceText: 'new source' })

    translationWorkspaceService.complete(oldRunId, { displayOutput: 'stale result' })
    translationWorkspaceService.complete(newRunId, { displayOutput: 'current result' })

    expect(translationWorkspaceService.getSnapshot()).toMatchObject({
      runId: newRunId,
      sourceText: 'new source',
      displayOutput: 'current result',
      status: 'success'
    })
  })

  it('treats OCR as occupying the global slot and records explicit cancellation without a React-owned controller', () => {
    translationWorkspaceService.beginOcr('ocr-1')

    expect(translationWorkspaceService.isBusy()).toBe(true)
    translationWorkspaceService.cancel()

    expect(translationWorkspaceService.isBusy()).toBe(false)
    expect(translationWorkspaceService.getSnapshot()).toMatchObject({
      kind: 'ocr',
      jobId: 'ocr-1',
      status: 'cancelled'
    })
  })

  it('times visible stages without restarting for chunks, traces, tokens, or same-stage updates', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000)
    const runId = translationWorkspaceService.begin('text')
    expect(translationWorkspaceService.getSnapshot()).toMatchObject({
      busyStage: 'processing',
      busyStartedAt: 1000
    })

    now.mockReturnValue(1100)
    translationWorkspaceService.update(runId, { rawOutput: 'chunk', traceId: 'trace', outputTokens: 3 })
    expect(translationWorkspaceService.getSnapshot().busyStartedAt).toBe(1000)

    now.mockReturnValue(1200)
    translationWorkspaceService.update(runId, { stage: 'detecting' })
    expect(translationWorkspaceService.getSnapshot()).toMatchObject({ busyStage: 'detecting', busyStartedAt: 1200 })

    now.mockReturnValue(1300)
    translationWorkspaceService.update(runId, { rawOutput: 'same stage' })
    expect(translationWorkspaceService.getSnapshot().busyStartedAt).toBe(1200)

    now.mockReturnValue(1400)
    translationWorkspaceService.update(runId, { stage: 'polishing' })
    expect(translationWorkspaceService.getSnapshot()).toMatchObject({ busyStage: 'polishing', busyStartedAt: 1400 })

    now.mockReturnValue(1500)
    translationWorkspaceService.update(runId, { stage: 'translating' })
    expect(translationWorkspaceService.getSnapshot()).toMatchObject({ busyStage: 'processing', busyStartedAt: 1500 })

    translationWorkspaceService.complete(runId)
    expect(translationWorkspaceService.getSnapshot()).toMatchObject({ busyStage: null, busyStartedAt: null })
  })

  it('retains output tokens and PDF fallback context until the terminal workspace is cleared', () => {
    const runId = translationWorkspaceService.begin('text', {
      pdfContext: {
        sourceFileName: 'source.pdf',
        sourcePath: 'C:\\source.pdf' as AbsoluteFilePath,
        textFallback: true,
        previousRawOutput: 'raw before PDF',
        previousDisplayOutput: 'display before PDF'
      }
    })

    translationWorkspaceService.update(runId, { outputTokens: 42 })
    translationWorkspaceService.complete(runId, { displayOutput: 'translated' })

    expect(translationWorkspaceService.getSnapshot()).toMatchObject({
      outputTokens: 42,
      pdfContext: {
        sourceFileName: 'source.pdf',
        textFallback: true,
        previousRawOutput: 'raw before PDF',
        previousDisplayOutput: 'display before PDF'
      }
    })

    translationWorkspaceService.clearTerminal()
    expect(translationWorkspaceService.getSnapshot()).not.toHaveProperty('pdfContext')
    expect(translationWorkspaceService.getSnapshot()).not.toHaveProperty('outputTokens')
  })
})
