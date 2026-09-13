// Downstream-owned Translate UI implementation.
import { Button, NormalTooltip, Scrollbar } from '@cherrystudio/ui'
import { useDrag } from '@renderer/hooks/useDrag'
import { ClipboardPaste, LoaderCircle, Plus, X } from 'lucide-react'
import type { KeyboardEvent, Ref } from 'react'
import { useCallback, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import FloatingActionBar from '../../components/FloatingActionBar'

type Props = {
  ref?: Ref<HTMLDivElement>
  text: string
  onTextChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onScroll: () => void
  onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void
  onSelectFile: () => void
  onPasteFromClipboard: () => Promise<string>
  onCancelOcr: () => void
  disabled: boolean
  ocrProcessing: boolean
  selecting: boolean
  busyLabel?: string | null
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
  onPasteFromClipboard,
  onCancelOcr,
  disabled,
  ocrProcessing,
  selecting,
  busyLabel,
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

  return (
    <div
      data-ui="translate.input"
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-border-subtle bg-background"
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
            className="min-h-full w-full resize-none overflow-hidden bg-transparent px-[21px] pt-[15px] pb-[5px] text-base text-foreground leading-relaxed outline-none placeholder:font-normal placeholder:text-muted-foreground"
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
            }
          ]}
        />
      </div>
      {!disabled && !selecting && (
        <div className="group absolute bottom-[2px] left-[2px] z-10 flex size-[51px] items-center justify-center">
          <Button
            type="button"
            variant="default"
            size="icon-sm"
            onClick={onSelectFile}
            aria-label={t('translate.files.upload')}
            title={t('translate.files.upload')}
            className="size-[35px] rounded-full opacity-0 transition-opacity delay-300 duration-200 group-hover:opacity-100 group-hover:delay-0">
            <Plus size={15} />
          </Button>
        </div>
      )}
      <div className="flex shrink-0 items-center justify-end px-3 pt-1 pb-2">
        <NormalTooltip content={t('translate.counter.tip')} side="top">
          <span className="text-foreground-tertiary text-xs tabular-nums">
            {wordCount} {t('translate.counter.words')} / {tokenCount} {t('translate.counter.tokens')}
          </span>
        </NormalTooltip>
      </div>
      {isDragging && (
        <div className="fade-in-0 pointer-events-none absolute inset-0 z-10 flex animate-in items-center justify-center bg-background p-3 duration-150">
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-md border border-border-subtle border-dashed">
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
            <span className="text-muted-foreground text-sm">{t('translate.files.drag_text')}</span>
          </div>
        </div>
      )}
      {busyLabel && !ocrProcessing && (
        <div
          data-testid="translate-input-busy-overlay"
          className="fade-in-0 pointer-events-none absolute inset-0 z-10 flex animate-in items-center justify-center bg-background/70 p-3 backdrop-blur-[1px] duration-200">
          <div
            role="status"
            aria-live="polite"
            className="flex max-w-[calc(100%-32px)] items-center gap-2 rounded-lg border border-border-subtle bg-background/95 px-3 py-2 text-foreground text-sm shadow-sm">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden="true" />
            <span className="truncate">{busyLabel}</span>
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
