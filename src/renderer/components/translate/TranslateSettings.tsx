import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  HelpTooltip,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
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
import { ModelSelector } from '@renderer/components/ModelSelector'
import { useLanguages, useTranslateGlossary, useTranslateLanguages } from '@renderer/hooks/translate'
import { useModels } from '@renderer/hooks/useModel'
import { toast } from '@renderer/services/toast'
import { cn } from '@renderer/utils/style'
import {
  normalizeEditedTranslateFontSize,
  normalizePersistedTranslateFontSize,
  UNKNOWN_LANG_CODE
} from '@renderer/utils/translate'
import { POLISH_PROMPT, TRANSLATE_PROMPT } from '@shared/ai/prompts'
import type {
  AutoDetectionMethod,
  PersistedLangCode,
  TranslateBidirectionalPair,
  TranslateCustomParameters,
  TranslateRegexReplacementRule
} from '@shared/data/preference/preferenceTypes'
import { parsePersistedLangCode, PersistedLangCodeSchema } from '@shared/data/preference/preferenceTypes'
import { BUILTIN_TRANSLATE_LANGUAGES } from '@shared/data/presets/translateLanguages'
import { isUniqueModelId, type UniqueModelId } from '@shared/data/types/model'
import type { TranslateGlossaryEntry, TranslateLanguage } from '@shared/data/types/translate'
import { isNonChatModel } from '@shared/utils/model'
import { hasTranslateReasoningOverride } from '@shared/utils/translateRequestOptions'
import { ArrowLeftRight, ChevronDown, PenLine, Plus, X } from 'lucide-react'
import type { FC, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import IconButton from './IconButton'
import LanguagePicker from './LanguagePicker'

type Props = {
  visible: boolean
  onClose: () => void
}

const BUILTIN_LANG_CODES = new Set<string>(BUILTIN_TRANSLATE_LANGUAGES.map((lang) => lang.langCode))
const EMOJI_OPTIONS = ['🌐', '🇺🇸', '🇬🇧', '🇨🇳', '🇯🇵', '🇰🇷', '🇫🇷', '🇩🇪', '🇪🇸', '🇵🇹', '🇮🇳', '🇧🇷']
const logger = loggerService.withContext('TranslateSettings')
const settingsCardClassName = 'min-w-0 rounded-lg border border-border-subtle bg-background/40 p-3.5 shadow-xs'

const TranslateSettings: FC<Props> = ({ visible, onClose }) => {
  const { t } = useTranslation()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [bidirectionalPair, setBidirectionalPair] = usePreference('feature.translate.page.bidirectional_pair')
  const [enableMarkdown, setEnableMarkdown] = usePreference('feature.translate.page.enable_markdown')
  const [autoCopy, setAutoCopy] = usePreference('feature.translate.page.auto_copy')
  const [autoDetectionMethod, setAutoDetectionMethod] = usePreference('feature.translate.auto_detection_method')
  const [isScrollSyncEnabled, setIsScrollSyncEnabled] = usePreference('feature.translate.page.scroll_sync')
  const [isBidirectional, setIsBidirectional] = usePreference('feature.translate.page.bidirectional_enabled')
  const [fontSize, setFontSize] = usePreference('feature.translate.page.font_size')
  const [jsonStructureView, setJsonStructureView] = usePreference('feature.translate.page.json_structure_view')
  const [jsonCopySeparator, setJsonCopySeparator] = usePreference(
    'feature.translate.page.json_structure_copy_separator'
  )
  const [jsonCopyBlankLine, setJsonCopyBlankLine] = usePreference(
    'feature.translate.page.json_structure_copy_blank_line'
  )
  const [englishStraightQuotes, setEnglishStraightQuotes] = usePreference(
    'feature.translate.post_processing.english_straight_quotes'
  )
  const [zhSmartQuotes, setZhSmartQuotes] = usePreference('feature.translate.post_processing.zh_smart_quotes')
  const [zhTextSpacing, setZhTextSpacing] = usePreference('feature.translate.post_processing.zh_text_spacing')

  useEffect(() => {
    if (!visible) setShowAdvanced(false)
  }, [visible])

  const safePersist = useCallback(
    async (persistPromise: Promise<unknown>, actionName: string) => {
      try {
        await persistPromise
      } catch (error) {
        logger.error(`Failed to persist ${actionName}`, error as Error)
        toast.error(t('common.save_failed'))
      }
    },
    [t]
  )

  const updateBidirectionalPair = useCallback(
    (next: TranslateBidirectionalPair) => {
      if (next[0] === next[1]) {
        toast.warning(t('translate.language.same'))
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
      value: 'heuristic',
      label: t('translate.detect.method.heuristic.label'),
      tip: t('translate.detect.method.heuristic.tip')
    },
    {
      value: 'llm',
      label: t('translate.detect.method.llm.label'),
      tip: t('translate.detect.method.llm.tip')
    }
  ]

  return (
    <>
      <Dialog open={visible && !showAdvanced} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          size="xl"
          motion="fade-scale"
          aria-describedby={undefined}
          className="flex h-[min(826px,calc(100vh-2rem))] max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[960px]">
          <DialogHeader className="shrink-0 border-border-subtle border-b px-4 py-4 sm:px-5">
            <DialogTitle>{t('translate.settings.title')}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="grid items-start gap-4 min-[701px]:grid-cols-2 min-[701px]:[grid-template-areas:'model_language'_'model_display'_'misc_post'_'json_post']">
              <div className="contents">
                <TranslateModelSettings
                  safePersist={safePersist}
                  className={cn(
                    settingsCardClassName,
                    'order-1 min-h-[416px] max-[700px]:min-h-0 min-[701px]:[grid-area:model]'
                  )}
                />

                <PageSidePanelSection
                  title={t('translate.settings.group_misc')}
                  className={cn(
                    settingsCardClassName,
                    'order-4 min-h-[74px] max-[700px]:min-h-0 min-[701px]:[grid-area:misc]'
                  )}>
                  <div className="flex flex-col gap-4">
                    {toggleItems
                      .filter((item) => item.key === 'autoCopy')
                      .map((item) => (
                        <PageSidePanelItem
                          key={item.key}
                          title={item.label}
                          action={<Switch size="sm" checked={item.value} onCheckedChange={item.onChange} />}
                        />
                      ))}
                  </div>
                </PageSidePanelSection>

                <PageSidePanelSection
                  title={
                    <span className="flex items-center gap-1">
                      <span>{t('translate.settings.group_json_view')}</span>
                      <HelpTooltip
                        content={t('translate.settings.json_structure_view.tip')}
                        iconProps={{ className: 'text-foreground-tertiary' }}
                      />
                    </span>
                  }
                  className={cn(
                    settingsCardClassName,
                    'order-5 min-h-[156px] max-[700px]:min-h-0 min-[701px]:[grid-area:json]'
                  )}>
                  <div className="flex flex-col gap-4">
                    <PageSidePanelItem
                      title={t('translate.settings.json_structure_view.label')}
                      action={
                        <Switch
                          size="sm"
                          checked={jsonStructureView}
                          onCheckedChange={(value) =>
                            void safePersist(setJsonStructureView(value), 'translate JSON structure view')
                          }
                        />
                      }
                    />
                    <PageSidePanelItem
                      title={t('translate.settings.json_structure_view.copy_separator.label')}
                      action={
                        <select
                          disabled={!jsonStructureView}
                          value={jsonCopySeparator}
                          aria-label={t('translate.settings.json_structure_view.copy_separator.label')}
                          className="h-8 w-[180px] rounded-md border border-input bg-background px-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          onChange={(event) =>
                            void safePersist(
                              setJsonCopySeparator(event.target.value as typeof jsonCopySeparator),
                              'translate JSON copy separator'
                            )
                          }>
                          <option value="colon-space">
                            {t('translate.settings.json_structure_view.copy_separator.colon_space')}
                          </option>
                          <option value="colon-newline">
                            {t('translate.settings.json_structure_view.copy_separator.colon_newline')}
                          </option>
                          <option value="chinese-colon">
                            {t('translate.settings.json_structure_view.copy_separator.chinese_colon')}
                          </option>
                          <option value="chinese-colon-newline">
                            {t('translate.settings.json_structure_view.copy_separator.chinese_colon_newline')}
                          </option>
                        </select>
                      }
                    />
                    <PageSidePanelItem
                      title={t('translate.settings.json_structure_view.copy_blank_line_between_rows')}
                      action={
                        <Switch
                          size="sm"
                          disabled={!jsonStructureView}
                          checked={jsonCopyBlankLine}
                          onCheckedChange={(value) =>
                            void safePersist(setJsonCopyBlankLine(value), 'translate JSON copy blank line')
                          }
                        />
                      }
                    />
                  </div>
                </PageSidePanelSection>
              </div>

              <div className="contents">
                <PageSidePanelSection
                  title={t('translate.settings.group_language')}
                  className={cn(
                    settingsCardClassName,
                    'order-3 min-h-[210px] max-[700px]:min-h-0 min-[701px]:[grid-area:language]'
                  )}>
                  <div className="flex flex-col gap-4">
                    <PageSidePanelItem
                      className="max-[899px]:[&>div:first-child>div:last-child]:w-full max-[899px]:[&>div:first-child]:flex-col max-[899px]:[&>div:first-child]:items-stretch"
                      title={
                        <span className="flex items-center gap-1">
                          <span>{t('translate.detect.method.label')}</span>
                          <HelpTooltip
                            content={t('translate.detect.method.tip')}
                            iconProps={{ className: 'text-foreground-tertiary' }}
                          />
                        </span>
                      }
                      action={
                        <SegmentedControl<AutoDetectionMethod>
                          size="sm"
                          aria-label={t('translate.detect.method.label')}
                          value={autoDetectionMethod}
                          className="grid w-full max-w-[260px] grid-cols-4 rounded-xl"
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
                            iconProps={{ className: 'text-foreground-tertiary' }}
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
                          <div className="min-w-0 flex-1">
                            <LanguagePicker
                              value={bidirectionalPair[0]}
                              onChange={(value) => updateBidirectionalPair([value, bidirectionalPair[1]])}
                            />
                          </div>
                          <ArrowLeftRight size={12} className="shrink-0 text-foreground-tertiary" />
                          <div className="min-w-0 flex-1">
                            <LanguagePicker
                              value={bidirectionalPair[1]}
                              onChange={(value) => updateBidirectionalPair([bidirectionalPair[0], value])}
                            />
                          </div>
                        </div>
                      )}
                    </PageSidePanelItem>
                  </div>
                </PageSidePanelSection>

                <PageSidePanelSection
                  title={t('translate.settings.group_display')}
                  className={cn(
                    settingsCardClassName,
                    'order-2 min-h-[190px] max-[700px]:min-h-0 min-[701px]:[grid-area:display]'
                  )}>
                  <div className="flex flex-col gap-4">
                    {toggleItems
                      .filter((item) => item.key !== 'autoCopy')
                      .map((item) => (
                        <PageSidePanelItem
                          key={item.key}
                          title={item.label}
                          action={<Switch size="sm" checked={item.value} onCheckedChange={item.onChange} />}
                        />
                      ))}
                    <PageSidePanelItem
                      title={t('translate.settings.font_size')}
                      action={
                        <Input
                          type="number"
                          min={12}
                          max={24}
                          step={1}
                          value={normalizePersistedTranslateFontSize(fontSize)}
                          aria-label={t('translate.settings.font_size')}
                          className="w-20"
                          onChange={(event) => {
                            const value = normalizeEditedTranslateFontSize(event.target.value)
                            void safePersist(setFontSize(value), 'translate font size')
                          }}
                        />
                      }
                    />
                  </div>
                </PageSidePanelSection>

                <PageSidePanelSection
                  title={t('translate.settings.group_post_processing')}
                  className={cn(
                    settingsCardClassName,
                    'order-6 min-h-[246px] max-[700px]:min-h-0 min-[701px]:[grid-area:post]'
                  )}>
                  <div className="flex flex-col gap-4">
                    {[
                      [
                        t('translate.post_processing.english_straight_quotes'),
                        englishStraightQuotes,
                        setEnglishStraightQuotes
                      ],
                      [t('translate.post_processing.zh_smart_quotes'), zhSmartQuotes, setZhSmartQuotes],
                      [t('translate.post_processing.zh_text_spacing'), zhTextSpacing, setZhTextSpacing]
                    ].map(([label, checked, setter]) => (
                      <PageSidePanelItem
                        key={String(label)}
                        title={String(label)}
                        action={
                          <Switch
                            size="sm"
                            checked={Boolean(checked)}
                            onCheckedChange={(value) =>
                              void safePersist((setter as (value: boolean) => Promise<unknown>)(value), String(label))
                            }
                          />
                        }
                      />
                    ))}
                  </div>
                </PageSidePanelSection>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-4 h-8 w-full shrink-0"
              onClick={() => setShowAdvanced(true)}>
              {t('settings.moresetting.label')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={visible && showAdvanced} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          size="xl"
          motion="fade-scale"
          aria-describedby={undefined}
          className="flex h-[min(820px,calc(100vh-4rem))] max-h-[calc(100vh-4rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[80vw]">
          <DialogHeader className="shrink-0 border-border-subtle border-b px-4 py-4 sm:px-5">
            <DialogTitle>{t('translate.settings.title')}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <TranslateSettingsCoreContent cardClassName={settingsCardClassName} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

const TranslateModelSettings: FC<{
  safePersist: (persistPromise: Promise<unknown>, actionName: string) => Promise<void>
  className?: string
}> = ({ safePersist, className }) => {
  const { t } = useTranslation()
  const [globalModelId, setGlobalModelId] = usePreference('feature.translate.model_id')
  const [nativeToOtherId, setNativeToOtherId] = usePreference('feature.translate.model.native_to_other_id')
  const [nativeFollowsGlobal, setNativeFollowsGlobal] = usePreference(
    'feature.translate.model.native_to_other_follows_global'
  )
  const [otherToNativeId, setOtherToNativeId] = usePreference('feature.translate.model.other_to_native_id')
  const [otherFollowsGlobal, setOtherFollowsGlobal] = usePreference(
    'feature.translate.model.other_to_native_follows_global'
  )
  const [polishModelId, setPolishModelId] = usePreference('feature.translate.model.polish_id')
  const { models } = useModels()
  const modelsById = useMemo(() => new Map(models.map((model) => [model.id, model])), [models])

  const fields: Array<{
    key: string
    label: string
    value: string | null
    setter: (value: UniqueModelId | null) => Promise<unknown>
    follows?: { value: boolean; setter: (value: boolean) => Promise<unknown> }
  }> = [
    {
      key: 'global',
      label: t('translate.settings.global_translate_model'),
      value: globalModelId,
      setter: setGlobalModelId
    },
    {
      key: 'native-to-other',
      label: t('translate.settings.native_to_other_model'),
      value: nativeToOtherId,
      setter: setNativeToOtherId,
      follows: { value: nativeFollowsGlobal, setter: setNativeFollowsGlobal }
    },
    {
      key: 'other-to-native',
      label: t('translate.settings.other_to_native_model'),
      value: otherToNativeId,
      setter: setOtherToNativeId,
      follows: { value: otherFollowsGlobal, setter: setOtherFollowsGlobal }
    },
    {
      key: 'polish',
      label: t('translate.settings.polish_model'),
      value: polishModelId,
      setter: setPolishModelId
    }
  ]

  return (
    <PageSidePanelSection title={t('translate.settings.group_model')} className={className}>
      <div className="flex flex-col gap-4">
        {fields.map((field) => {
          const followsGlobal = field.follows?.value === true
          const selectedModel = field.value ? modelsById.get(field.value as UniqueModelId) : undefined
          return (
            <PageSidePanelItem
              key={field.key}
              title={field.label}
              action={
                field.follows ? (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      {t('translate.settings.follow_global_models')}
                    </span>
                    <Switch
                      size="sm"
                      checked={field.follows.value}
                      onCheckedChange={(value) =>
                        void safePersist(field.follows!.setter(value), `${field.key} follows global`)
                      }
                    />
                  </div>
                ) : undefined
              }>
              {!followsGlobal && (
                <ModelSelector
                  multiple={false}
                  selectionType="id"
                  value={field.value && isUniqueModelId(field.value) ? field.value : undefined}
                  onSelect={(value) => void safePersist(field.setter(value ?? null), field.key)}
                  filter={(model) => !isNonChatModel(model)}
                  showPinnedModels
                  showTagFilter={false}
                  trigger={
                    <Button type="button" variant="outline" size="sm" className="w-full justify-between gap-2">
                      <span className="truncate">
                        {selectedModel?.name ?? field.value ?? t('translate.settings.model_placeholder')}
                      </span>
                      <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                    </Button>
                  }
                />
              )}
            </PageSidePanelItem>
          )
        })}
      </div>
    </PageSidePanelSection>
  )
}

type PersistPreference = (persistPromise: Promise<unknown>, actionName: string) => Promise<void>

const defaultPersist: PersistPreference = async (persistPromise) => {
  try {
    await persistPromise
  } catch (error) {
    logger.error('Failed to persist translate setting', error as Error)
    toast.error('Failed to save')
  }
}

const TranslateRequestSettings: FC<{ safePersist?: PersistPreference; className?: string }> = ({
  safePersist = defaultPersist,
  className
}) => {
  const { t } = useTranslation()
  const [translateParams, setTranslateParams] = usePreference('feature.translate.request.custom_parameters')
  const [polishParams, setPolishParams] = usePreference('feature.translate.request.polish_custom_parameters')
  const [translateAutoDisable, setTranslateAutoDisable] = usePreference(
    'feature.translate.reasoning.translate_auto_disable'
  )
  const [polishAutoDisable, setPolishAutoDisable] = usePreference('feature.translate.reasoning.polish_auto_disable')

  const scopes = [
    {
      key: 'translate',
      title: t('translate.settings.custom_body.translate'),
      parameters: translateParams,
      setParameters: setTranslateParams,
      autoDisable: translateAutoDisable,
      setAutoDisable: setTranslateAutoDisable
    },
    {
      key: 'polish',
      title: t('translate.settings.custom_body.polish'),
      parameters: polishParams,
      setParameters: setPolishParams,
      autoDisable: polishAutoDisable,
      setAutoDisable: setPolishAutoDisable
    }
  ] as const

  return (
    <PageSidePanelSection title={t('translate.settings.custom_body.title')} className={className}>
      <div className="flex flex-col gap-6">
        {scopes.map((scope) => (
          <div key={scope.key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{scope.title}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void safePersist(
                    scope.setParameters([...scope.parameters, { name: '', type: 'string', value: '' }]),
                    `${scope.key} custom parameter`
                  )
                }>
                <Plus size={13} />
                {t('translate.settings.custom_body.add_parameter')}
              </Button>
            </div>
            {scope.parameters.map((parameter, index) => (
              <CustomParameterRow
                key={`${scope.key}-${index}`}
                parameter={parameter}
                onChange={(next) => {
                  const parameters = [...scope.parameters]
                  parameters[index] = next
                  void safePersist(scope.setParameters(parameters), `${scope.key} custom parameter`)
                }}
                onRemove={() =>
                  void safePersist(
                    scope.setParameters(scope.parameters.filter((_, current) => current !== index)),
                    `${scope.key} custom parameter`
                  )
                }
              />
            ))}
            {hasTranslateReasoningOverride(scope.parameters) && (
              <div role="note" className="rounded-md bg-muted px-3 py-2 text-muted-foreground text-xs">
                {t('translate.settings.custom_body.reasoning_override')}
              </div>
            )}
            <PageSidePanelItem
              title={t('translate.settings.minimize_thinking.label')}
              description={t('translate.settings.minimize_thinking.tip')}
              action={
                <Switch
                  size="sm"
                  checked={scope.autoDisable}
                  onCheckedChange={(value) =>
                    void safePersist(scope.setAutoDisable(value), `${scope.key} auto-disable reasoning`)
                  }
                />
              }
            />
          </div>
        ))}
      </div>
    </PageSidePanelSection>
  )
}

const CustomParameterRow: FC<{
  parameter: TranslateCustomParameters[number]
  onChange: (parameter: TranslateCustomParameters[number]) => void
  onRemove: () => void
}> = ({ parameter, onChange, onRemove }) => {
  const setType = (type: TranslateCustomParameters[number]['type']) => {
    if (type === 'number') onChange({ name: parameter.name, type, value: 0 })
    else if (type === 'boolean') onChange({ name: parameter.name, type, value: false })
    else onChange({ name: parameter.name, type, value: '' })
  }

  const valueText =
    parameter.type === 'json'
      ? typeof parameter.value === 'string'
        ? parameter.value
        : JSON.stringify(parameter.value, null, 2)
      : String(parameter.value)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)_2rem] gap-2">
      <Input
        value={parameter.name}
        aria-label="Parameter name"
        onChange={(event) => onChange({ ...parameter, name: event.target.value })}
      />
      <select
        value={parameter.type}
        aria-label="Parameter type"
        className="rounded-md border border-border bg-background px-2 text-sm"
        onChange={(event) => setType(event.target.value as TranslateCustomParameters[number]['type'])}>
        {['string', 'number', 'boolean', 'json'].map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      {parameter.type === 'boolean' ? (
        <Switch
          checked={parameter.value}
          onCheckedChange={(value) => onChange({ name: parameter.name, type: 'boolean', value })}
        />
      ) : (
        <Input
          type={parameter.type === 'number' ? 'number' : 'text'}
          value={valueText}
          aria-label="Parameter value"
          onChange={(event) => {
            if (parameter.type === 'number') {
              onChange({ name: parameter.name, type: 'number', value: Number(event.target.value) || 0 })
            } else if (parameter.type === 'json') {
              onChange({ name: parameter.name, type: 'json', value: event.target.value })
            } else {
              onChange({ name: parameter.name, type: 'string', value: event.target.value })
            }
          }}
        />
      )}
      <IconButton size="xs" tone="destructive" aria-label="Remove parameter" onClick={onRemove}>
        <X size={11} />
      </IconButton>
    </div>
  )
}

const RegexRulesSettings: FC<{ safePersist?: PersistPreference; className?: string }> = ({
  safePersist = defaultPersist,
  className
}) => {
  const { t } = useTranslation()
  const [rules, setRules] = usePreference('feature.translate.post_processing.regex_rules')

  const save = (next: TranslateRegexReplacementRule[]) =>
    safePersist(setRules(next), 'translate regex replacement rules')

  return (
    <PageSidePanelSection
      title={t('translate.settings.regex_rules.title')}
      className={className}
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            void save([
              ...rules,
              { id: `regex-${Date.now()}-${rules.length}`, pattern: '', flags: 'g', replacement: '', enabled: true }
            ])
          }>
          <Plus size={13} />
          {t('common.add')}
        </Button>
      }>
      <div className="flex flex-col gap-2">
        {rules.map((rule, index) => {
          const update = (changes: Partial<TranslateRegexReplacementRule>) => {
            const next = [...rules]
            next[index] = { ...rule, ...changes }
            void save(next)
          }
          return (
            <div key={rule.id} className="grid grid-cols-[auto_minmax(0,1fr)_5rem_minmax(0,1fr)_2rem] gap-2">
              <Switch checked={rule.enabled !== false} onCheckedChange={(enabled) => update({ enabled })} />
              <Input
                value={rule.pattern}
                aria-label="Regex pattern"
                onChange={(e) => update({ pattern: e.target.value })}
              />
              <Input value={rule.flags} aria-label="Regex flags" onChange={(e) => update({ flags: e.target.value })} />
              <Input
                value={rule.replacement}
                aria-label="Regex replacement"
                onChange={(e) => update({ replacement: e.target.value })}
              />
              <IconButton
                size="xs"
                tone="destructive"
                aria-label="Remove regex rule"
                onClick={() => void save(rules.filter((_, current) => current !== index))}>
                <X size={11} />
              </IconButton>
            </div>
          )
        })}
      </div>
    </PageSidePanelSection>
  )
}

