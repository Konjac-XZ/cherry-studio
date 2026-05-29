import {
  Button,
  ConfirmDialog,
  Field,
  FieldDescription,
  FieldLabel,
  HelpTooltip,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  PageSidePanel,
  PageSidePanelItem,
  PageSidePanelSection,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedControl,
  Switch,
  Tooltip
} from '@cherrystudio/ui'
import { usePreference } from '@data/hooks/usePreference'
import { loggerService } from '@logger'
import db from '@renderer/databases'
import { useLanguages, useTranslateLanguages } from '@renderer/hooks/translate'
import {
  type GlossaryEntry,
  GlossaryService,
  GLOSSARY_LOAD_FAILED_MESSAGE
} from '@renderer/services/GlossaryService'
import { cn } from '@renderer/utils'
import { UNKNOWN_LANG_CODE } from '@renderer/utils/translate'
import { uuid } from '@renderer/utils'
import {
  DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES,
  type RegexReplacementRule,
  TRANSLATION_POST_PROCESSOR_SETTING_KEYS
} from '@renderer/utils/translationPostProcessors'
import { TRANSLATE_PROMPT } from '@shared/config/prompts'
import type {
  AutoDetectionMethod,
  PersistedLangCode,
  TranslateLangCode,
  TranslateBidirectionalPair
} from '@shared/data/preference/preferenceTypes'
import { parsePersistedLangCode, PersistedLangCodeSchema } from '@shared/data/preference/preferenceTypes'
import { BUILTIN_TRANSLATE_LANGUAGES } from '@shared/data/presets/translate-languages'
import type { TranslateLanguage } from '@shared/data/types/translate'
import { ArrowLeftRight, ChevronDown, PenLine, Plus, Trash2, X } from 'lucide-react'
import type { FC, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import IconButton from './components/IconButton'
import LanguagePicker from './components/LanguagePicker'

type Props = {
  visible: boolean
  onClose: () => void
}

const BUILTIN_LANG_CODES = new Set<string>(BUILTIN_TRANSLATE_LANGUAGES.map((lang) => lang.langCode))
const EMOJI_OPTIONS = ['🌐', '🇺🇸', '🇬🇧', '🇨🇳', '🇯🇵', '🇰🇷', '🇫🇷', '🇩🇪', '🇪🇸', '🇵🇹', '🇮🇳', '🇧🇷']
const logger = loggerService.withContext('TranslateSettings')

const TranslateSettings: FC<Props> = ({ visible, onClose }) => {
  const { t } = useTranslation()
  const [bidirectionalPair, setBidirectionalPair] = usePreference('feature.translate.page.bidirectional_pair')
  const [enableMarkdown, setEnableMarkdown] = usePreference('feature.translate.page.enable_markdown')
  const [autoCopy, setAutoCopy] = usePreference('feature.translate.page.auto_copy')
  const [autoDetectionMethod, setAutoDetectionMethod] = usePreference('feature.translate.auto_detection_method')
  const [isScrollSyncEnabled, setIsScrollSyncEnabled] = usePreference('feature.translate.page.scroll_sync')
  const [isBidirectional, setIsBidirectional] = usePreference('feature.translate.page.bidirectional_enabled')

  const safePersist = useCallback(
    async (persistPromise: Promise<unknown>, actionName: string) => {
      try {
        await persistPromise
      } catch (error) {
        logger.error(`Failed to persist ${actionName}`, error as Error)
        window.toast.error(t('common.save_failed'))
      }
    },
    [t]
  )

  const updateBidirectionalPair = useCallback(
    (next: TranslateBidirectionalPair) => {
      if (next[0] === next[1]) {
        window.toast.warning(t('translate.language.same'))
        return
      }
      void safePersist(setBidirectionalPair(next), 'translate bidirectional pair')
    },
    [safePersist, setBidirectionalPair, t]
  )

  const toggleItems: Array<{ key: string; label: string; value: boolean; onChange: (next: boolean) => void }> = [
    {
      key: 'markdown',
      label: t('translate.settings.preview'),
      value: enableMarkdown,
      onChange: (next) => void safePersist(setEnableMarkdown(next), 'translate markdown preference')
    },
    {
      key: 'autoCopy',
      label: t('translate.settings.autoCopy'),
      value: autoCopy,
      onChange: (next) => void safePersist(setAutoCopy(next), 'translate auto copy preference')
    },
    {
      key: 'scrollSync',
      label: t('translate.settings.scroll_sync'),
      value: isScrollSyncEnabled,
      onChange: (next) => void safePersist(setIsScrollSyncEnabled(next), 'translate scroll sync preference')
    }
  ]

  const detectionOptions: Array<{ value: AutoDetectionMethod; label: string; tip: string }> = [
    {
      value: 'auto',
      label: t('translate.detect.method.auto.label'),
      tip: t('translate.detect.method.auto.tip')
    },
    {
      value: 'franc',
      label: t('translate.detect.method.algo.label'),
      tip: t('translate.detect.method.algo.tip')
    },
    {
      value: 'llm',
      label: t('translate.detect.method.llm.label'),
      tip: t('translate.detect.method.llm.tip')
    }
  ]

  return (
    <PageSidePanel
      open={visible}
      onClose={onClose}
      title={t('translate.settings.title')}
      closeLabel={t('translate.close')}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-5">
          {toggleItems.map((item) => (
            <PageSidePanelItem
              key={item.key}
              title={item.label}
              action={<Switch size="sm" checked={item.value} onCheckedChange={item.onChange} />}
            />
          ))}

          <PageSidePanelItem
            title={
              <span className="flex items-center gap-1">
                <span>{t('translate.detect.method.label')}</span>
                <HelpTooltip
                  content={t('translate.detect.method.tip')}
                  iconProps={{ className: 'text-foreground-muted' }}
                />
              </span>
            }
            action={
              <SegmentedControl<AutoDetectionMethod>
                size="sm"
                aria-label={t('translate.detect.method.label')}
                value={autoDetectionMethod}
                onValueChange={(value) =>
                  void safePersist(setAutoDetectionMethod(value), 'translate auto detection method')
                }
                options={detectionOptions.map((opt) => ({
                  value: opt.value,
                  label: (
                    <Tooltip content={opt.tip} placement="top">
                      <span>{opt.label}</span>
                    </Tooltip>
                  )
                }))}
              />
            }
          />

          <PageSidePanelItem
            title={
              <span className="flex items-center gap-1">
                <span>{t('translate.settings.bidirectional')}</span>
                <HelpTooltip
                  content={t('translate.settings.bidirectional_tip')}
                  iconProps={{ className: 'text-foreground-muted' }}
                />
              </span>
            }
            action={
              <Switch
                size="sm"
                checked={isBidirectional}
                onCheckedChange={(next) =>
                  void safePersist(setIsBidirectional(next), 'translate bidirectional enabled preference')
                }
              />
            }>
            {isBidirectional && (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <LanguagePicker
                    value={bidirectionalPair[0]}
                    onChange={(value) => updateBidirectionalPair([value, bidirectionalPair[1]])}
                  />
                </div>
                <ArrowLeftRight size={12} className="shrink-0 text-foreground-muted" />
                <div className="flex-1">
                  <LanguagePicker
                    value={bidirectionalPair[1]}
                    onChange={(value) => updateBidirectionalPair([bidirectionalPair[0], value])}
                  />
                </div>
              </div>
            )}
          </PageSidePanelItem>
        </div>

        <TranslatePromptField />

        <TranslationPostProcessingSettings />

        <RegexReplacementSettings />

        <GlossarySettings />

        <CustomLanguageList />
      </div>
    </PageSidePanel>
  )
}

const TranslateSettingsCoreContent: FC = () => {
  return (
    <div className="flex flex-col gap-8">
      <TranslatePromptField />
      <TranslationPostProcessingSettings />
      <RegexReplacementSettings />
      <GlossarySettings />
      <CustomLanguageList />
    </div>
  )
}

const TranslatePromptField: FC = () => {
  const { t } = useTranslation()
  const [persisted, setPersisted] = usePreference('feature.translate.model_prompt')
  const [local, setLocal] = useState<string>(persisted)
  const pendingRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveFailedMessageRef = useRef(t('common.save_failed'))

  useEffect(() => {
    saveFailedMessageRef.current = t('common.save_failed')
  }, [t])

  const safePersist = useCallback(async (persistPromise: Promise<unknown>, actionName: string) => {
    try {
      await persistPromise
    } catch (error) {
      logger.error(`Failed to persist ${actionName}`, error as Error)
      window.toast.error(saveFailedMessageRef.current || 'Failed to save')
    }
  }, [])

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (pendingRef.current === null || pendingRef.current === persisted) {
      setLocal(persisted)
      pendingRef.current = null
    }
  }, [persisted])

  const schedulePersist = useCallback(
    (next: string) => {
      clearSaveTimer()
      pendingRef.current = next
      setLocal(next)

      const savedValue = next
      saveTimerRef.current = setTimeout(() => {
        void safePersist(setPersisted(savedValue), 'translate prompt')
        pendingRef.current = null
        saveTimerRef.current = null
      }, 400)
    },
    [clearSaveTimer, safePersist, setPersisted]
  )

  useEffect(
    () => () => {
      clearSaveTimer()
      if (pendingRef.current !== null) {
        void safePersist(setPersisted(pendingRef.current), 'translate prompt')
      }
    },
    [clearSaveTimer, safePersist, setPersisted]
  )

  const isDefault = local === TRANSLATE_PROMPT
  const onReset = () => {
    clearSaveTimer()
    pendingRef.current = null
    setLocal(TRANSLATE_PROMPT)
    void safePersist(setPersisted(TRANSLATE_PROMPT), 'translate prompt')
  }

  return (
    <PageSidePanelSection
      title={t('settings.translate.prompt')}
      actions={
        !isDefault && (
          <button
            type="button"
            onClick={onReset}
            className="rounded-md text-foreground-muted text-xs transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            {t('common.reset')}
          </button>
        )
      }>
      <textarea
        value={local}
        onChange={(e) => schedulePersist(e.target.value)}
        className="min-h-30 w-full resize-y rounded-md border border-border-subtle bg-muted/40 p-3 text-foreground-secondary text-sm leading-relaxed outline-none transition-colors focus:border-border-hover"
      />
    </PageSidePanelSection>
  )
}

