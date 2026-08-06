import { Button, NormalTooltip, Scrollbar } from '@cherrystudio/ui'
import uploadExcelIcon from '@renderer/assets/images/translate/upload-excel.svg'
import uploadImageIcon from '@renderer/assets/images/translate/upload-image.svg'
import uploadPdfIcon from '@renderer/assets/images/translate/upload-pdf.svg'
import uploadPptIcon from '@renderer/assets/images/translate/upload-ppt.svg'
import uploadTextIcon from '@renderer/assets/images/translate/upload-text.svg'
import uploadWordIcon from '@renderer/assets/images/translate/upload-word.svg'
import { useDrag } from '@renderer/hooks/useDrag'
import { ClipboardPaste, CodeXml, Copy, LoaderCircle, X } from 'lucide-react'
import type { KeyboardEvent, Ref } from 'react'
import { useCallback, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import FloatingActionBar from './FloatingActionBar'
import IconButton from './IconButton'

type Props = {
  ref?: Ref<HTMLDivElement>
  text: string
  onTextChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onScroll: () => void
  onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void
  onSelectFile: () => void
  onCopy: () => void
  onPasteFromClipboard: () => Promise<string>
  htmlConversionEnabled: boolean
  onToggleHtmlConversion: () => void
  onCancelOcr: () => void
  disabled: boolean
  ocrProcessing: boolean
  selecting: boolean
  fontSize?: number
  tokenCount?: number
  wordCount?: number
}

const TranslateInputPane = ({
  ref,
  text,
  onTextChange,
  onKeyDown,
  onScroll,
  onPaste,
  onDrop,
  onSelectFile,
  onCopy,
  onPasteFromClipboard,
  htmlConversionEnabled,
  onToggleHtmlConversion,
  onCancelOcr,
  disabled,
  ocrProcessing,
  selecting,
  fontSize = 16,
  tokenCount = 0,
  wordCount = 0
}: Props) => {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop: handleDropEvent
  } = useDrag<HTMLDivElement>(onDrop)

  const handleClear = useCallback(() => {
    onTextChange('')
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [onTextChange])

  const handlePasteFromClipboard = useCallback(async () => {
    const value = await onPasteFromClipboard()
    if (!value) return
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? text.length
    const end = textarea?.selectionEnd ?? start
    onTextChange(text.slice(0, start) + value + text.slice(end))
    requestAnimationFrame(() => {
      const nextCaret = start + value.length
      textarea?.focus()
      textarea?.setSelectionRange(nextCaret, nextCaret)
    })
  }, [onPasteFromClipboard, onTextChange, text])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [text])

  const uploadIcons = [uploadImageIcon, uploadPdfIcon, uploadWordIcon, uploadPptIcon, uploadTextIcon, uploadExcelIcon]

  return (
    <div
      data-ui="translate.input"
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDropEvent}>
      <div className="relative min-h-0 flex-1">
        <Scrollbar ref={ref} onScroll={onScroll} className="h-full overflow-x-hidden">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            disabled={disabled}
            spellCheck={false}
            style={{ fontSize }}
            placeholder={t('translate.input.placeholder')}
            className="min-h-full w-full resize-none overflow-hidden bg-transparent p-4 pr-12 text-base text-foreground leading-relaxed outline-none placeholder:font-normal placeholder:text-muted-foreground"
          />
        </Scrollbar>
        <FloatingActionBar
          actions={[
            {
              key: 'clear',
              label: t('common.clear'),
              onClick: handleClear,
              disabled: disabled || !text,
              icon: <X size={14} />
            },
            {
              key: 'paste',
              label: t('translate.paste'),
              onClick: () => void handlePasteFromClipboard(),
              disabled,
              icon: <ClipboardPaste size={14} />
            },
            {
              key: 'copy',
              label: t('common.copy'),
              onClick: onCopy,
              disabled: disabled || !text,
              icon: <Copy size={14} />
            }
          ]}
        />
      </div>
      {!text && (
        <button
          type="button"
          onClick={onSelectFile}
          disabled={disabled || selecting}
          aria-label={t('translate.files.upload')}
          className="mx-3 mb-4 flex shrink-0 flex-col items-center justify-center gap-3 rounded-md border border-border-subtle border-dashed px-4 py-4 text-muted-foreground transition-colors hover:border-border-strong hover:bg-muted/30 hover:text-foreground focus-visible:border-border-strong focus-visible:bg-muted/30 focus-visible:text-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60">
          <span className="text-sm">{t('translate.files.upload')}</span>
          <span className="flex items-center gap-6">
            {uploadIcons.map((icon) => (
              <img key={icon} src={icon} alt="" aria-hidden="true" className="size-7" />
            ))}
          </span>
        </button>
      )}
      {!disabled && (
        <div className="flex shrink-0 items-center gap-1 px-3 py-3">
          <IconButton
            size="sm"
            onClick={onToggleHtmlConversion}
            aria-label={t('translate.html_conversion')}
            aria-pressed={htmlConversionEnabled}
            className={htmlConversionEnabled ? 'text-foreground' : 'text-foreground-tertiary'}>
            <CodeXml size={14} />
          </IconButton>
          <NormalTooltip content={t('translate.counter.tip')} side="top">
            <span className="ml-auto text-foreground-tertiary text-xs tabular-nums">
              {wordCount} {t('translate.counter.words')} / {tokenCount} {t('translate.counter.tokens')}
            </span>
          </NormalTooltip>
        </div>
      )}
      {isDragging && (
        <div className="fade-in-0 pointer-events-none absolute inset-0 z-10 flex animate-in items-center justify-center bg-background p-3 duration-150">
          <div className="flex h-full w-full items-center justify-center rounded-md border border-border-subtle border-dashed">
            {/* Drawn as a single path so the translucent foreground token paints
                evenly: lucide's Plus uses two crossing paths, which composites
                the alpha twice and darkens the center. */}
            <svg
              width={40}
              height={40}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="text-muted-foreground"
              aria-hidden="true">
              <path d="M5 12h14M12 5v14" />
            </svg>
            <span className="sr-only">{t('translate.files.drag_text')}</span>
          </div>
        </div>
      )}
      {ocrProcessing && (
        <div className="fade-in-0 absolute inset-0 z-20 flex animate-in items-center justify-center bg-background/90 p-3 duration-150">
          <div className="flex flex-col items-center gap-3">
            <div role="status" aria-live="polite" className="flex items-center gap-2 text-foreground-tertiary text-sm">
              <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
              <span>{t('ocr.processing')}</span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => onCancelOcr()}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TranslateInputPane