const TranslateSettingsCoreContent: FC<{ cardClassName?: string; includeCustomLanguages?: boolean }> = ({
  cardClassName,
  includeCustomLanguages = false
}) => {
  return (
    <div className="flex flex-col gap-5">
      <TranslatePromptField className={cardClassName} />
      <GlossarySettings className={cardClassName} />
      <RegexRulesSettings className={cardClassName} />
      <TranslateRequestSettings className={cardClassName} />
      {includeCustomLanguages && <CustomLanguageList className={cardClassName} />}
    </div>
  )
}

const TranslatePromptField: FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation()
  const [persisted, setPersisted] = usePreference('feature.translate.prompt.native_to_other')
  const [, setLegacyPrompt] = usePreference('feature.translate.model_prompt')
  const legacySetterRef = useRef(setLegacyPrompt)
  legacySetterRef.current = setLegacyPrompt
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
      toast.error(saveFailedMessageRef.current || 'Failed to save')
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
        void safePersist(
          Promise.all([setPersisted(savedValue), legacySetterRef.current(savedValue)]),
          'native-to-other translate prompt'
        )
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
        void safePersist(
          Promise.all([setPersisted(pendingRef.current), legacySetterRef.current(pendingRef.current)]),
          'native-to-other translate prompt'
        )
      }
    },
    [clearSaveTimer, safePersist, setPersisted]
  )

  const isDefault = local === TRANSLATE_PROMPT
  const onReset = () => {
    clearSaveTimer()
    pendingRef.current = null
    setLocal(TRANSLATE_PROMPT)
    void safePersist(
      Promise.all([setPersisted(TRANSLATE_PROMPT), legacySetterRef.current(TRANSLATE_PROMPT)]),
      'native-to-other translate prompt'
    )
  }

  return (
    <div className={cn('grid gap-4 lg:grid-cols-2', className)}>
      <AdditionalPromptField
        preferenceKey="feature.translate.prompt.other_to_native"
        titleKey="translate.settings.prompt.other_to_native"
        defaultValue={TRANSLATE_PROMPT}
      />
      <PageSidePanelSection
        title={t('translate.settings.prompt.native_to_other')}
        actions={
          !isDefault && (
            <button
              type="button"
              onClick={onReset}
              className="rounded-md text-muted-foreground text-xs transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:underline focus-visible:outline-none">
              {t('common.reset')}
            </button>
          )
        }>
        <textarea
          value={local}
          aria-label={t('translate.settings.prompt.native_to_other')}
          onChange={(e) => schedulePersist(e.target.value)}
          className="min-h-30 w-full resize-y rounded-md border border-border-subtle bg-muted/40 p-3 text-muted-foreground text-sm leading-relaxed outline-none transition-colors focus:border-ring"
        />
      </PageSidePanelSection>
      <AdditionalPromptField
        preferenceKey="feature.translate.prompt.polish"
        titleKey="translate.settings.prompt.polish"
        defaultValue={POLISH_PROMPT}
        className="lg:col-span-2"
      />
    </div>
  )
}