const CustomLanguageList: FC = () => {
  const { t, i18n } = useTranslation()
  const { languages } = useLanguages()
  const [isAdding, setIsAdding] = useState(false)

  const customLanguages = useMemo(
    () =>
      languages?.filter(
        (language) => language.langCode !== UNKNOWN_LANG_CODE && !BUILTIN_LANG_CODES.has(language.langCode)
      ) ?? [],
    [languages]
  )

  const addLanguageLabel = i18n.language.startsWith('zh')
    ? `${t('common.add')}${t('common.language')}`
    : `${t('common.add')} ${t('common.language')}`

  return (
    <PageSidePanelSection
      title={t('translate.custom.label')}
      actions={
        customLanguages.length > 0 && (
          <span className="text-foreground-muted text-xs">{t('code.count', { count: customLanguages.length })}</span>
        )
      }>
      <div className="flex flex-col gap-1">
        {customLanguages.map((language) => (
          <CustomLanguageRow key={language.langCode} language={language} />
        ))}
        {customLanguages.length === 0 && !isAdding && (
          <p className="rounded-md bg-muted/30 px-2 py-2 text-center text-muted-foreground text-sm">
            {t('common.no_results')}
          </p>
        )}
        {isAdding ? (
          <AddCustomLanguageForm
            languages={languages ?? []}
            onAdded={() => setIsAdding(false)}
            onCancel={() => setIsAdding(false)}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
            aria-label={addLanguageLabel}
            className="mt-1 h-9 w-full">
            <Plus size={13} />
            <span>{addLanguageLabel}</span>
          </Button>
        )}
      </div>
    </PageSidePanelSection>
  )
}

