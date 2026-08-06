import { loggerService } from '@logger'
import {
  type ClipboardGateway,
  ipcClipboardGateway,
  ipcWindowGateway,
  type WindowGateway
} from '@renderer/services/translatePlatform'
import { clipboardFingerprint } from '@renderer/utils/translate'
import type { MutableRefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

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
  onText: (text: string) => void | Promise<void>
  readClipboardForTranslate: () => Promise<string>
  readClipboardPlainTextForWatch: () => Promise<string>
  clipboardGateway?: ClipboardGateway
  windowGateway?: WindowGateway
}) {
  const [enabled, setEnabled] = useState(false)
  const busyRef = useRef(busy)
  const onTextRef = useRef(onText)
  const lastObservedRef = useRef('')
  const readingRef = useRef(false)
  busyRef.current = busy
  onTextRef.current = onText

  const toggle = useCallback(() => {
    lastObservedRef.current = ''
    lastWrittenRef.current = ''
    setEnabled((value) => !value)
  }, [lastWrittenRef])

  const readAndTranslate = useCallback(async () => {
    if (readingRef.current || busyRef.current) return
    readingRef.current = true
    try {
      const plainText = await readClipboardPlainTextForWatch()
      const plainFingerprint = clipboardFingerprint(plainText)
      if (!plainFingerprint) return
      if (!lastObservedRef.current) {
        lastObservedRef.current = plainFingerprint
        return
      }
      if (plainFingerprint === lastObservedRef.current) return
      lastObservedRef.current = plainFingerprint
      if (plainFingerprint === lastWrittenRef.current) return

      const richText = (await readClipboardForTranslate()) || plainText
      const richFingerprint = clipboardFingerprint(richText)
      if (!richFingerprint || richFingerprint === lastWrittenRef.current || busyRef.current) return

      await windowGateway.focus().catch((error) => logger.debug('Failed to focus translate window', error as Error))
      await onTextRef.current(richText)
    } catch (error) {
      logger.debug('Clipboard watch read failed', error as Error)
    } finally {
      readingRef.current = false
    }
  }, [lastWrittenRef, readClipboardForTranslate, readClipboardPlainTextForWatch, windowGateway])

  useEffect(() => {
    if (!enabled) return
    let disposed = false
    let intervalId: number | undefined
    const startPolling = () => {
      if (!disposed && intervalId === undefined)
        intervalId = window.setInterval(() => void readAndTranslate(), POLL_INTERVAL_MS)
    }
    const removeChanged = clipboardGateway.onChanged(() => void readAndTranslate())
    const removeUnavailable = clipboardGateway.onWatchUnavailable(startPolling)

    void readAndTranslate()
    void clipboardGateway
      .startWatch()
      .then((nativeAvailable) => {
        if (disposed) {
          void clipboardGateway.stopWatch()
        } else if (!nativeAvailable) {
          startPolling()
        }
      })
      .catch((error) => {
        logger.warn('Native clipboard watch unavailable; using polling', error as Error)
        startPolling()
      })

    return () => {
      disposed = true
      removeChanged()
      removeUnavailable()
      if (intervalId !== undefined) window.clearInterval(intervalId)
      readingRef.current = false
      void clipboardGateway.stopWatch()
    }
  }, [clipboardGateway, enabled, readAndTranslate])

  return { enabled, toggle }
}
