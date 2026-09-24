import { ArrowLeftRight } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

// Downstream-owned Translate UI implementation.
import { Button, Combobox, type ComboboxOption, Tooltip } from '@cherrystudio/ui'
import { useLanguages } from '@renderer/hooks/translate'
import { cn } from '@renderer/utils/style'
import { UNKNOWN_LANG_CODE } from '@renderer/utils/translate'
import type {
  TranslateBidirectionalPair,
  TranslateLangCode,
  TranslateSourceLanguage
} from '@shared/data/preference/preferenceTypes'

type Props = {
  className?: string
  sourceLanguage: TranslateSourceLanguage
  onSourceChange: (language: TranslateSourceLanguage) => void
  targetLanguage: TranslateLangCode
  onTargetChange: (language: TranslateLangCode) => void
  detectedLanguage: TranslateLangCode | null
  isBidirectional: boolean
  bidirectionalPair: TranslateBidirectionalPair
  disabled: boolean
  couldExchange: boolean
  onExchange: () => void
}

const AUTO_EMOJI = '🌐'
const UNKNOWN_EMOJI = '🏳️'
const LANGUAGE_SELECT_WIDTH = 'clamp(64px, 16vw, 200px)'

const TranslateLanguageBar: FC<Props> = ({
  className,
  sourceLanguage,
  onSourceChange,
  targetLanguage,
  onTargetChange,
  detectedLanguage,
  isBidirectional,
  bidirectionalPair,
  disabled,
  couldExchange,
  onExchange
}) => {
  const { t } = useTranslation()
  const { languages, getLabel, getLanguage } = useLanguages()

  const selectableLanguages = useMemo(
    () => languages?.filter((lang) => String(lang.langCode) !== UNKNOWN_LANG_CODE) ?? [],
    [languages]
  )

  const getLanguageLabel = useCallback(
    (langCode: TranslateLangCode) => {
      const lang = getLanguage(langCode)
      return getLabel(lang ?? langCode, false) ?? lang?.value ?? langCode
    },
    [getLabel, getLanguage]
  )

  const getLanguageDisplay = useCallback(
    (langCode: TranslateLangCode) => {
      const lang = getLanguage(langCode)
      return {
        emoji: lang?.emoji ?? UNKNOWN_EMOJI,
        label: getLabel(lang ?? langCode, false) ?? lang?.value ?? langCode
      }
    },
    [getLabel, getLanguage]
  )

  const sourceDisplay = useMemo(() => {
    if (sourceLanguage === 'auto') {
      const base = t('translate.detected.language')
      const detected = detectedLanguage === UNKNOWN_LANG_CODE ? null : detectedLanguage
      return {
        emoji: detected ? (getLanguage(detected)?.emoji ?? UNKNOWN_EMOJI) : AUTO_EMOJI,
        label: detected ? `${base} (${getLanguageLabel(detected)})` : base
      }
    }
    const lang = getLanguage(sourceLanguage)
    return {
      emoji: lang?.emoji ?? UNKNOWN_EMOJI,
      label: getLabel(lang ?? sourceLanguage, false) ?? lang?.value ?? sourceLanguage
    }
  }, [detectedLanguage, getLabel, getLanguage, getLanguageLabel, sourceLanguage, t])

  const autoSourceOption = useMemo(() => {
    const base = t('translate.detected.language')
    const detected = detectedLanguage === UNKNOWN_LANG_CODE ? null : detectedLanguage
    return {
      emoji: detected ? (getLanguage(detected)?.emoji ?? UNKNOWN_EMOJI) : AUTO_EMOJI,
      label: detected ? `${base} (${getLanguageLabel(detected)})` : base
    }
  }, [detectedLanguage, getLanguage, getLanguageLabel, t])

  const target = getLanguage(targetLanguage)
  const targetLabel = getLabel(target ?? targetLanguage, false) ?? target?.value ?? targetLanguage
  const bidirectionalSource = getLanguageDisplay(bidirectionalPair[0])
  const bidirectionalTarget = getLanguageDisplay(bidirectionalPair[1])

  const handleSourceSelect = (value: TranslateSourceLanguage) => {
    onSourceChange(value)
  }

  const handleTargetSelect = (lang: TranslateLangCode) => {
    if (lang === UNKNOWN_LANG_CODE) return
    onTargetChange(lang)
  }

  const languageIcon = useCallback((emoji: string) => <span className="text-sm leading-none">{emoji}</span>, [])

  const sourceOptions = useMemo<ComboboxOption[]>(
    () => [
      {
        value: 'auto',
        label: autoSourceOption.label,
        icon: languageIcon(autoSourceOption.emoji)
      },
      ...selectableLanguages.map((lang) => ({
        value: lang.langCode,
        label: getLabel(lang, false) ?? lang.value,
        icon: languageIcon(lang.emoji)
      }))
    ],
    [autoSourceOption.emoji, autoSourceOption.label, getLabel, languageIcon, selectableLanguages]
  )

  const targetOptions = useMemo<ComboboxOption[]>(
    () =>
      selectableLanguages.map((lang) => ({
        value: lang.langCode,
        label: getLabel(lang, false) ?? lang.value,
        icon: languageIcon(lang.emoji)
      })),
    [getLabel, languageIcon, selectableLanguages]
  )
  return (
    <div className={cn('flex min-w-0 shrink items-center gap-1.5 px-4 py-4 lg:px-6', className)}>
      <Combobox
        size="default"
        options={sourceOptions}
        value={sourceLanguage}
        onChange={(value) => handleSourceSelect(Array.isArray(value) ? value[0] : value)}
        disabled={disabled}
        placeholder={t('translate.source_language')}
        searchable={false}
        emptyText={t('common.no_results')}
        width={LANGUAGE_SELECT_WIDTH}
        popoverClassName="w-(--radix-popover-trigger-width)"
        renderValue={(value, options) => {
          const option = options.find((item) => item.value === value)
          return (
            <div className="flex min-w-0 flex-1 items-center gap-2 truncate">
              <span className="sr-only">{t('translate.source_language')}</span>
              {value !== 'auto' && option?.icon}
              <span className="truncate">{option?.label ?? sourceDisplay.label}</span>
            </div>
          )
        }}
      />

      <Tooltip content={t('common.swap')} placement="bottom">
        <Button
          variant="ghost"
          size="icon"
          onClick={onExchange}
          disabled={!couldExchange}
          aria-label={t('common.swap')}
          className="h-8 w-8 shrink-0 rounded-full text-muted-foreground shadow-none transition-all hover:bg-accent hover:text-foreground active:scale-90">
          <ArrowLeftRight size={14} />
        </Button>
      </Tooltip>

      {isBidirectional ? (
        <Button
          variant="outline"
          size="default"
          type="button"
          disabled
          aria-label={`${bidirectionalSource.label} ⇆ ${bidirectionalTarget.label}`}
          style={{ width: LANGUAGE_SELECT_WIDTH }}
          className="h-8 min-w-0 max-w-[200px] justify-center gap-2 overflow-hidden bg-background-subtle px-3 text-foreground text-sm shadow-none disabled:opacity-100">
          <span className="sr-only">{`${bidirectionalSource.label} ⇆ ${bidirectionalTarget.label}`}</span>
          <span className="min-w-0 truncate">{bidirectionalSource.label}</span>
          <ArrowLeftRight size={14} className="shrink-0 text-foreground-tertiary" />
          <span className="min-w-0 truncate">{bidirectionalTarget.label}</span>
        </Button>
      ) : (
        <Combobox
          size="default"
          options={targetOptions}
          value={targetLanguage}
          onChange={(value) => handleTargetSelect(Array.isArray(value) ? value[0] : value)}
          disabled={disabled}
          placeholder={t('translate.target_language')}
          searchable={false}
          emptyText={t('common.no_results')}
          width={LANGUAGE_SELECT_WIDTH}
          popoverClassName="w-(--radix-popover-trigger-width)"
          renderValue={(value, options) => {
            const option = options.find((item) => item.value === value)
            return (
              <div className="flex min-w-0 flex-1 items-center gap-2 truncate">
                <span className="sr-only">{t('translate.target_language')}</span>
                {option?.icon ?? languageIcon(target?.emoji ?? UNKNOWN_EMOJI)}
                <span className="truncate">{option?.label ?? targetLabel}</span>
              </div>
            )
          }}
        />
      )}
    </div>
  )
}

export default TranslateLanguageBar