const AdditionalPromptField: FC<{
  preferenceKey: 'feature.translate.prompt.other_to_native' | 'feature.translate.prompt.polish'
  titleKey: string
  defaultValue: string
  className?: string
}> = ({ preferenceKey, titleKey, defaultValue, className }) => {
  const { t } = useTranslation()
  const [persisted, setPersisted] = usePreference(preferenceKey)
  const [local, setLocal] = useState(persisted)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<string | null>(null)

  useEffect(() => {
    if (pendingRef.current === null || pendingRef.current === persisted) setLocal(persisted)
  }, [persisted])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (pendingRef.current !== null) void setPersisted(pendingRef.current)
    },
    [setPersisted]
  )

  const schedule = (value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    pendingRef.current = value
    setLocal(value)
    timerRef.current = setTimeout(() => {
      const next = pendingRef.current
      pendingRef.current = null
      timerRef.current = null
      if (next !== null) void setPersisted(next)
    }, 400)
  }

  return (
    <PageSidePanelSection
      className={className}
      title={t(titleKey)}
      actions={
        local !== defaultValue && (
          <button type="button" className="text-muted-foreground text-xs" onClick={() => schedule(defaultValue)}>
            {t('common.reset')}
          </button>
        )
      }>
      <textarea
        value={local}
        aria-label={t(titleKey)}
        onChange={(event) => schedule(event.target.value)}
        className="min-h-30 w-full resize-y rounded-md border border-border-subtle bg-muted/40 p-3 text-muted-foreground text-sm leading-relaxed outline-none transition-colors focus:border-ring"
      />
    </PageSidePanelSection>
  )
}

