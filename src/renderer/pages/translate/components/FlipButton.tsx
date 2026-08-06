import { Button } from '@cherrystudio/ui'
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
      className={couldFlip ? 'border-amber-500 text-amber-600' : undefined}>
      <RefreshCw size={14} />
    </Button>
  )
}

export default FlipButton
