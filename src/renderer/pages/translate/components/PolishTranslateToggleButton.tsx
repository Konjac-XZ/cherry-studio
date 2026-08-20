import { Sparkles } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import TranslateToolbarToggleButton from './TranslateToolbarToggleButton'

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
    <TranslateToolbarToggleButton
      type="button"
      enabled={enabled}
      tone="polish"
      size="icon-sm"
      disabled={disabled}
      onClick={onToggle}
      onAuxClick={handleAuxClick}
      onMouseDown={(event) => {
        if (event.button === 1) event.preventDefault()
      }}
      aria-label={t('translate.button.polish_and_translate')}>
      <Sparkles size={16} />
    </TranslateToolbarToggleButton>
  )
}

export default PolishTranslateToggleButton
