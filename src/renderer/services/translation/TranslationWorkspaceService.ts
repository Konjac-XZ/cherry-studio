import { loggerService } from '@logger'
import { ipcApi } from '@renderer/ipc'
import { uuid } from '@renderer/utils/uuid'
import type { TranslateLangCode } from '@shared/data/preference/preferenceTypes'
import type { TranslateSourceLanguage } from '@shared/data/preference/preferenceTypes'
import type { UniqueModelId } from '@shared/data/types/model'
import type { PdfTranslationProgressStage } from '@shared/ipc/schemas/translate'
import type { AbsoluteFilePath } from '@shared/types/file'

const logger = loggerService.withContext('TranslationWorkspaceService')

export type TranslationWorkspaceKind = 'text' | 'pdf' | 'ocr' | null
export type TranslationWorkspaceBusyStage = 'detecting' | 'polishing' | 'processing'
export type TranslationWorkspaceStatus =
  | 'idle'
  | 'preparing'
  | 'running'
  | 'processing'
  | 'success'
  | 'cancelled'
  | 'error'

export interface TranslationWorkspaceSnapshot {
  revision: number
  runId: number
  kind: TranslationWorkspaceKind
  status: TranslationWorkspaceStatus
  stage: string
  sourceText: string
  rawOutput: string
  displayOutput: string
  detectedLanguage: TranslateLangCode | null
  targetLanguage: TranslateLangCode | null
  busyStage: TranslationWorkspaceBusyStage | null
  busyStartedAt: number | null
  outputTokens?: number
  traceTopicId?: string
  traceId?: string
  jobId?: string
  progress?: number
  progressStage?: PdfTranslationProgressStage
  stageProgress?: number | null
  pdfOutput?: TranslationWorkspacePdfOutput
  pdfContext?: TranslationWorkspacePdfContext
  error?: unknown
  historyError?: unknown
}

export interface TranslationWorkspacePdfOutput {
  outputPath: AbsoluteFilePath
  fileName: string
}

export interface TranslationWorkspacePdfContext {
  sourceFileName: string
  sourcePath: AbsoluteFilePath
  textFallback: boolean
  previousRawOutput?: string
  previousDisplayOutput?: string
}

export interface StartPdfTranslationCommand {
  modelId: UniqueModelId
  sourceFileName: string
  sourceLangCode: TranslateSourceLanguage
  sourcePath: AbsoluteFilePath
  targetLangCode: TranslateLangCode
}

export interface TranslationTaskOwner {
  addTask(controller: AbortController): () => void
  abortTasks(): void
  isBusy(): boolean
  subscribe(listener: () => void): () => void
}

const IDLE_SNAPSHOT: TranslationWorkspaceSnapshot = Object.freeze({
  revision: 0,
  runId: 0,
  kind: null,
  status: 'idle',
  stage: 'idle',
  sourceText: '',
  rawOutput: '',
  displayOutput: '',
  detectedLanguage: null,
  targetLanguage: null,
  busyStage: null,
  busyStartedAt: null
})

const isActiveStatus = (status: TranslationWorkspaceStatus): boolean =>
  status === 'preparing' || status === 'running' || status === 'processing'

const getBusyStage = (status: TranslationWorkspaceStatus, stage: string): TranslationWorkspaceBusyStage | null => {
  if (!isActiveStatus(status)) return null
  if (stage === 'detecting' || stage === 'polishing') return stage
  return 'processing'
}

class TranslationWorkspaceService implements TranslationTaskOwner {
  readonly #tasks = new Set<AbortController>()
  readonly #listeners = new Set<() => void>()
  readonly #pdfListenerDisposers: Array<() => void> = []
  #snapshot = IDLE_SNAPSHOT
  #pdfListenersAttached = false

  getSnapshot = (): TranslationWorkspaceSnapshot => this.#snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  isBusy = (): boolean => this.#tasks.size > 0 || isActiveStatus(this.#snapshot.status)

