import type { ChildProcess } from 'node:child_process'

import { application } from '@application'
import { loggerService } from '@logger'
import { BaseService, Injectable, Phase, ServicePhase } from '@main/core/lifecycle'
import type { WindowId } from '@shared/ipc/types'

const logger = loggerService.withContext('ClipboardWatchService')

type ClipboardEventListener = {
  child?: ChildProcess | null
  on: (event: 'change', listener: () => void) => ClipboardEventListener
  off?: (event: 'change', listener: () => void) => ClipboardEventListener
  removeListener?: (event: 'change', listener: () => void) => ClipboardEventListener
  startListening: () => void
  stopListening: () => boolean
}

@Injectable('ClipboardWatchService')
@ServicePhase(Phase.WhenReady)
export class ClipboardWatchService extends BaseService {
  private listener: ClipboardEventListener | null = null
  private readonly subscribers = new Map<WindowId, number>()
  private startPromise: Promise<boolean> | null = null
  private unavailableReason: string | null = null
  private sequence = 0

  async subscribe(windowId: WindowId): Promise<boolean> {
    this.subscribers.set(windowId, (this.subscribers.get(windowId) ?? 0) + 1)
    if (this.listener) return true
    if (this.startPromise) return this.startPromise
    if (this.unavailableReason) return false
    this.startPromise = this.startListening().finally(() => {
      this.startPromise = null
    })
    return this.startPromise
  }

  unsubscribe(windowId: WindowId): void {
    const count = this.subscribers.get(windowId) ?? 0
    if (count <= 1) this.subscribers.delete(windowId)
    else this.subscribers.set(windowId, count - 1)
    if (this.subscribers.size === 0) this.stopListening()
  }

  protected override onStop(): void {
    this.subscribers.clear()
    this.stopListening()
  }

  private async startListening(): Promise<boolean> {
    try {
      const module = await import('clipboard-event')
      if (this.subscribers.size === 0) return false
      const listener = (module.default ?? module) as ClipboardEventListener
      this.listener = listener
      listener.on('change', this.handleChange)
      listener.startListening()
      listener.child?.once('error', this.handleChildError)
      listener.child?.once('exit', this.handleChildExit)
      logger.info('Native clipboard listener started')
      return true
    } catch (error) {
      this.failListener(error instanceof Error ? error.message : String(error))
      return false
    }
  }

  private handleChange = () => {
    this.sequence += 1
    for (const windowId of this.subscribers.keys()) {
      application.get('IpcApiService').send(windowId, 'translate.clipboard_changed', { sequence: this.sequence })
    }
  }

  private handleChildError = (error: Error) => this.failListener(error.message)

  private handleChildExit = (code: number | null, signal: NodeJS.Signals | null) => {
    if (!this.listener) return
    this.failListener(`clipboard listener exited with code ${code ?? 'null'} and signal ${signal ?? 'null'}`)
  }

  private failListener(reason: string): void {
    this.unavailableReason = reason
    logger.warn('Native clipboard listener unavailable; renderer will use polling', { reason })
    this.detachListener(false)
    for (const windowId of this.subscribers.keys()) {
      application.get('IpcApiService').send(windowId, 'translate.clipboard_watch_unavailable', { reason })
    }
  }

  private stopListening(): void {
    this.detachListener(true)
  }

  private detachListener(stopChild: boolean): void {
    if (!this.listener) return
    this.listener.off?.('change', this.handleChange) ?? this.listener.removeListener?.('change', this.handleChange)
    this.listener.child?.off('error', this.handleChildError)
    this.listener.child?.off('exit', this.handleChildExit)
    if (stopChild) {
      try {
        this.listener.stopListening()
      } catch (error) {
        logger.warn('Failed to stop native clipboard listener', { error })
      }
    }
    this.listener = null
  }
}
