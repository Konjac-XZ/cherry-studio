import TranslatePage from '@renderer/pages/translate/custom/TranslatePage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/translate')({
  component: TranslatePage
})
