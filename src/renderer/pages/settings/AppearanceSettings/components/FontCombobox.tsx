import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { Input, Popover, PopoverAnchor, PopoverContent, PopoverTrigger, Tooltip } from '@cherrystudio/ui'
import { DynamicVirtualList, type DynamicVirtualListRef } from '@renderer/components/VirtualList'
import { cn } from '@renderer/utils/style'

const FONT_OPTION_HEIGHT = 32
const FONT_LIST_MAX_HEIGHT = 320

type FontOption = {
  label: string
  value: string
}

interface FontComboboxProps {
  ariaLabel: string
  className?: string
  defaultFontFamily: string
  defaultLabel: string
  emptyText: string
  fonts: string[]
  onChange: (font: string) => void
  placeholder: string
  value: string
}

const estimateFontOptionHeight = () => FONT_OPTION_HEIGHT

const FontCombobox = ({
  ariaLabel,
  className,
  defaultFontFamily,
  defaultLabel,
  emptyText,
  fonts,
  onChange,
  placeholder,
  value
}: FontComboboxProps) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<DynamicVirtualListRef>(null)
  const listboxId = useId()

  const options = useMemo<FontOption[]>(
    () => [{ label: defaultLabel, value: '' }, ...fonts.map((font) => ({ label: font, value: font }))],
    [defaultLabel, fonts]
  )
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const visibleOptions = useMemo(
    () =>
      normalizedSearch
        ? options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedSearch))
        : options,
    [normalizedSearch, options]
  )
  const selectedOption = options.find((option) => option.value === value)
  const listHeight = Math.min(
    FONT_LIST_MAX_HEIGHT,
    Math.max(FONT_OPTION_HEIGHT, visibleOptions.length * FONT_OPTION_HEIGHT)
  )

  useEffect(() => {
    if (!open) return

    const selectedIndex = visibleOptions.findIndex((option) => option.value === value)
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : visibleOptions.length > 0 ? 0 : -1)
  }, [open, value, visibleOptions])

  useEffect(() => {
    if (activeIndex >= 0) {
      listRef.current?.scrollToIndex(activeIndex, { align: 'auto' })
    }
  }, [activeIndex])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSearch('')
    }
  }

  const handleSelect = (option: FontOption) => {
    if (option.value !== value) {
      onChange(option.value)
    }
    handleOpenChange(false)
  }

  const moveActiveOption = (offset: number) => {
    if (visibleOptions.length === 0) return

    setActiveIndex((current) => {
      const nextIndex = current < 0 ? (offset > 0 ? 0 : visibleOptions.length - 1) : current + offset
      return (nextIndex + visibleOptions.length) % visibleOptions.length
    })
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      moveActiveOption(event.key === 'ArrowDown' ? 1 : -1)
      return
    }

    if (event.key === 'Enter' && open && activeIndex >= 0) {
      event.preventDefault()
      handleSelect(visibleOptions[activeIndex])
      return
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault()
      handleOpenChange(false)
    }
  }

  const renderOption = (option: FontOption, index: number) => {
    const selected = option.value === value
    const active = index === activeIndex
    const fontFamily = option.value || defaultFontFamily

    return (
      <Tooltip title={option.label} placement="left" delay={500} fullWidthTrigger>
        <button
          id={`${listboxId}-option-${index}`}
          type="button"
          role="option"
          aria-selected={selected}
          className={cn(
            'flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm outline-none',
            active && 'bg-accent',
            selected && 'text-primary'
          )}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => handleSelect(option)}>
          <span className="min-w-0 flex-1 truncate" style={{ fontFamily }}>
            {option.label}
          </span>
          {selected && <Check aria-hidden="true" className="size-4 shrink-0" />}
        </button>
      </Tooltip>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverAnchor asChild>
        <div className="relative">
          <PopoverTrigger asChild>
            <Input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-label={ariaLabel}
              aria-expanded={open}
              aria-controls={listboxId}
              aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
              autoComplete="off"
              spellCheck={false}
              value={open ? search : (selectedOption?.label ?? '')}
              placeholder={open ? (selectedOption?.label ?? placeholder) : placeholder}
              style={{ fontFamily: value || defaultFontFamily }}
              className={cn('w-full pr-8', className)}
              onFocus={() => setOpen(true)}
              onMouseDown={() => {
                if (!open) setOpen(true)
              }}
              onClick={(event) => {
                event.preventDefault()
                event.currentTarget.focus()
                if (!open) setOpen(true)
              }}
              onChange={(event) => {
                setSearch(event.target.value)
                if (!open) setOpen(true)
              }}
              onKeyDown={handleInputKeyDown}
            />
          </PopoverTrigger>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              '-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 size-4 opacity-50 transition-transform',
              open && 'rotate-180'
            )}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) overflow-hidden rounded-md p-0"
        style={{ height: visibleOptions.length === 0 ? 64 : listHeight }}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
        }}>
        {visibleOptions.length === 0 ? (
          <div className="flex h-16 items-center justify-center text-muted-foreground text-sm">{emptyText}</div>
        ) : (
          <DynamicVirtualList
            ref={listRef}
            list={visibleOptions}
            role="listbox"
            scrollerProps={{ id: listboxId, 'aria-label': ariaLabel }}
            size={listHeight}
            estimateSize={estimateFontOptionHeight}
            getItemKey={(index) => visibleOptions[index].value || '__default__'}
            itemContainerStyle={{ height: FONT_OPTION_HEIGHT }}
            overscan={5}>
            {renderOption}
          </DynamicVirtualList>
        )}
      </PopoverContent>
    </Popover>
  )
}

export default FontCombobox
