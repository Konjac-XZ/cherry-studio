import { useCallback, useRef } from 'react'

import { loggerService } from '@logger'
import { useTemporaryValue } from '@renderer/hooks/useTemporaryValue'
import { type ClipboardGateway, ipcClipboardGateway } from '@renderer/services/translatePlatform'
import { clipboardFingerprint } from '@renderer/utils/translate'

const logger = loggerService.withContext('TranslateClipboardWrite')

export const useTranslateClipboardWrite = (clipboardGateway: ClipboardGateway = ipcClipboardGateway) => {
  const [copied, setCopied] = useTemporaryValue(false, 2000)
  const lastWrittenRef = useRef('')

  const copy = useCallback(
    async (text: string) => {
      lastWrittenRef.current = clipboardFingerprint(text)
      try {
        await clipboardGateway.writeBrowserText(text)
      } catch (browserError) {
        logger.debug('Browser clipboard write failed; using native IPC', browserError as Error)
        await clipboardGateway.writeNativeText(text)
      }
      setCopied(true)
    },
    [clipboardGateway, setCopied]
  )

  return { copied, copy, lastWrittenRef }
}
