import { Scrollbar } from '@cherrystudio/ui'
import { getJsonStructureForDisplay, type JsonStructureCopySeparator } from '@renderer/utils/translate'
import { Check, Copy, NotebookPen } from 'lucide-react'
import { type Ref, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import FloatingActionBar from './FloatingActionBar'
import IconButton from './IconButton'
import JsonStructureView from './JsonStructureView'

type Props = {
  ref?: Ref<HTMLDivElement>
  translatedContent: string
  renderedMarkdown: string
  enableMarkdown: boolean
  enableJsonStructure?: boolean
  jsonStructureCopySeparator?: JsonStructureCopySeparator
  jsonStructureCopyBlankLineBetweenRows?: boolean
  translating: boolean
  fontSize?: number
  copied: boolean
  onCopy: () => void
  onExportToNotes: () => void
  onScroll: () => void
}

const TranslateOutputPane = ({
  ref,
  translatedContent,
  renderedMarkdown,
  enableMarkdown,
  enableJsonStructure = false,
  jsonStructureCopySeparator = 'colon-space',
  jsonStructureCopyBlankLineBetweenRows = false,
  translating,
  fontSize = 16,
  copied,
  onCopy,
  onExportToNotes,
  onScroll
}: Props) => {
  const { t } = useTranslation()
  const jsonStructure = useMemo(
    () => getJsonStructureForDisplay(translatedContent, enableJsonStructure, translating),
    [enableJsonStructure, translatedContent, translating]
  )

  return (
    <div
      data-ui="translate.output"
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <Scrollbar
        ref={ref}
        onScroll={onScroll}
        style={{ fontSize }}
        className="selectable min-h-0 flex-1 overflow-x-hidden p-4 pr-12 text-base leading-relaxed">
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
              <div className="markdown" dangerouslySetInnerHTML={{ __html: renderedMarkdown }} />
            ) : (
              <div className="wrap-break-word whitespace-pre-wrap text-foreground">{translatedContent}</div>
            )
          ) : null}
        </div>
      </Scrollbar>
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
      <div className="flex shrink-0 items-center px-3 py-4">
        {translatedContent && <span className="text-foreground-tertiary text-xs">{translatedContent.length}</span>}
        <IconButton
          size="sm"
          onClick={onExportToNotes}
          disabled={!translatedContent.trim()}
          aria-label={t('notes.save')}
          className="ml-auto">
          <NotebookPen size={14} />
        </IconButton>
      </div>
    </div>
  )
}

export default TranslateOutputPane
