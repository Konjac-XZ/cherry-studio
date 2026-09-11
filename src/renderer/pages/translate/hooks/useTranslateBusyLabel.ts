import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export type TranslateBusyStatus = 'detecting' | 'polishing' | 'processing'

const STATUS_KEYS: Record<TranslateBusyStatus, string> = {
  detecting: 'translate.detecting',
  polishing: 'translate.polishing',
  processing: 'translate.processing'
}

export const useTranslateBusyLabel = (status: TranslateBusyStatus | null, startedAt?: number | null) => {
  const { t } = useTranslation()
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!status) {
      setElapsedSeconds(0)
      return undefined
    }

    const effectiveStartedAt = startedAt ?? Date.now()
    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, (Date.now() - effectiveStartedAt) / 1000))
    }
    updateElapsed()
    const intervalId = window.setInterval(updateElapsed, 100)

    return () => window.clearInterval(intervalId)
  }, [startedAt, status])

  return useMemo(
    () => (status ? `${t(STATUS_KEYS[status])} ${elapsedSeconds.toFixed(1)}s` : null),
    [elapsedSeconds, status, t]
  )
}
