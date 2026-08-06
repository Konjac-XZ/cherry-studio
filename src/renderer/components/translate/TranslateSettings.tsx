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
import { ModelSelector } from '@renderer/components/ModelSelector'
import { useLanguages, useTranslateGlossary, useTranslateLanguages } from '@renderer/hooks/translate'
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

const TranslateSettings: FC<Props> = ({ visible, onClose }) => {
  const { t } = useTranslation()
  const [bidirectionalPair, setBidirectionalPair] = usePreference('feature.translate.page.bidirectional_pair')
  const [enableMarkdown, setEnableMarkdown] = usePreference('feature.translate.page.enable_markdown')
  const [autoCopy, setAutoCopy] = usePreference('feature.translate.page.auto_copy')
  const [autoDetectionMethod, setAutoDetectionMethod] = usePreference('feature.translate.auto_detection_method')
  const [isScrollSyncEnabled, setIsScrollSyncEnabled] = usePreference('feature.translate.page.scroll_sync')
  const [isBidirectional, setIsBidirectional] = usePreference('feature.translate.page.bidirectional_enabled')
  const [nativeLanguage, setNativeLanguage] = usePreference('feature.translate.native_language')
  const [fontSize, setFontSize] = usePreference('feature.translate.page.font_size')
  const [layoutOverride, setLayoutOverride] = usePreference('feature.translate.page.layout_override')
  const [polishEnabled, setPolishEnabled] = usePreference('feature.translate.polish.enabled')
  const [jsonStructureView, setJsonStructureView] = usePreference('feature.translate.page.json_structure_view')
  const [jsonCopySeparator, setJsonCopySeparator] = usePreference(
    'feature.translate.page.json_structure_copy_separator'
  )
  const [jsonCopyBlankLine, setJsonCopyBlankLine] = usePreference(
    'feature.translate.page.json_structure_copy_blank_line'
  )
  const [postProcessingEnabled, setPostProcessingEnabled] = usePreference('feature.translate.post_processing.enabled')
  const [englishStraightQuotes, setEnglishStraightQuotes] = usePreference(
    'feature.translate.post_processing.english_straight_quotes'
  )
  const [zhSmartQuotes, setZhSmartQuotes] = usePreference('feature.translate.post_processing.zh_smart_quotes')
  const [zhTextSpacing, setZhTextSpacing] = usePreference('feature.translate.post_processing.zh_text_spacing')

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
                  iconProps={{ className: 'text-foreground-tertiary' }}
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
                <div className="flex-1">
                  <LanguagePicker
                    value={bidirectionalPair[0]}
                    onChange={(value) => updateBidirectionalPair([value, bidirectionalPair[1]])}
                  />
                </div>
                <ArrowLeftRight size={12} className="shrink-0 text-foreground-tertiary" />
                <div className="flex-1">
                  <LanguagePicker
                    value={bidirectionalPair[1]}
                    onChange={(value) => updateBidirectionalPair([bidirectionalPair[0], value])}
                  />
                </div>
              </div>
            )}
          </PageSidePanelItem>

          <PageSidePanelItem
            title={t('translate.settings.native_language')}
            action={
              <div className="w-48">
                <LanguagePicker
                  value={nativeLanguage ?? UNKNOWN_LANG_CODE}
                  onChange={(value) =>
                    void safePersist(
                      setNativeLanguage(value === UNKNOWN_LANG_CODE ? null : value),
                      'translate native language'
                    )
                  }
                />
              </div>
            }
          />

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

          <PageSidePanelItem
            title={t('translate.settings.layout.label')}
            action={
              <SegmentedControl
                size="sm"
                value={layoutOverride}
                onValueChange={(value) => void safePersist(setLayoutOverride(value), 'translate layout override')}
                options={[
                  { value: 'auto', label: t('translate.settings.layout.auto') },
                  { value: 'horizontal', label: t('translate.settings.layout.horizontal') },
                  { value: 'vertical', label: t('translate.settings.layout.vertical') }
                ]}
              />
            }
          />

          <PageSidePanelItem
            title={t('translate.settings.polish_enabled')}
            action={
              <Switch
                size="sm"
                checked={polishEnabled}
                onCheckedChange={(value) => void safePersist(setPolishEnabled(value), 'translate polish enabled')}
              />
            }
          />
        </div>

        <TranslateModelSettings safePersist={safePersist} />

        <PageSidePanelSection title={t('translate.settings.json_structure_view.label')}>
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
                <SegmentedControl
                  size="sm"
                  value={jsonCopySeparator}
                  onValueChange={(value) =>
                    void safePersist(setJsonCopySeparator(value), 'translate JSON copy separator')
                  }
                  options={[
                    {
                      value: 'colon-space',
                      label: t('translate.settings.json_structure_view.copy_separator.colon_space')
                    },
                    {
                      value: 'colon-newline',
                      label: t('translate.settings.json_structure_view.copy_separator.colon_newline')
                    },
                    {
                      value: 'chinese-colon',
                      label: t('translate.settings.json_structure_view.copy_separator.chinese_colon')
                    },
                    {
                      value: 'chinese-colon-newline',
                      label: t('translate.settings.json_structure_view.copy_separator.chinese_colon_newline')
                    }
                  ]}
                />
              }
            />
            <PageSidePanelItem
              title={t('translate.settings.json_structure_view.copy_blank_line_between_rows')}
              action={
                <Switch
                  size="sm"
                  disabled={!jsonStructureView}
                  checked={jsonStructureView && jsonCopyBlankLine}
                  onCheckedChange={(value) =>
                    void safePersist(setJsonCopyBlankLine(value), 'translate JSON copy blank line')
                  }
                />
              }
            />
          </div>
        </PageSidePanelSection>

        <PageSidePanelSection title={t('translate.settings.group_post_processing')}>
          <div className="flex flex-col gap-4">
            {[
              [t('translate.post_processing.enable'), postProcessingEnabled, setPostProcessingEnabled],
              [t('translate.post_processing.english_straight_quotes'), englishStraightQuotes, setEnglishStraightQuotes],
              [t('translate.post_processing.zh_smart_quotes'), zhSmartQuotes, setZhSmartQuotes],
              [t('translate.post_processing.zh_text_spacing'), zhTextSpacing, setZhTextSpacing]
            ].map(([label, checked, setter]) => (
              <PageSidePanelItem
                key={String(label)}
                title={String(label)}
                action={
                  <Switch
                    size="sm"
                    disabled={!postProcessingEnabled && setter !== setPostProcessingEnabled}
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

        <RegexRulesSettings safePersist={safePersist} />

        <TranslateRequestSettings safePersist={safePersist} />

        <TranslatePromptField />

        <CustomLanguageList />

        <GlossarySettings />
      </div>
    </PageSidePanel>
  )
}

const TranslateModelSettings: FC<{
  safePersist: (persistPromise: Promise<unknown>, actionName: string) => Promise<void>
}> = ({ safePersist }) => {
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
  const [globalPolishModelId, setGlobalPolishModelId] = usePreference('feature.translate.model.polish_global_id')

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
    },
    {
      key: 'global-polish',
      label: t('settings.models.polish_model'),
      value: globalPolishModelId,
      setter: setGlobalPolishModelId
    }
  ]

  return (
    <PageSidePanelSection title={t('translate.settings.group_model')}>
      <div className="flex flex-col gap-4">
        {fields.map((field) => {
          const followsGlobal = field.follows?.value === true
          return (
            <PageSidePanelItem
              key={field.key}
              title={field.label}
              action={
                field.follows ? (
                  <Switch
                    size="sm"
                    checked={field.follows.value}
                    onCheckedChange={(value) =>
                      void safePersist(field.follows!.setter(value), `${field.key} follows global`)
                    }
                  />
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
                    <Button type="button" variant="outline" size="sm" className="w-full justify-start">
                      <span className="truncate">{field.value ?? t('translate.settings.model_placeholder')}</span>
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

const TranslateRequestSettings: FC<{ safePersist?: PersistPreference }> = ({ safePersist = defaultPersist }) => {
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
    <PageSidePanelSection title={t('translate.settings.custom_body.title')}>
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
                {t('models.add_parameter')}
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

const RegexRulesSettings: FC<{ safePersist?: PersistPreference }> = ({ safePersist = defaultPersist }) => {
  const { t } = useTranslation()
  const [rules, setRules] = usePreference('feature.translate.post_processing.regex_rules')

  const save = (next: TranslateRegexReplacementRule[]) =>
    safePersist(setRules(next), 'translate regex replacement rules')

  return (
    <PageSidePanelSection
      title={t('translate.settings.regex_rules.title')}
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

const TranslateSettingsCoreContent: FC = () => {
  return (
    <div className="flex flex-col gap-8">
      <TranslatePromptField />
      <TranslateRequestSettings />
      <RegexRulesSettings />
      <CustomLanguageList />
      <GlossarySettings />
    </div>
  )
}

const TranslatePromptField: FC = () => {
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
    <>
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
        preferenceKey="feature.translate.prompt.other_to_native"
        titleKey="translate.settings.prompt.other_to_native"
        defaultValue={TRANSLATE_PROMPT}
      />
      <AdditionalPromptField
        preferenceKey="feature.translate.prompt.polish"
        titleKey="translate.settings.prompt.polish"
        defaultValue={POLISH_PROMPT}
      />
    </>
  )
}

const AdditionalPromptField: FC<{
  preferenceKey: 'feature.translate.prompt.other_to_native' | 'feature.translate.prompt.polish'
  titleKey: string
  defaultValue: string
}> = ({ preferenceKey, titleKey, defaultValue }) => {
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

const GlossarySettings: FC = () => {
  const { t } = useTranslation()
  const { languages } = useLanguages()
  const { entries, create, update, remove } = useTranslateGlossary()
  const [isAdding, setIsAdding] = useState(false)
  const [sourcePhrase, setSourcePhrase] = useState('')
  const [targetPhrase, setTargetPhrase] = useState('')
  const defaultLanguage = useMemo(
    () =>
      languages?.find((language) => language.langCode !== UNKNOWN_LANG_CODE)?.langCode ??
      parsePersistedLangCode('zh-cn'),
    [languages]
  )
  const [targetLanguage, setTargetLanguage] = useState<PersistedLangCode>(defaultLanguage)

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
      actions={
        !isAdding && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(true)}>
            <Plus size={13} />
            {t('common.add')}
          </Button>
        )
      }>
      <p className="mb-2 text-muted-foreground text-xs">{t('settings.translate.glossary.hint')}</p>
      <div className="flex flex-col gap-2">
        {entries.map((entry) => (
          <GlossaryRow key={entry.id} entry={entry} onUpdate={update} onRemove={remove} />
        ))}
        {entries.length === 0 && !isAdding && (
          <p className="rounded-md bg-muted/30 px-2 py-2 text-center text-muted-foreground text-sm">
            {t('common.no_results')}
          </p>
        )}
        {isAdding && (
          <div className="space-y-3 rounded-lg bg-muted/20 p-3">
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
    </PageSidePanelSection>
  )
}

const GlossaryRow: FC<{
  entry: TranslateGlossaryEntry
  onUpdate: (
    id: string,
    data: Partial<Pick<TranslateGlossaryEntry, 'sourcePhrase' | 'targetPhrase' | 'targetLanguage' | 'enabled'>>
  ) => Promise<unknown>
  onRemove: (id: string) => Promise<unknown>
}> = ({ entry, onUpdate, onRemove }) => {
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
      <div className="space-y-2 rounded-lg bg-muted/20 p-3">
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
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/30">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">
          {entry.sourcePhrase} → {entry.targetPhrase}
        </div>
        <div className="font-mono text-foreground-tertiary text-xs">{entry.targetLanguage}</div>
      </div>
      <Switch size="sm" checked={entry.enabled} onCheckedChange={(enabled) => void onUpdate(entry.id, { enabled })} />
      <IconButton size="xs" onClick={() => setEditing(true)} aria-label={t('common.edit')}>
        <PenLine size={10} />
      </IconButton>
      <IconButton size="xs" tone="destructive" onClick={() => setConfirmOpen(true)} aria-label={t('common.delete')}>
        <X size={10} />
      </IconButton>
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

export const TranslateSettingsPanelContent: FC = () => <TranslateSettingsCoreContent />

export default memo(TranslateSettings)