const CustomLanguageList: FC<{ className?: string }> = ({ className }) => {
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
      className={className}
      actions={
        customLanguages.length > 0 && (
          <span className="text-foreground-tertiary text-xs">{t('code.count', { count: customLanguages.length })}</span>
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

const GlossarySettings: FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation()
  const { languages } = useLanguages()
  const { entries, create, update, remove } = useTranslateGlossary()
  const [isAdding, setIsAdding] = useState(false)
  const [page, setPage] = useState(1)
  const [sourcePhrase, setSourcePhrase] = useState('')
  const [targetPhrase, setTargetPhrase] = useState('')
  const defaultLanguage = useMemo(
    () =>
      languages?.find((language) => language.langCode !== UNKNOWN_LANG_CODE)?.langCode ??
      parsePersistedLangCode('zh-cn'),
    [languages]
  )
  const [targetLanguage, setTargetLanguage] = useState<PersistedLangCode>(defaultLanguage)
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize))
  const visibleEntries = entries.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  useEffect(() => {
    if (!isAdding) setTargetLanguage(defaultLanguage)
  }, [defaultLanguage, isAdding])

  const resetForm = () => {
    setSourcePhrase('')
    setTargetPhrase('')
    setTargetLanguage(defaultLanguage)
    setIsAdding(false)
  }

  const handleCreate = async () => {
    const source = sourcePhrase.trim()
    const target = targetPhrase.trim()
    if (!source || !target) {
      toast.warning(t('settings.translate.glossary.error.required'))
      return
    }
    try {
      await create({ sourcePhrase: source, targetPhrase: target, targetLanguage })
      resetForm()
    } catch (error) {
      logger.error('Failed to create translate glossary entry', error as Error)
      toast.error(t('settings.translate.glossary.error.add'))
    }
  }

  return (
    <PageSidePanelSection
      title={t('settings.translate.glossary.title')}
      className={className}
      actions={
        !isAdding && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(true)}>
            <Plus size={13} />
            {t('common.add')}
          </Button>
        )
      }>
      <p className="mb-2 text-muted-foreground text-xs">{t('settings.translate.glossary.hint')}</p>
      <div className="overflow-hidden rounded-md border border-border-subtle">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_5rem_4.5rem] gap-3 bg-muted/30 px-3 py-2 font-medium text-xs">
          <span>{t('settings.translate.glossary.source')}</span>
          <span>{t('settings.translate.glossary.target')}</span>
          <span>{t('translate.target_language')}</span>
          <span className="text-center">{t('common.enabled')}</span>
          <span className="text-center">{t('settings.translate.glossary.action')}</span>
        </div>
        {visibleEntries.map((entry) => {
          const language = languages?.find((item) => item.langCode === entry.targetLanguage)
          return (
            <GlossaryRow
              key={entry.id}
              entry={entry}
              targetLanguageLabel={language ? `${language.emoji} ${language.value}` : entry.targetLanguage}
              onUpdate={update}
              onRemove={remove}
            />
          )
        })}
        {entries.length === 0 && !isAdding && (
          <p className="border-border-subtle border-t px-2 py-6 text-center text-muted-foreground text-sm">
            {t('common.no_results')}
          </p>
        )}
        {isAdding && (
          <div className="space-y-3 border-border-subtle border-t bg-muted/20 p-3">
            <Input
              value={sourcePhrase}
              aria-label={t('settings.translate.glossary.source')}
              placeholder={t('settings.translate.glossary.source_placeholder')}
              onChange={(event) => setSourcePhrase(event.target.value)}
            />
            <Input
              value={targetPhrase}
              aria-label={t('settings.translate.glossary.target')}
              placeholder={t('settings.translate.glossary.target_placeholder')}
              onChange={(event) => setTargetPhrase(event.target.value)}
            />
            <LanguagePicker
              value={targetLanguage}
              onChange={(value) => setTargetLanguage(parsePersistedLangCode(value))}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                {t('common.cancel')}
              </Button>
              <Button type="button" size="sm" onClick={() => void handleCreate()}>
                {t('common.add')}
              </Button>
            </div>
          </div>
        )}
      </div>
      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
            ‹
          </Button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
            <Button
              key={pageNumber}
              type="button"
              variant={pageNumber === page ? 'outline' : 'ghost'}
              size="icon-sm"
              onClick={() => setPage(pageNumber)}>
              {pageNumber}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={page === pageCount}
            onClick={() => setPage(page + 1)}>
            ›
          </Button>
        </div>
      )}
    </PageSidePanelSection>
  )
}

