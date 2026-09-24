import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { loggerService } from '@logger'
import { toast } from '@renderer/services/toast'
import { type FileContentGateway, ipcFileContentGateway } from '@renderer/services/translatePlatform'
import { type FileMetadata, isImageFileMetadata } from '@renderer/types/file'
import { formatErrorMessageWithPrefix } from '@renderer/utils/error'
import { getFileExtension, isTextFile } from '@renderer/utils/file'
import { MB } from '@shared/utils/constants'
import { documentExts } from '@shared/utils/file'

const logger = loggerService.withContext('TranslateFileProcessor')

type UseTranslateFileProcessorParams = {
  appendText: (value: string) => void
  onOcrStarted: (jobId: string) => void
  onPdfSelected?: (file: FileMetadata) => void | Promise<void>
  fileContentGateway?: FileContentGateway
}

export const useTranslateFileProcessor = ({
  appendText,
  onOcrStarted,
  onPdfSelected,
  fileContentGateway = ipcFileContentGateway
}: UseTranslateFileProcessorParams) => {
  const { t } = useTranslation()

  const readFile = useCallback(
    async (file: FileMetadata) => {
      const read = async () => {
        const fileExtension = getFileExtension(file.path)
        const isDocument = documentExts.includes(fileExtension)
        let isText = false

        if (!isDocument) {
          try {
            isText = await isTextFile(file.path)
          } catch (error) {
            logger.error('Failed to check file type.', error as Error)
            toast.error(formatErrorMessageWithPrefix(error, t('translate.files.error.check_type')))
            return
          }
        }

        if (!isText && !isDocument) {
          logger.error('Unsupported file type.')
          toast.error(t('common.file.not_supported', { type: fileExtension }))
          return
        }

        const maxSize = isDocument ? 10 * MB : 1 * MB
        if (file.size > maxSize) {
          toast.error(t('translate.files.error.too_large', { maxSize: isDocument ? '10MB' : '1MB' }))
          return
        }

        try {
          const content = isDocument
            ? await fileContentGateway.readDocument(file.path)
            : await fileContentGateway.readText(file.path)
          appendText(content)
        } catch (error) {
          logger.error('Failed to read file content.', error as Error)
          toast.error(formatErrorMessageWithPrefix(error, t('translate.files.error.read_content')))
        }
      }

      const promise = read()
      toast.loading({ title: t('translate.files.reading'), promise })
      await promise
    },
    [appendText, fileContentGateway, t]
  )

  const processFile = useCallback(
    async (file: FileMetadata) => {
      if (getFileExtension(file.path) === '.pdf' && onPdfSelected) {
        const maxSize = 20 * MB
        if (file.size > maxSize) {
          toast.error(t('translate.files.error.too_large', { maxSize: '20MB' }))
          return
        }
        await onPdfSelected(file)
        return
      }

      if (!isImageFileMetadata(file)) {
        await readFile(file)
        return
      }

      try {
        onOcrStarted(await fileContentGateway.startImageOcr(file.path))
      } catch (error) {
        logger.error('Failed to start image OCR.', error as Error)
        toast.error(formatErrorMessageWithPrefix(error, t('translate.files.error.ocr')))
      }
    },
    [fileContentGateway, onOcrStarted, onPdfSelected, readFile, t]
  )

  const getSingleFile = useCallback(
    (files: FileMetadata[] | FileList): FileMetadata | File | null => {
      if (files.length === 0) return null
      if (files.length > 1) {
        toast.error(t('translate.files.error.multiple'))
        return null
      }
      return files[0]
    },
    [t]
  )

  return { getSingleFile, processFile }
}
