import type { MutableRefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { loggerService } from '@logger'
import {
  type ClipboardGateway,
  ipcClipboardGateway,
  ipcWindowGateway,
  type WindowGateway
} from '@renderer/services/translatePlatform'
import { clipboardFingerprint } from '@renderer/utils/translate'

const logger = loggerService.withContext('TranslateClipboardWatch')
const POLL_INTERVAL_MS = 500

export function useTranslateClipboardWatch({
  busy,
  lastWrittenRef,
  onText,
  readClipboardForTranslate,
  readClipboardPlainTextForWatch,
  clipboardGateway = ipcClipboardGateway,
  windowGateway = ipcWindowGateway
}: {
  busy: boolean
  lastWrittenRef: MutableRefObject<string>
  onText: (text: string) => void | boolean | Promise<void | boolean>
  readClipboardForTranslate: () => Promise<string>
  readClipboardPlainTextForWatch: () => Promise<string>
  clipboardGateway?: ClipboardGateway
  windowGateway?: WindowGateway
}) {
  const [enabled, setEnabled] = useState(false)
  const latestRef = useRef({ busy, onText, readClipboardForTranslate, readClipboardPlainTextForWatch })
  latestRef.current = { busy, onText, readClipboardForTranslate, readClipboardPlainTextForWatch }
  const lastObservedRef = useRef<string | null>(null)
  const readRef = useRef<(() => void) | null>(null)
  const invalidateReadRef = useRef<(() => void) | null>(null)

  const toggle = useCallback(() => {
    invalidateReadRef.current?.()
    lastObservedRef.current = null
    setEnabled((value) => !value)
  }, [])

  useEffect(() => {
    if (!enabled) return
    let disposed = false
    let reading = false
    let pendingRead = false
    let intervalId: number | undefined
    const readAndTranslate = async () => {
      if (disposed) return
      if (reading || (latestRef.current.busy && lastObservedRef.current !== null)) {
        pendingRead = true
        return
      }
      reading = true
      pendingRead = false
      try {
        const plainText = await latestRef.current.readClipboardPlainTextForWatch()
        if (disposed) return
        const plainFingerprint = clipboardFingerprint(plainText)
        if (lastObservedRef.current === null) {
          lastObservedRef.current = plainFingerprint
          return
        }
        if (latestRef.current.busy || plainFingerprint === lastObservedRef.current) return
        if (!plainFingerprint || plainFingerprint === lastWrittenRef.current) {
          lastObservedRef.current = plainFingerprint
          return
        }

        const richText = (await latestRef.current.readClipboardForTranslate()) || plainText
        const richFingerprint = clipboardFingerprint(richText)
        if (disposed || latestRef.current.busy) return
        if (!richFingerprint || richFingerprint === lastWrittenRef.current) {
          lastObservedRef.current = plainFingerprint
          return
        }

        await windowGateway.focus().catch((error) => logger.debug('Failed to focus translate window', error as Error))
        if (disposed || latestRef.current.busy) return
        const accepted = await latestRef.current.onText(richText)
        if (!disposed && accepted !== false) lastObservedRef.current = plainFingerprint
      } catch (error) {
        logger.debug('Clipboard watch read failed', error as Error)
      } finally {
        reading = false
        if (!disposed && pendingRead && !latestRef.current.busy) void readAndTranslate()
      }
    }
    const requestRead = () => void readAndTranslate()
    readRef.current = requestRead
    invalidateReadRef.current = () => {
      disposed = true
    }
    const startPolling = () => {
      if (!disposed && intervalId === undefined) intervalId = window.setInterval(requestRead, POLL_INTERVAL_MS)
    }
    const removeChanged = clipboardGateway.onChanged(requestRead)
    const removeUnavailable = clipboardGateway.onWatchUnavailable(startPolling)

    requestRead()
    void clipboardGateway
      .startWatch()
      .then((nativeAvailable) => {
        if (!disposed && !nativeAvailable) startPolling()
      })
      .catch((error) => {
        logger.warn('Native clipboard watch unavailable; using polling', error as Error)
        startPolling()
      })

    return () => {
      disposed = true
      readRef.current = null
      invalidateReadRef.current = null
      removeChanged()
      removeUnavailable()
      if (intervalId !== undefined) window.clearInterval(intervalId)
      void clipboardGateway.stopWatch().catch((error) => logger.debug('Failed to stop clipboard watch', error as Error))
    }
  }, [clipboardGateway, enabled, lastWrittenRef, windowGateway])

  const wasBusyRef = useRef(busy)
  useEffect(() => {
    if (wasBusyRef.current && !busy) readRef.current?.()
    wasBusyRef.current = busy
  }, [busy])

  return { enabled, toggle }
}