const GlossaryRow: FC<{
  entry: TranslateGlossaryEntry
  targetLanguageLabel: string
  onUpdate: (
    id: string,
    data: Partial<Pick<TranslateGlossaryEntry, 'sourcePhrase' | 'targetPhrase' | 'targetLanguage' | 'enabled'>>
  ) => Promise<unknown>
  onRemove: (id: string) => Promise<unknown>
}> = ({ entry, targetLanguageLabel, onUpdate, onRemove }) => {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [sourcePhrase, setSourcePhrase] = useState(entry.sourcePhrase)
  const [targetPhrase, setTargetPhrase] = useState(entry.targetPhrase)
  const [targetLanguage, setTargetLanguage] = useState(entry.targetLanguage)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const save = async () => {
    if (!sourcePhrase.trim() || !targetPhrase.trim()) return
    await onUpdate(entry.id, {
      sourcePhrase: sourcePhrase.trim(),
      targetPhrase: targetPhrase.trim(),
      targetLanguage
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="space-y-2 border-border-subtle border-t bg-muted/20 p-3">
        <Input value={sourcePhrase} onChange={(event) => setSourcePhrase(event.target.value)} />
        <Input value={targetPhrase} onChange={(event) => setTargetPhrase(event.target.value)} />
        <LanguagePicker value={targetLanguage} onChange={(value) => setTargetLanguage(parsePersistedLangCode(value))} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" size="sm" onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_5rem_4.5rem] items-center gap-3 border-border-subtle border-t px-3 py-2 text-sm hover:bg-muted/20">
      <span className="truncate">{entry.sourcePhrase}</span>
      <span className="truncate">{entry.targetPhrase}</span>
      <span className="truncate text-xs">{targetLanguageLabel}</span>
      <span className="flex justify-center">
        <Switch size="sm" checked={entry.enabled} onCheckedChange={(enabled) => void onUpdate(entry.id, { enabled })} />
      </span>
      <span className="flex justify-center gap-1">
        <IconButton size="xs" onClick={() => setEditing(true)} aria-label={t('common.edit')}>
          <PenLine size={10} />
        </IconButton>
        <IconButton size="xs" tone="destructive" onClick={() => setConfirmOpen(true)} aria-label={t('common.delete')}>
          <X size={10} />
        </IconButton>
      </span>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('settings.translate.glossary.delete.title')}
        description={t('settings.translate.glossary.delete.description')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        destructive
        onConfirm={async () => {
          await onRemove(entry.id)
        }}
      />
    </div>
  )
}

type FormErrorField = 'name' | 'code'
type FormError = { field: FormErrorField; messageKey: string }
type ValidLanguageForm = { value: string; langCode: PersistedLangCode; emoji: string }
type LanguageFormValidation = { ok: false; error: FormError } | { ok: true; data: ValidLanguageForm }
const customLanguageFieldSubtitleClassName = 'text-xs font-medium leading-4 text-muted-foreground'

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
          <span className="shrink-0 font-mono text-foreground-tertiary text-xs">{language.langCode}</span>
          <IconButton
            size="xs"
            onClick={() => setEditing(true)}
            aria-label={t('common.edit')}
            className="text-muted-foreground opacity-0 transition-opacity hover:bg-transparent group-hover:opacity-100">
            <PenLine size={10} />
          </IconButton>
          <IconButton
            size="xs"
            tone="destructive"
            onClick={() => setConfirmOpen(true)}
            aria-label={t('common.delete')}
            className="text-muted-foreground opacity-0 transition-opacity hover:bg-transparent group-hover:opacity-100">
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

export const TranslateSettingsPanelContent: FC = () => <TranslateSettingsCoreContent includeCustomLanguages />

export default memo(TranslateSettings)