const TranslationPostProcessingSettings: FC = () => {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState(true)
  const [zhCnMarkdownSmartQuotes, setZhCnMarkdownSmartQuotes] = useState(
    DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES.zhCnMarkdownSmartQuotes
  )
  const [zhMarkdownTextSpacing, setZhMarkdownTextSpacing] = useState(
    DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES.zhMarkdownTextSpacing
  )

  const load = useCallback(async () => {
    try {
      const [enabledSetting, quotesSetting, spacingSetting] = await Promise.all([
        db.settings.get({ id: TRANSLATION_POST_PROCESSOR_SETTING_KEYS.enabled }),
        db.settings.get({ id: TRANSLATION_POST_PROCESSOR_SETTING_KEYS.zhCnMarkdownSmartQuotes }),
        db.settings.get({ id: TRANSLATION_POST_PROCESSOR_SETTING_KEYS.zhMarkdownTextSpacing })
      ])
      setEnabled(Boolean(enabledSetting?.value ?? true))
      setZhCnMarkdownSmartQuotes(
        Boolean(quotesSetting?.value ?? DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES.zhCnMarkdownSmartQuotes)
      )
      setZhMarkdownTextSpacing(
        Boolean(spacingSetting?.value ?? DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES.zhMarkdownTextSpacing)
      )
    } catch (error) {
      logger.error('Failed to load translation post-processing settings', error as Error)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const persistBoolean = useCallback(
    async (id: string, value: boolean, setLocal: (value: boolean) => void) => {
      setLocal(value)
      try {
        await db.settings.put({ id, value })
      } catch (error) {
        logger.error(`Failed to persist translation post-processing setting ${id}`, error as Error)
        window.toast.error(t('common.save_failed'))
        void load()
      }
    },
    [load, t]
  )

  return (
    <PageSidePanelSection title={t('translate.postprocess.enable')}>
      <div className="flex flex-col gap-4">
        <PageSidePanelItem
          title={t('translate.postprocess.enable')}
          action={
            <Switch
              size="sm"
              checked={enabled}
              onCheckedChange={(next) =>
                void persistBoolean(TRANSLATION_POST_PROCESSOR_SETTING_KEYS.enabled, next, setEnabled)
              }
            />
          }
        />
        <PageSidePanelItem
          title={t('translate.settings.zh_cn_smart_quotes.label')}
          action={
            <Switch
              size="sm"
              checked={zhCnMarkdownSmartQuotes}
              disabled={!enabled}
              onCheckedChange={(next) =>
                void persistBoolean(
                  TRANSLATION_POST_PROCESSOR_SETTING_KEYS.zhCnMarkdownSmartQuotes,
                  next,
                  setZhCnMarkdownSmartQuotes
                )
              }
            />
          }
        />
        <PageSidePanelItem
          title={t('translate.settings.zh_markdown_spacing.label')}
          action={
            <Switch
              size="sm"
              checked={zhMarkdownTextSpacing}
              disabled={!enabled}
              onCheckedChange={(next) =>
                void persistBoolean(
                  TRANSLATION_POST_PROCESSOR_SETTING_KEYS.zhMarkdownTextSpacing,
                  next,
                  setZhMarkdownTextSpacing
                )
              }
            />
          }
        />
      </div>
    </PageSidePanelSection>
  )
}

type RegexRuleDraft = Pick<RegexReplacementRule, 'pattern' | 'flags' | 'replacement'>

const RegexReplacementSettings: FC = () => {
  const { t } = useTranslation()
  const [rules, setRules] = useState<RegexReplacementRule[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [draft, setDraft] = useState<RegexRuleDraft>({ pattern: '', flags: 'g', replacement: '' })
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const patternId = useId()
  const flagsId = useId()
  const replacementId = useId()

  useEffect(() => {
    void (async () => {
      try {
        const entry = await db.settings.get({ id: TRANSLATION_POST_PROCESSOR_SETTING_KEYS.regexReplacementRules })
        if (entry && Array.isArray(entry.value)) {
          setRules(entry.value as RegexReplacementRule[])
        }
      } catch (error) {
        logger.error('Failed to load regex replacement rules', error as Error)
      }
    })()
  }, [])

  const persistRules = useCallback(
    async (nextRules: RegexReplacementRule[]) => {
      setRules(nextRules)
      try {
        await db.settings.put({
          id: TRANSLATION_POST_PROCESSOR_SETTING_KEYS.regexReplacementRules,
          value: nextRules
        })
      } catch (error) {
        logger.error('Failed to persist regex replacement rules', error as Error)
        window.toast.error(t('common.save_failed'))
      }
    },
    [t]
  )

  const resetDraft = () => {
    setDraft({ pattern: '', flags: 'g', replacement: '' })
    setErrorKey(null)
  }

  const cancelAdd = () => {
    resetDraft()
    setIsAdding(false)
  }

  const submitAdd = async () => {
    const pattern = draft.pattern.trim()
    const flags = draft.flags.trim()
    if (!pattern) {
      setErrorKey('settings.translate.regex_replacement.error.pattern_required')
      return
    }

    try {
      new RegExp(pattern, flags || undefined)
    } catch {
      setErrorKey('settings.translate.regex_replacement.error.invalid_pattern')
      return
    }

    await persistRules([...rules, { id: uuid(), pattern, flags, replacement: draft.replacement }])
    resetDraft()
    setIsAdding(false)
  }

  const deleteRule = async (id: string) => {
    await persistRules(rules.filter((rule) => rule.id !== id))
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void submitAdd()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelAdd()
    }
  }

  return (
    <PageSidePanelSection
      title={t('settings.translate.regex_replacement.title')}
      actions={
        !isAdding && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`${t('common.add')} ${t('settings.translate.regex_replacement.title')}`}
            onClick={() => setIsAdding(true)}>
            <Plus size={13} />
            <span>{t('common.add')}</span>
          </Button>
        )
      }>
      <div className="flex flex-col gap-2">
        {rules.map((rule) => (
          <div key={rule.id} className="flex items-start gap-2 rounded-md bg-muted/20 px-2 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-foreground text-xs">
                /{rule.pattern}/{rule.flags}
              </div>
              <div className="truncate text-muted-foreground text-xs">{rule.replacement || '""'}</div>
            </div>
            <IconButton
              size="xs"
              tone="destructive"
              onClick={() => void deleteRule(rule.id)}
              aria-label={t('common.delete')}
              className="shrink-0 text-foreground-muted/70 hover:bg-transparent">
              <Trash2 size={10} />
            </IconButton>
          </div>
        ))}

        {rules.length === 0 && !isAdding && (
          <p className="rounded-md bg-muted/30 px-2 py-2 text-center text-muted-foreground text-sm">
            {t('common.no_results')}
          </p>
        )}

        {isAdding && (
          <div className="space-y-3 rounded-lg bg-muted/20 p-3" onKeyDown={handleKeyDown}>
            <Field>
              <FieldLabel htmlFor={patternId} className={customLanguageFieldSubtitleClassName}>
                {t('settings.translate.regex_replacement.pattern')}
              </FieldLabel>
              <Input
                id={patternId}
                value={draft.pattern}
                autoFocus
                aria-invalid={Boolean(errorKey) || undefined}
                placeholder={t('settings.translate.regex_replacement.pattern_placeholder')}
                onChange={(event) => {
                  setDraft((prev) => ({ ...prev, pattern: event.target.value }))
                  setErrorKey(null)
                }}
              />
              {errorKey && <FieldDescription className="text-destructive">{t(errorKey)}</FieldDescription>}
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[88px_1fr]">
              <Field>
                <FieldLabel htmlFor={flagsId} className={customLanguageFieldSubtitleClassName}>
                  {t('settings.translate.regex_replacement.flags')}
                </FieldLabel>
                <Input
                  id={flagsId}
                  value={draft.flags}
                  maxLength={10}
                  placeholder="gi"
                  onChange={(event) => setDraft((prev) => ({ ...prev, flags: event.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={replacementId} className={customLanguageFieldSubtitleClassName}>
                  {t('settings.translate.regex_replacement.replacement')}
                </FieldLabel>
                <Input
                  id={replacementId}
                  value={draft.replacement}
                  placeholder={t('settings.translate.regex_replacement.replacement_placeholder')}
                  onChange={(event) => setDraft((prev) => ({ ...prev, replacement: event.target.value }))}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={cancelAdd}>
                {t('common.cancel')}
              </Button>
              <Button type="button" variant="default" size="sm" onClick={() => void submitAdd()}>
                {t('common.add')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageSidePanelSection>
  )
}

type GlossaryDraft = Pick<GlossaryEntry, 'sourcePhrase' | 'targetPhrase' | 'targetLanguage'>

const GlossarySettings: FC = () => {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<GlossaryEntry[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingEntry, setEditingEntry] = useState<GlossaryEntry | null>(null)
  const [draft, setDraft] = useState<GlossaryDraft>({
    sourcePhrase: '',
    targetPhrase: '',
    targetLanguage: 'zh-cn'
  })
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const sourceId = useId()
  const targetId = useId()

  const load = useCallback(async () => {
    try {
      setEntries(await GlossaryService.getAll())
    } catch (error) {
      logger.error('Failed to load glossary entries', error as Error)
      window.toast.error(GLOSSARY_LOAD_FAILED_MESSAGE)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const resetDraft = () => {
    setDraft({ sourcePhrase: '', targetPhrase: '', targetLanguage: 'zh-cn' })
    setEditingEntry(null)
    setErrorKey(null)
  }

  const cancelEdit = () => {
    resetDraft()
    setIsAdding(false)
  }

  const startEdit = (entry: GlossaryEntry) => {
    setEditingEntry(entry)
    setDraft({
      sourcePhrase: entry.sourcePhrase,
      targetPhrase: entry.targetPhrase,
      targetLanguage: entry.targetLanguage
    })
    setErrorKey(null)
    setIsAdding(true)
  }

  const submit = async () => {
    const sourcePhrase = draft.sourcePhrase.trim()
    const targetPhrase = draft.targetPhrase.trim()
    if (!sourcePhrase) {
      setErrorKey('settings.translate.glossary.error.source_empty')
      return
    }
    if (!targetPhrase) {
      setErrorKey('settings.translate.glossary.error.target_empty')
      return
    }

    try {
      if (editingEntry) {
        await GlossaryService.update(editingEntry.id, {
          sourcePhrase,
          targetPhrase,
          targetLanguage: draft.targetLanguage
        })
      } else {
        await GlossaryService.add({ sourcePhrase, targetPhrase, targetLanguage: draft.targetLanguage })
      }
      await load()
      cancelEdit()
    } catch (error) {
      const messageKey =
        (error as Error).message === 'DUPLICATE_ENTRY'
          ? 'settings.translate.glossary.error.duplicate'
          : 'common.save_failed'
      window.toast.error(t(messageKey))
    }
  }

  const deleteEntry = async (id: string) => {
    try {
      await GlossaryService.delete(id)
      setEntries((prev) => prev.filter((entry) => entry.id !== id))
    } catch (error) {
      logger.error('Failed to delete glossary entry', error as Error)
      window.toast.error(t('settings.translate.glossary.error.delete'))
    }
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void submit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelEdit()
    }
  }

  return (
    <PageSidePanelSection
      title={t('settings.translate.glossary.title')}
      actions={
        !isAdding && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`${t('common.add')} ${t('settings.translate.glossary.title')}`}
            onClick={() => setIsAdding(true)}>
            <Plus size={13} />
            <span>{t('common.add')}</span>
          </Button>
        )
      }>
      <div className="flex flex-col gap-2">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-2 rounded-md bg-muted/20 px-2 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-foreground text-sm">{entry.sourcePhrase}</div>
              <div className="truncate text-muted-foreground text-xs">
                {entry.targetPhrase} · {entry.targetLanguage}
              </div>
            </div>
            <IconButton
              size="xs"
              onClick={() => startEdit(entry)}
              aria-label={t('common.edit')}
              className="shrink-0 text-foreground-muted/70 hover:bg-transparent">
              <PenLine size={10} />
            </IconButton>
            <IconButton
              size="xs"
              tone="destructive"
              onClick={() => void deleteEntry(entry.id)}
              aria-label={t('common.delete')}
              className="shrink-0 text-foreground-muted/70 hover:bg-transparent">
              <Trash2 size={10} />
            </IconButton>
          </div>
        ))}

        {entries.length === 0 && !isAdding && (
          <p className="rounded-md bg-muted/30 px-2 py-2 text-center text-muted-foreground text-sm">
            {t('common.no_results')}
          </p>
        )}

        {isAdding && (
          <div className="space-y-3 rounded-lg bg-muted/20 p-3" onKeyDown={handleKeyDown}>
            <Field>
              <FieldLabel htmlFor={sourceId} className={customLanguageFieldSubtitleClassName}>
                {t('settings.translate.glossary.source')}
              </FieldLabel>
              <Input
                id={sourceId}
                value={draft.sourcePhrase}
                autoFocus
                aria-invalid={errorKey === 'settings.translate.glossary.error.source_empty' || undefined}
                placeholder={t('settings.translate.glossary.source_placeholder')}
                onChange={(event) => {
                  setDraft((prev) => ({ ...prev, sourcePhrase: event.target.value }))
                  setErrorKey(null)
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={targetId} className={customLanguageFieldSubtitleClassName}>
                {t('settings.translate.glossary.target')}
              </FieldLabel>
              <Input
                id={targetId}
                value={draft.targetPhrase}
                aria-invalid={errorKey === 'settings.translate.glossary.error.target_empty' || undefined}
                placeholder={t('settings.translate.glossary.target_placeholder')}
                onChange={(event) => {
                  setDraft((prev) => ({ ...prev, targetPhrase: event.target.value }))
                  setErrorKey(null)
                }}
              />
            </Field>
            <Field>
              <FieldLabel className={customLanguageFieldSubtitleClassName}>
                {t('settings.translate.glossary.language')}
              </FieldLabel>
              <LanguagePicker
                value={draft.targetLanguage}
                onChange={(value: TranslateLangCode) => setDraft((prev) => ({ ...prev, targetLanguage: value }))}
              />
            </Field>
            {errorKey && <FieldDescription className="text-destructive">{t(errorKey)}</FieldDescription>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={cancelEdit}>
                {t('common.cancel')}
              </Button>
              <Button type="button" variant="default" size="sm" onClick={() => void submit()}>
                {editingEntry ? t('common.save') : t('common.add')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageSidePanelSection>
  )
}

type FormErrorField = 'name' | 'code'
type FormError = { field: FormErrorField; messageKey: string }
type ValidLanguageForm = { value: string; langCode: PersistedLangCode; emoji: string }
type LanguageFormValidation = { ok: false; error: FormError } | { ok: true; data: ValidLanguageForm }
const customLanguageFieldSubtitleClassName = 'text-xs font-medium leading-4 text-foreground-secondary'

const AddCustomLanguageForm: FC<{ languages: TranslateLanguage[]; onAdded?: () => void; onCancel?: () => void }> = ({
  languages,
  onAdded,
  onCancel
}) => {
  const { t } = useTranslation()
  const { add: addLanguage } = useTranslateLanguages()
  const [value, setValue] = useState('')
  const [langCode, setLangCode] = useState('')
  const [emoji, setEmoji] = useState('🌐')
  const [error, setError] = useState<FormError | null>(null)
  const nameId = useId()
  const codeId = useId()

  const clearError = (field: FormErrorField) => {
    if (error?.field === field) setError(null)
  }

  const validate = (): LanguageFormValidation => {
    const nextValue = value.trim()
    const nextLangCode = langCode.trim().toLowerCase()
    if (!nextValue)
      return { ok: false, error: { field: 'name', messageKey: 'settings.translate.custom.error.value.empty' } }
    if (!nextLangCode)
      return { ok: false, error: { field: 'code', messageKey: 'settings.translate.custom.error.langCode.empty' } }
    if (!PersistedLangCodeSchema.safeParse(nextLangCode).success)
      return { ok: false, error: { field: 'code', messageKey: 'settings.translate.custom.error.langCode.invalid' } }
    if (BUILTIN_LANG_CODES.has(nextLangCode))
      return { ok: false, error: { field: 'code', messageKey: 'settings.translate.custom.error.langCode.builtin' } }
    if (languages.some((language) => language.langCode === nextLangCode))
      return { ok: false, error: { field: 'code', messageKey: 'settings.translate.custom.error.langCode.exists' } }
    return { ok: true, data: { value: nextValue, langCode: parsePersistedLangCode(nextLangCode), emoji } }
  }

  const handleAdd = async () => {
    const result = validate()
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    await addLanguage(result.data)
    setValue('')
    setLangCode('')
    setEmoji('🌐')
    onAdded?.()
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void handleAdd()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onCancel?.()
    }
  }

  return (
    <div className="space-y-3 rounded-lg bg-muted/20 p-3" onKeyDown={handleKeyDown}>
      <Field>
        <FieldLabel htmlFor={nameId} className={customLanguageFieldSubtitleClassName}>
          {t('settings.translate.custom.value.label')}
        </FieldLabel>
        <InputGroup data-invalid={error?.field === 'name' || undefined}>
          <InputGroupAddon align="inline-start">
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </InputGroupAddon>
          <InputGroupInput
            id={nameId}
            value={value}
            autoFocus
            placeholder={t('settings.translate.custom.value.placeholder')}
            onChange={(e) => {
              setValue(e.target.value)
              clearError('name')
            }}
          />
        </InputGroup>
        {error?.field === 'name' && (
          <FieldDescription className="text-destructive">{t(error.messageKey)}</FieldDescription>
        )}
      </Field>
      <Field>
        <FieldLabel htmlFor={codeId} className={customLanguageFieldSubtitleClassName}>
          {t('settings.translate.custom.langCode.label')}
        </FieldLabel>
        <Input
          id={codeId}
          value={langCode}
          aria-invalid={error?.field === 'code' || undefined}
          placeholder={t('settings.translate.custom.langCode.placeholder')}
          onChange={(e) => {
            setLangCode(e.target.value)
            clearError('code')
          }}
        />
        {error?.field === 'code' ? (
          <FieldDescription className="text-destructive">{t(error.messageKey)}</FieldDescription>
        ) : (
          <FieldDescription className="text-muted-foreground text-xs leading-4">
            {t('settings.translate.custom.langCode.help')}
          </FieldDescription>
        )}
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="button" variant="default" size="sm" onClick={() => void handleAdd()}>
          {t('common.add')}
        </Button>
      </div>
    </div>
  )
}

const CustomLanguageRow: FC<{ language: TranslateLanguage }> = ({ language }) => {
  const { t } = useTranslation()
  const { update: updateLanguage, remove: deleteLanguage } = useTranslateLanguages()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(language.value)
  const [emoji, setEmoji] = useState(language.emoji)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    setValue(language.value)
    setEmoji(language.emoji)
  }, [language.emoji, language.value])

  const [nameErrorKey, setNameErrorKey] = useState<string | null>(null)
  const nameId = useId()
  const codeId = useId()

  const handleSave = async () => {
    const nextValue = value.trim()
    if (!nextValue) {
      setNameErrorKey('settings.translate.custom.error.value.empty')
      return
    }
    setNameErrorKey(null)
    await updateLanguage(language.langCode, { value: nextValue, emoji })
    setEditing(false)
  }

  const handleCancel = () => {
    setValue(language.value)
    setEmoji(language.emoji)
    setNameErrorKey(null)
    setEditing(false)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void handleSave()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      handleCancel()
    }
  }

  if (!editing) {
    return (
      <>
        <div className="group flex items-center gap-2 rounded-lg px-2 py-1.25 transition-colors hover:bg-muted/30">
          <span className="min-w-0 flex-1 truncate text-foreground text-sm">{language.value}</span>
          <span className="shrink-0 font-mono text-foreground-muted text-xs">{language.langCode}</span>
          <IconButton
            size="xs"
            onClick={() => setEditing(true)}
            aria-label={t('common.edit')}
            className="text-foreground-muted/70 opacity-0 transition-opacity hover:bg-transparent group-hover:opacity-100">
            <PenLine size={10} />
          </IconButton>
          <IconButton
            size="xs"
            tone="destructive"
            onClick={() => setConfirmOpen(true)}
            aria-label={t('common.delete')}
            className="text-foreground-muted/70 opacity-0 transition-opacity hover:bg-transparent group-hover:opacity-100">
            <X size={10} />
          </IconButton>
        </div>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t('settings.translate.custom.delete.title')}
          description={t('settings.translate.custom.delete.description')}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          destructive
          onConfirm={() => deleteLanguage(language.langCode)}
        />
      </>
    )
  }

  return (
    <div className="space-y-3 rounded-lg bg-muted/20 p-3" onKeyDown={handleKeyDown}>
      <Field>
        <FieldLabel htmlFor={nameId} className={customLanguageFieldSubtitleClassName}>
          {t('settings.translate.custom.value.label')}
        </FieldLabel>
        <InputGroup data-invalid={nameErrorKey ? true : undefined}>
          <InputGroupAddon align="inline-start">
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </InputGroupAddon>
          <InputGroupInput
            id={nameId}
            value={value}
            autoFocus
            onChange={(e) => {
              setValue(e.target.value)
              if (nameErrorKey) setNameErrorKey(null)
            }}
          />
        </InputGroup>
        {nameErrorKey && <FieldDescription className="text-destructive">{t(nameErrorKey)}</FieldDescription>}
      </Field>
      <Field>
        <FieldLabel htmlFor={codeId} className={customLanguageFieldSubtitleClassName}>
          {t('settings.translate.custom.langCode.label')}
        </FieldLabel>
        <Input id={codeId} value={language.langCode} disabled />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="button" variant="default" size="sm" onClick={() => void handleSave()}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  )
}

const EmojiPicker: FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <InputGroupButton
          type="button"
          variant="ghost"
          size="xs"
          aria-label={value}
          className={cn('h-6 gap-1 rounded-md px-1.5 text-xs', open && 'bg-accent text-accent-foreground')}>
          <span className="leading-none">{value}</span>
          <ChevronDown className={cn('size-2.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </InputGroupButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-36 rounded-md border border-border bg-popover p-1 shadow-xl">
        <div className="grid grid-cols-4 gap-1">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onChange(emoji)
                setOpen(false)
              }}
              className={cn(
                'flex h-7 items-center justify-center rounded-md text-sm transition-colors hover:bg-accent',
                emoji === value && 'bg-accent'
              )}>
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export const TranslateSettingsPanelContent: FC = () => <TranslateSettingsCoreContent />

export default memo(TranslateSettings)