  addTask = (controller: AbortController): (() => void) => {
    this.#tasks.add(controller)
    this.#notify()
    return () => {
      if (this.#tasks.delete(controller)) this.#notify()
    }
  }

  abortTasks = (): void => {
    if (this.#tasks.size === 0 && !isActiveStatus(this.#snapshot.status)) return
    for (const controller of this.#tasks) controller.abort()
    this.#tasks.clear()
    this.#snapshot = {
      ...this.#snapshot,
      revision: this.#snapshot.revision + 1,
      status: 'cancelled',
      stage: 'idle',
      busyStage: null,
      busyStartedAt: null
    }
    this.#notify()
  }

  cancel = (): void => this.abortTasks()

  begin(kind: Exclude<TranslationWorkspaceKind, null>, initial: Partial<TranslationWorkspaceSnapshot> = {}): number {
    this.abortTasks()
    const runId = this.#snapshot.runId + 1
    const status = initial.status ?? 'preparing'
    const stage = initial.stage ?? 'preparing'
    const busyStage = getBusyStage(status, stage)
    this.#snapshot = {
      ...IDLE_SNAPSHOT,
      ...initial,
      revision: this.#snapshot.revision + 1,
      runId,
      kind,
      ...(kind === 'text' && { traceTopicId: `translate:${uuid()}` }),
      status,
      stage,
      busyStage,
      busyStartedAt: busyStage ? Date.now() : null
    }
    this.#notify()
    return runId
  }

  update(runId: number, patch: Partial<TranslationWorkspaceSnapshot>): void {
    if (this.#snapshot.runId !== runId || !isActiveStatus(this.#snapshot.status)) return
    const status = patch.status ?? this.#snapshot.status
    const stage = patch.stage ?? this.#snapshot.stage
    const busyStage = getBusyStage(status, stage)
    this.#snapshot = {
      ...this.#snapshot,
      ...patch,
      revision: this.#snapshot.revision + 1,
      runId,
      busyStage,
      busyStartedAt:
        busyStage === this.#snapshot.busyStage ? this.#snapshot.busyStartedAt : busyStage ? Date.now() : null
    }
    this.#notify()
  }

  complete(runId: number, patch: Partial<TranslationWorkspaceSnapshot> = {}): void {
    this.update(runId, { ...patch, status: 'success', stage: 'idle' })
  }

  fail(runId: number, error: unknown): void {
    this.update(runId, { error, status: 'error', stage: 'idle' })
  }

  clearTerminal(): void {
    if (this.isBusy()) return
    this.#snapshot = {
      ...IDLE_SNAPSHOT,
      revision: this.#snapshot.revision + 1,
      runId: this.#snapshot.runId
    }
    this.#notify()
  }

  async startPdf(command: StartPdfTranslationCommand): Promise<TranslationWorkspacePdfOutput | undefined> {
    this.#ensurePdfListeners()
    const jobId = uuid()
    const runId = this.begin('pdf', {
      jobId,
      pdfContext: {
        sourceFileName: command.sourceFileName,
        sourcePath: command.sourcePath,
        textFallback: false
      },
      stage: 'preparing',
      targetLanguage: command.targetLangCode
    })
    const controller = new AbortController()
    const finishTask = this.addTask(controller)
    const cancel = () => {
      void ipcApi.request('translate.pdf.cancel', { jobId }).catch((error) => {
        logger.warn('Failed to cancel PDF translation', error as Error, { jobId })
      })
    }
    controller.signal.addEventListener('abort', cancel, { once: true })

    try {
      const output = await ipcApi.request('translate.pdf.start', {
        jobId,
        modelId: command.modelId,
        sourceLangCode: command.sourceLangCode,
        sourcePath: command.sourcePath,
        targetLangCode: command.targetLangCode
      })
      if (controller.signal.aborted || this.#snapshot.runId !== runId) return undefined
      this.complete(runId, { pdfOutput: output, progress: 100 })
      return output
    } catch (error) {
      if (controller.signal.aborted || this.#snapshot.runId !== runId) return undefined
      this.fail(runId, error)
      throw error
    } finally {
      controller.signal.removeEventListener('abort', cancel)
      finishTask()
    }
  }

  beginOcr(jobId: string): number {
    return this.begin('ocr', { jobId, stage: 'running', status: 'running' })
  }

  completeOcr(jobId: string, sourceText: string): void {
    if (this.#snapshot.kind !== 'ocr' || this.#snapshot.jobId !== jobId) return
    this.complete(this.#snapshot.runId, { sourceText })
  }

  failOcr(jobId: string, error: unknown): void {
    if (this.#snapshot.kind !== 'ocr' || this.#snapshot.jobId !== jobId) return
    this.fail(this.#snapshot.runId, error)
  }

  resetForTests(): void {
    for (const controller of this.#tasks) controller.abort()
    this.#tasks.clear()
    for (const dispose of this.#pdfListenerDisposers.splice(0)) dispose()
    this.#pdfListenersAttached = false
    this.#snapshot = IDLE_SNAPSHOT
    this.#notify()
  }

  #notify(): void {
    for (const listener of this.#listeners) listener()
  }

  #ensurePdfListeners(): void {
    if (this.#pdfListenersAttached) return
    this.#pdfListenersAttached = true
    this.#pdfListenerDisposers.push(
      ipcApi.on('translate.pdf.stage', ({ jobId, stage }) => {
        if (this.#snapshot.kind !== 'pdf' || this.#snapshot.jobId !== jobId) return
        this.update(this.#snapshot.runId, { stage, status: 'running' })
      }),
      ipcApi.on('translate.pdf.progress', ({ jobId, stage, stageProgress, overallProgress }) => {
        if (this.#snapshot.kind !== 'pdf' || this.#snapshot.jobId !== jobId) return
        if (this.#snapshot.progress !== undefined && overallProgress < this.#snapshot.progress) return
        this.update(this.#snapshot.runId, {
          progress: overallProgress,
          progressStage: stage,
          stage: 'translating',
          stageProgress,
          status: 'running'
        })
      })
    )
  }
}

export const translationWorkspaceService = new TranslationWorkspaceService()
