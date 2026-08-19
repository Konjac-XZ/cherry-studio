import { Button } from '@cherrystudio/ui'
import { cn } from '@renderer/utils/style'
import { Sparkles } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

type Props = {
  disabled?: boolean
  enabled: boolean
  onToggle: () => void
  onTranslateOnce: () => void
}

const PolishTranslateToggleButton = ({ disabled, enabled, onToggle, onTranslateOnce }: Props) => {
  const { t } = useTranslation()
  const handleAuxClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.button !== 1) return
    event.preventDefault()
    event.stopPropagation()
    onTranslateOnce()
  }

  return (
    <Button
      type="button"
      variant={enabled ? 'default' : 'outline'}
      size="icon-sm"
      disabled={disabled}
      onClick={onToggle}
      onAuxClick={handleAuxClick}
      onMouseDown={(event) => {
        if (event.button === 1) event.preventDefault()
      }}
      aria-label={t('translate.button.polish_and_translate')}
      aria-pressed={enabled}
      title={t('translate.button.polish_and_translate')}
      className={cn('size-8')}>
      <Sparkles size={16} />
    </Button>
  )
}

export default PolishTranslateToggleButton
