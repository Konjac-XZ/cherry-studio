import type { PropsWithChildren } from 'react'
import { lazy, Suspense, useMemo, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import {
  type RightPanelCapability,
  type RightPanelComponentProps,
  RightPanelProvider,
  RightPanelViewport
} from '@renderer/components/chat/panes/Shell'
import { usePreference } from '@renderer/data/hooks/usePreference'
import { translationWorkspaceService } from '@renderer/services/translation'

const TracePane = lazy(() =>
  import('@renderer/components/chat/trace/TracePane').then((module) => ({ default: module.TracePane }))
)

export const TRANSLATE_TRACE_PANE_ID = 'trace'

interface TranslateRightPanelScope {
  developerMode: boolean
  traceId?: string
  traceTitle: string
  traceTopicId?: string
}

function TranslateTraceRightPanel({ active, scope }: RightPanelComponentProps<TranslateRightPanelScope>) {
  if (!active || !scope.traceTopicId || !scope.traceId) return null

  return (
    <Suspense fallback={null}>
      <TracePane payload={{ topicId: scope.traceTopicId, traceId: scope.traceId }} />
    </Suspense>
  )
}

const TRANSLATE_TRACE_CAPABILITY = {
  component: TranslateTraceRightPanel,
  resolve: (scope: TranslateRightPanelScope) => ({
    id: TRANSLATE_TRACE_PANE_ID,
    instanceKey: `trace:${scope.traceTopicId ?? 'unavailable'}:${scope.traceId ?? ''}`,
    title: scope.traceTitle,
    readiness: scope.developerMode && scope.traceTopicId && scope.traceId ? 'ready' : 'unavailable'
  })
} satisfies RightPanelCapability<TranslateRightPanelScope>

const TRANSLATE_RIGHT_PANEL_CAPABILITIES = [TRANSLATE_TRACE_CAPABILITY] as const

function TranslateRightPaneScope({ children }: PropsWithChildren) {
  const { t } = useTranslation()
  const [developerMode] = usePreference('app.developer_mode.enabled')
  const snapshot = useSyncExternalStore(
    translationWorkspaceService.subscribe,
    translationWorkspaceService.getSnapshot,
    translationWorkspaceService.getSnapshot
  )
  const scope = useMemo<TranslateRightPanelScope>(
    () => ({
      developerMode,
      traceId: snapshot.traceId,
      traceTitle: t('trace.label'),
      traceTopicId: snapshot.traceTopicId
    }),
    [developerMode, snapshot.traceId, snapshot.traceTopicId, t]
  )

  return (
    <RightPanelProvider
      capabilities={TRANSLATE_RIGHT_PANEL_CAPABILITIES}
      scope={scope}
      defaultPanelId={TRANSLATE_TRACE_PANE_ID}>
      {children}
    </RightPanelProvider>
  )
}

function TranslateRightPaneViewport() {
  return <RightPanelViewport registerKeyboardShortcut={false} />
}

export const TranslateRightPane = {
  Scope: TranslateRightPaneScope,
  Viewport: TranslateRightPaneViewport
}
