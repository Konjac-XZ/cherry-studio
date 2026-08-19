import { Button } from '@cherrystudio/ui'
import { cn } from '@renderer/utils/style'
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type Props = {
  couldFlip: boolean
  onFlip: () => void
}

const FlipButton = ({ couldFlip, onFlip }: Props) => {
  const { t } = useTranslation()
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      disabled={!couldFlip}
      onClick={onFlip}
      aria-label={t('translate.flip.label')}
      title={t('translate.flip.label')}
      className={cn('size-8', couldFlip && 'border-amber-500 text-amber-600')}>
      <RefreshCw size={16} />
    </Button>
  )
}

export default FlipButton
