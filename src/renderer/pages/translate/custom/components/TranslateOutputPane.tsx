// Downstream-owned Translate UI implementation.
import { defaultMarkdownPlugins, Scrollbar, StreamingMarkdown, withMath } from '@cherrystudio/ui'
import { CodeBlockView } from '@renderer/components/CodeBlockView/CodeBlockView'
import { remarkLatexMath } from '@renderer/components/markdown'
import { getNodeText } from '@renderer/utils/reactNodeText'
import { getJsonStructureForDisplay, type JsonStructureCopySeparator } from '@renderer/utils/translate'
import { Check, Copy } from 'lucide-react'
import { type JSX, type Ref, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Components, ExtraProps } from 'streamdown'
import { useIsCodeFenceIncomplete } from 'streamdown'

import FloatingActionBar from '../../components/FloatingActionBar'
import JsonStructureView from '../../components/JsonStructureView'

const markdownPlugins = { ...defaultMarkdownPlugins, math: withMath({ singleDollar: true }) }
const remarkPlugins = [remarkLatexMath]
type MarkdownCodeProps = JSX.IntrinsicElements['code'] & ExtraProps

const TranslateMarkdownCode = ({ children: rawChildren, className, node: _node }: MarkdownCodeProps) => {
  void _node
  const children = getNodeText(rawChildren)
  const language = /language-([\w-+]+)/.exec(className || '')?.[1] ?? (children.includes('\n') ? 'text' : null)
  const isIncomplete = useIsCodeFenceIncomplete()

  return language ? (
    <CodeBlockView language={language} editable={false} allowExecution={false} isStreaming={isIncomplete} wrappable>
      {children}
    </CodeBlockView>
  ) : (
    <code className={className}>{children}</code>
  )
}

const markdownComponents = {
  code: TranslateMarkdownCode,
  table: ({ node: _node, ...props }) => {
    void _node
    return <table {...props} />
  }
} satisfies Partial<Components>

type Props = {
  ref?: Ref<HTMLDivElement>
  translatedContent: string
  enableMarkdown: boolean
  enableJsonStructure?: boolean
  jsonStructureCopySeparator?: JsonStructureCopySeparator
  jsonStructureCopyBlankLineBetweenRows?: boolean
  translating: boolean
  fontSize?: number
  copied: boolean
  onCopy: () => void
  onScroll: () => void
  tokenCount?: number
  wordCount?: number
}

const TranslateOutputPane = ({
  ref,
  translatedContent,
  enableMarkdown,
  enableJsonStructure = false,
  jsonStructureCopySeparator = 'colon-space',
  jsonStructureCopyBlankLineBetweenRows = false,
  translating,
  fontSize = 16,
  copied,
  onCopy,
  onScroll,
  tokenCount = 0,
  wordCount = 0
}: Props) => {
  const { t } = useTranslation()
  const jsonStructure = useMemo(
    () => getJsonStructureForDisplay(translatedContent, enableJsonStructure, translating),
    [enableJsonStructure, translatedContent, translating]
  )

  return (
    <div
      data-ui="translate.output"
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] bg-muted/30">
      <Scrollbar
        ref={ref}
        onScroll={onScroll}
        style={{ fontSize }}
        className="selectable min-h-0 flex-1 overflow-x-auto pt-[15px] pr-[21px] pb-[15px] pl-[21px] text-base leading-relaxed">
        <div className="flex min-h-full flex-col">
          {translating && !translatedContent ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
              <span>{t('translate.processing')}</span>
            </div>
          ) : translatedContent ? (
            jsonStructure ? (
              <JsonStructureView
                blankLineBetweenRows={jsonStructureCopyBlankLineBetweenRows}
                copySeparator={jsonStructureCopySeparator}
                value={jsonStructure}
              />
            ) : enableMarkdown ? (
              <StreamingMarkdown
                id="translate-output"
                plugins={markdownPlugins}
                remarkPlugins={remarkPlugins}
                components={markdownComponents}
                animated={false}
                parseIncompleteMarkdown={translating}>
                {translatedContent}
              </StreamingMarkdown>
            ) : (
              <div className="wrap-break-word whitespace-pre-wrap text-foreground">{translatedContent}</div>
            )
          ) : (
            <div className="select-none text-muted-foreground">{t('translate.output.placeholder')}</div>
          )}
        </div>
      </Scrollbar>
      <div className="flex shrink-0 items-center justify-end px-3 pt-1 pb-2">
        <span className="text-foreground-tertiary text-xs tabular-nums">
          {wordCount} {t('translate.counter.words')} / {tokenCount} {t('translate.counter.tokens')}
        </span>
      </div>
      <FloatingActionBar
        actions={[
          {
            key: 'copy',
            label: t('common.copy'),
            onClick: onCopy,
            disabled: !translatedContent,
            icon: copied ? <Check size={14} className="text-foreground" /> : <Copy size={14} />
          }
        ]}
      />
    </div>
  )
}

export default TranslateOutputPane
