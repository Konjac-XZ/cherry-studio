import { afterEach, describe, expect, it, vi } from 'vitest'

import { translationWorkspaceService } from '../index'

afterEach(() => {
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
})
