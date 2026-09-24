import type { FC } from 'react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { loggerService } from '@logger'
import { useJob } from '@renderer/hooks/useJob'
import { toast } from '@renderer/services/toast'
import { formatErrorMessageWithPrefix } from '@renderer/utils/error'
import { FileProcessingJobOutputSchema } from '@shared/data/types/fileProcessing'

const logger = loggerService.withContext('TranslateOcrJobWatcher')

type Props = {
  jobId: string
  onCompleted: (text: string) => void
  onSettled: (jobId: string) => void
}

const OcrJobWatcher: FC<Props> = ({ jobId, onCompleted, onSettled }) => {
  const { t } = useTranslation()
  const { data: snapshot, isTerminal, error } = useJob(jobId)
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return

    const normalizeError = (error: unknown, fallbackMessage: string) => {
      if (error instanceof Error) return error
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message?: unknown }).message
        if (typeof message === 'string' && message) return new Error(message)
      }
      return new Error(fallbackMessage)
    }

    const rejectJob = (error: unknown, fallbackMessage: string) => {
      const normalizedError = normalizeError(error, fallbackMessage)
      toast.error(formatErrorMessageWithPrefix(normalizedError, t('translate.files.error.ocr')))
    }

    if (error) {
      handledRef.current = true
      logger.error('Failed to observe OCR job.', error, { jobId })
      rejectJob(error, 'Image OCR job became unobservable')
      onSettled(jobId)
      return
    }

    if (!isTerminal || !snapshot) return
    handledRef.current = true

    if (snapshot.status === 'completed') {
      const parsedOutput = FileProcessingJobOutputSchema.safeParse(snapshot.output)
      if (parsedOutput.success && parsedOutput.data.artifact.kind === 'text') {
        onCompleted(parsedOutput.data.artifact.text)
        toast.success(t('translate.files.ocr_completed'))
      } else {
        const failure = new Error('Image OCR completed without a text artifact')
        if (!parsedOutput.success) {
          logger.warn('Image OCR job output failed schema validation.', parsedOutput.error, { jobId })
        } else {
          logger.warn('Image OCR job completed without a text artifact.', { jobId })
        }
        rejectJob(failure, failure.message)
      }
    } else {
      rejectJob(snapshot.error, 'Image OCR failed')
    }

    onSettled(jobId)
  }, [error, isTerminal, jobId, onCompleted, onSettled, snapshot, t])

  return null
}

export default OcrJobWatcher
