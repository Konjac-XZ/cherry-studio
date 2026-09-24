import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@cherrystudio/ui'
import { cn } from '@renderer/utils/style'

const activeColorClasses = {
  clipboardWatch: 'text-[#0f8f7d] hover:text-[#0f8f7d] focus-visible:text-[#0f8f7d]',
  htmlConversion: 'text-[#2463ff] hover:text-[#2463ff] focus-visible:text-[#2463ff]',
  polish: 'text-[#9a6700] hover:text-[#9a6700] focus-visible:text-[#9a6700]',
  postProcessing: 'text-[#7c3aed] hover:text-[#7c3aed] focus-visible:text-[#7c3aed]'
} as const

const featureKeys = {
  clipboardWatch: 'translate.toolbar_toggle.clipboard_watch',
  htmlConversion: 'translate.toolbar_toggle.html_conversion',
  polish: 'translate.toolbar_toggle.polish',
  postProcessing: 'translate.toolbar_toggle.post_processing'
} as const

type Props = Omit<ComponentProps<typeof Button>, 'title' | 'variant'> & {
  enabled: boolean
  tone: keyof typeof activeColorClasses
}

const TranslateToolbarToggleButton = ({ className, enabled, tone, ...props }: Props) => {
  const { t } = useTranslation()
  const title = t('translate.toolbar_toggle.status', {
    feature: t(featureKeys[tone]),
    status: t(enabled ? 'common.enabled' : 'common.disabled')
  })

  return (
    <Button
      {...props}
      variant="ghost"
      aria-pressed={enabled}
      title={title}
      className={cn(
        'size-8',
        enabled
          ? activeColorClasses[tone]
          : 'text-foreground-disabled hover:text-foreground-disabled focus-visible:text-foreground-disabled',
        className
      )}
    />
  )
}

export default TranslateToolbarToggleButton
