import { useCallback } from 'react'

import { loggerService } from '@logger'
import { type ClipboardGateway, ipcClipboardGateway } from '@renderer/services/translatePlatform'
import {
  formatClipboardMarkdown,
  htmlToTranslateMarkdown,
  shouldPreferPlainTextClipboard
} from '@renderer/utils/translate'

const logger = loggerService.withContext('TranslateClipboardRead')

export const useTranslateClipboardRead = ({
  htmlConversionEnabled,
  markdownFormattingEnabled = false,
  preprocessText = (text) => text,
  clipboardGateway = ipcClipboardGateway
}: {
  htmlConversionEnabled: boolean
  markdownFormattingEnabled?: boolean
  preprocessText?: (text: string) => string
  clipboardGateway?: ClipboardGateway
}) => {
  const selectContent = useCallback(
    ({ html, plainText }: { html: string; plainText: string }) => {
      let selected = plainText
      if (htmlConversionEnabled && html.trim()) {
        if (shouldPreferPlainTextClipboard(html, plainText)) {
          selected = plainText
        } else {
          const markdown = htmlToTranslateMarkdown(html)
          if (markdown.trim()) selected = markdown
        }
      }
      const preprocessed = preprocessText(selected)
      return markdownFormattingEnabled ? formatClipboardMarkdown(preprocessed) : preprocessed
    },
    [htmlConversionEnabled, markdownFormattingEnabled, preprocessText]
  )

  const readClipboardForTranslate = useCallback(async () => {
    try {
      const selected = selectContent(await clipboardGateway.readBrowserRich())
      if (selected.trim()) return selected
    } catch (error) {
      logger.debug('Rich browser clipboard read failed', error as Error)
    }
    try {
      const plainText = await clipboardGateway.readBrowserPlainText()
      if (plainText.trim()) {
        const preprocessed = preprocessText(plainText)
        return markdownFormattingEnabled ? formatClipboardMarkdown(preprocessed) : preprocessed
      }
    } catch (error) {
      logger.debug('Plain browser clipboard read failed', error as Error)
    }
    try {
      return selectContent(await clipboardGateway.readNative())
    } catch (error) {
      logger.debug('Native clipboard read failed', error as Error)
      return ''
    }
  }, [clipboardGateway, markdownFormattingEnabled, preprocessText, selectContent])

  const readClipboardPlainTextForWatch = useCallback(async () => {
    try {
      const native = await clipboardGateway.readNative()
      if (native.plainText) return native.plainText
    } catch (error) {
      logger.debug('Native clipboard watch read failed', error as Error)
    }
    try {
      return await clipboardGateway.readBrowserPlainText()
    } catch (error) {
      logger.debug('Browser clipboard watch read failed', error as Error)
      return ''
    }
  }, [clipboardGateway])

  return { readClipboardForTranslate, readClipboardPlainTextForWatch }
}
