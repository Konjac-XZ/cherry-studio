import { isEmpty } from 'es-toolkit/compat'
import type { ClipboardEvent, Dispatch, DragEvent, MutableRefObject, SetStateAction } from 'react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { loggerService } from '@logger'
import { useDrag } from '@renderer/hooks/useDrag'
import { useFiles } from '@renderer/hooks/useFiles'
import { toast } from '@renderer/services/toast'
import { type FileContentGateway, ipcFileContentGateway } from '@renderer/services/translatePlatform'
import type { FileMetadata } from '@renderer/types/file'
import { getFileExtension } from '@renderer/utils/file'
import { getFilesFromDropEvent, getTextFromDropEvent } from '@renderer/utils/input'
import {
  formatClipboardMarkdown,
  htmlToTranslateMarkdown,
  shouldPreferPlainTextClipboard
} from '@renderer/utils/translate'
import { documentExts, imageExts, textExts } from '@shared/utils/file'

import { useTranslateFileProcessor } from './useTranslateFileProcessor'

const logger = loggerService.withContext('TranslateFileInput')

type UseTranslateFileInputParams = {
  appendText: (value: string) => void
  forcePlainTextPasteRef: MutableRefObject<boolean>
  htmlConversionEnabled: boolean
  markdownFormattingEnabled: boolean
  isTextPreprocessed: (text: string) => boolean
  onTextPreprocessed: (text: string) => void
  preprocessText: (text: string) => string
  isOcrRunning: boolean
  isProcessing: boolean
  isTranslating: boolean
  onOcrStarted: (jobId: string) => void
  onPdfSelected?: (file: FileMetadata) => void | Promise<void>
  setIsProcessing: (value: boolean) => void
  setText: Dispatch<SetStateAction<string>>
  fileContentGateway?: FileContentGateway
}

export const useTranslateFileInput = ({
  appendText,
  forcePlainTextPasteRef,
  htmlConversionEnabled,
  markdownFormattingEnabled,
  isTextPreprocessed,
  onTextPreprocessed,
  preprocessText,
  isOcrRunning,
  isProcessing,
  isTranslating,
  onOcrStarted,
  onPdfSelected,
  setIsProcessing,
  setText,
  fileContentGateway = ipcFileContentGateway
}: UseTranslateFileInputParams) => {
  const { t } = useTranslation()
  const { onSelectFile, selecting, clearFiles } = useFiles({ extensions: [...imageExts, ...textExts, ...documentExts] })
  const { getSingleFile, processFile } = useTranslateFileProcessor({
    appendText,
    fileContentGateway,
    onOcrStarted,
    onPdfSelected
  })

  const handleSelectFile = useCallback(async () => {
    if (selecting || isTranslating || isOcrRunning) return
    setIsProcessing(true)
    try {
      const files = await onSelectFile({ multipleSelections: false })
      const file = getSingleFile(files) as FileMetadata | null
      if (file) await processFile(file)
    } catch (error) {
      logger.error('Unknown error when selecting file.', error as Error)
      toast.error(t('translate.files.error.unknown'))
    } finally {
      clearFiles()
      setIsProcessing(false)
    }
  }, [clearFiles, getSingleFile, isOcrRunning, isTranslating, onSelectFile, processFile, selecting, setIsProcessing, t])

  const { handleDragEnter, handleDragLeave, handleDragOver, handleDrop: preventDrop } = useDrag<HTMLDivElement>()

  const onDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      if (isProcessing || isOcrRunning || isTranslating) return
      setIsProcessing(true)
      try {
        const data = await getTextFromDropEvent(event).catch((error) => {
          logger.error('getTextFromDropEvent', error as Error)
          toast.error(t('translate.files.error.unknown'))
          return null
        })
        if (data) appendText(data)

        const droppedFiles = await getFilesFromDropEvent(event).catch((error) => {
          logger.error('getFilesFromDropEvent', error as Error)
          toast.error(t('translate.files.error.unknown'))
          return null
        })
        if (!droppedFiles) return
        const file = getSingleFile(droppedFiles) as FileMetadata | null
        if (file) await processFile(file)
      } finally {
        setIsProcessing(false)
      }
    },
    [appendText, getSingleFile, isOcrRunning, isProcessing, isTranslating, processFile, setIsProcessing, t]
  )

  const onPaste = useCallback(
    async (event: ClipboardEvent<HTMLTextAreaElement>) => {
      if (isProcessing || isOcrRunning || isTranslating) return
      const forcePlainTextPaste = forcePlainTextPasteRef.current
      forcePlainTextPasteRef.current = false
      const hasFiles = !!event.clipboardData.files && event.clipboardData.files.length > 0

      if (!hasFiles) {
        const plainText = event.clipboardData.getData('text/plain') || event.clipboardData.getData('text')
        const insertAtSelection = (value: string, shouldPreprocess = false) => {
          const { selectionStart, selectionEnd } = event.currentTarget
          setText((current) => {
            const inserted = current.slice(0, selectionStart) + value + current.slice(selectionEnd)
            if (!shouldPreprocess) return inserted

            const preprocessed = isTextPreprocessed(current)
              ? current.slice(0, selectionStart) + preprocessText(value) + current.slice(selectionEnd)
              : preprocessText(inserted)
            const prepared = markdownFormattingEnabled ? formatClipboardMarkdown(preprocessed) : preprocessed
            onTextPreprocessed(prepared)
            return prepared
          })
        }
        if (forcePlainTextPaste) {
          if (!plainText) return
          event.preventDefault()
          insertAtSelection(plainText)
          return
        }
        if (!htmlConversionEnabled && !markdownFormattingEnabled) return
        const html = event.clipboardData.getData('text/html')
        let converted = plainText
        if (htmlConversionEnabled && html.trim()) {
          converted = shouldPreferPlainTextClipboard(html, plainText) ? plainText : htmlToTranslateMarkdown(html)
        }
        if (!converted.trim()) return
        event.preventDefault()
        insertAtSelection(converted, true)
        return
      }

      setIsProcessing(true)
      try {
        if (!isEmpty(event.clipboardData.getData('text'))) return
        event.preventDefault()
        const file = getSingleFile(event.clipboardData.files) as File | null
        if (!file) return

        const filePath = fileContentGateway.getPathForFile(file)
        let selectedFile: FileMetadata | null
        if (!filePath) {
          if (!file.type.startsWith('image/')) {
            toast.info(t('common.file.not_supported', { type: getFileExtension(file.name) }))
            return
          }
          const tempFilePath = await fileContentGateway.createTempFile(file.name)
          await fileContentGateway.write(tempFilePath, new Uint8Array(await file.arrayBuffer()))
          selectedFile = await fileContentGateway.get(tempFilePath)
        } else {
          selectedFile = await fileContentGateway.get(filePath)
        }

        if (!selectedFile) {
          toast.error(t('translate.files.error.unknown'))
          return
        }
        await processFile(selectedFile)
      } catch (error) {
        logger.error('onPaste:', error as Error)
        toast.error(t('chat.input.file_error'))
      } finally {
        setIsProcessing(false)
      }
    },
    [
      fileContentGateway,
      forcePlainTextPasteRef,
      getSingleFile,
      htmlConversionEnabled,
      isTextPreprocessed,
      isOcrRunning,
      isProcessing,
      isTranslating,
      markdownFormattingEnabled,
      onTextPreprocessed,
      preprocessText,
      processFile,
      setIsProcessing,
      setText,
      t
    ]
  )

  return {
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleSelectFile,
    onDrop,
    onPaste,
    preventDrop,
    selecting
  }
}
