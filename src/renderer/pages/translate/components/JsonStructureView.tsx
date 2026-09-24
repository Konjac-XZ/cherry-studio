import type { ClipboardEvent, FC, ReactNode } from 'react'
import { Fragment } from 'react'

import type { JsonStructure, JsonStructureCopySeparator } from '@renderer/utils/translate'
import { normalizeJsonStructureSelection } from '@renderer/utils/translate'

type JsonValueType = 'array' | 'boolean' | 'null' | 'number' | 'object' | 'string'

const VALUE_TYPE_CLASS_NAME: Record<JsonValueType, string> = {
  array: 'text-foreground',
  boolean: 'text-info',
  null: 'text-foreground-tertiary italic',
  number: 'text-warning',
  object: 'text-foreground',
  string: 'text-success'
}

const getValueType = (value: unknown): JsonValueType => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  return typeof value as Exclude<JsonValueType, 'array' | 'null' | 'object'>
}

const formatPrimitive = (value: unknown): ReactNode => {
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  return String(value)
}

type JsonStructureRowProps = {
  depth: number
  keyLabel?: string
  path: string
  value: unknown
}

const JsonStructureRow: FC<JsonStructureRowProps> = ({ depth, keyLabel, path, value }) => {
  const type = getValueType(value)
  const entries: Array<[string, unknown]> | null =
    type === 'array'
      ? (value as unknown[]).map((item, index) => [`[${index}]`, item])
      : type === 'object'
        ? Object.entries(value as Record<string, unknown>)
        : null
  const isNonEmptyContainer = Boolean(entries?.length)
  const displayValue = entries
    ? entries.length === 0
      ? type === 'array'
        ? '[]'
        : '{}'
      : null
    : formatPrimitive(value)
  const shouldRenderRow = keyLabel !== undefined || !isNonEmptyContainer
  const childDepth = keyLabel === undefined ? depth : depth + 1

  return (
    <>
      {shouldRenderRow ? (
        <div
          className="flex w-full min-w-0 max-w-full items-start border-border-subtle border-b px-2 py-0.75 last:border-b-0"
          data-depth={depth}
          data-json-path={path}
          style={{ paddingLeft: depth * 16 + 8 }}>
          {keyLabel !== undefined ? (
            <>
              <span
                className={`wrap-break-word min-w-0 max-w-[min(30%,280px)] shrink-0 whitespace-pre-wrap text-muted-foreground ${isNonEmptyContainer ? 'font-semibold' : ''}`}
                data-json-key>
                {keyLabel}
              </span>
              {!isNonEmptyContainer ? <span className="mx-2 ml-0.5 shrink-0 text-foreground-tertiary">:</span> : null}
            </>
          ) : null}
          {displayValue !== null ? (
            <span
              className={`wrap-break-word min-w-0 max-w-full flex-1 whitespace-pre-wrap ${VALUE_TYPE_CLASS_NAME[type]}`}
              data-value-type={type}>
              {displayValue}
            </span>
          ) : null}
        </div>
      ) : null}
      {entries?.map(([childKey, childValue]) => {
        const childPath = `${path}/${childKey}`
        return (
          <Fragment key={childPath}>
            <JsonStructureRow depth={childDepth} keyLabel={childKey} path={childPath} value={childValue} />
          </Fragment>
        )
      })}
    </>
  )
}

type JsonStructureViewProps = {
  blankLineBetweenRows: boolean
  copySeparator: JsonStructureCopySeparator
  value: JsonStructure
}

const JsonStructureView: FC<JsonStructureViewProps> = ({ blankLineBetweenRows, copySeparator, value }) => {
  const handleCopy = (event: ClipboardEvent<HTMLDivElement>) => {
    const selectedText = window.getSelection()?.toString()
    if (!selectedText) return

    const normalizedText = normalizeJsonStructureSelection(selectedText, copySeparator, blankLineBetweenRows)
    if (normalizedText === selectedText) return

    event.preventDefault()
    event.clipboardData.setData('text/plain', normalizedText)
  }

  return (
    <div
      className="w-full min-w-0 max-w-full font-[var(--code-font-family)] leading-relaxed"
      data-testid="json-structure-view"
      onCopy={handleCopy}>
      <JsonStructureRow depth={0} path="$" value={value} />
    </div>
  )
}

export default JsonStructureView
