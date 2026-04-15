import { loggerService } from '@logger'
import { db } from '@renderer/databases'
import type { TranslateLanguage, TranslateLanguageCode } from '@renderer/types'
import {
  applyTranslationPostProcessors,
  DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES,
  type RegexReplacementRule,
  TRANSLATION_POST_PROCESSOR_SETTING_KEYS,
  type TranslationPostProcessorContext,
  type TranslationPostProcessorFeatures
} from '@renderer/utils/translationPostProcessors'

import { buildCustomizedDictionary, GlossaryService } from './GlossaryService'

const logger = loggerService.withContext('TranslationProcessingService')

type TranslationPreProcessorContext = {
  sourceText: string
  targetLanguage: TranslateLanguage
}

type TranslationPreProcessorResult = {
  dictionary: string
}

type TranslationPreProcessor = {
  id: string
  process: (
    context: TranslationPreProcessorContext,
    current: TranslationPreProcessorResult
  ) => Promise<TranslationPreProcessorResult>
}

type TranslationPostProcessorSettings = {
  features: TranslationPostProcessorFeatures
  regexReplacementRules: RegexReplacementRule[]
}

type TranslationPostProcessOptions = {
  markdownEnabled: boolean
  settings?: TranslationPostProcessorSettings
  targetLanguage: TranslateLanguageCode
}

const translationPreProcessors: TranslationPreProcessor[] = [
  {
    id: 'lexicon-injection',
    process: async (context, current) => {
      const glossaryEntries = await GlossaryService.getByTargetLanguage(context.targetLanguage.langCode)
      const dictionary = buildCustomizedDictionary(glossaryEntries, context.sourceText)
      return { ...current, dictionary }
    }
  }
]

export async function runTranslationPreProcessors(
  sourceText: string,
  targetLanguage: TranslateLanguage
): Promise<TranslationPreProcessorResult> {
  let current: TranslationPreProcessorResult = { dictionary: '' }

  for (const processor of translationPreProcessors) {
    try {
      current = await processor.process({ sourceText, targetLanguage }, current)
    } catch (error) {
      logger.warn(`[runTranslationPreProcessors] processor ${processor.id} failed, skipping.`, error as Error)
    }
  }

  return current
}

export async function loadTranslationPostProcessorSettings(): Promise<TranslationPostProcessorSettings> {
  try {
    const [quotesSetting, spacingSetting, regexSetting] = await Promise.all([
      db.settings.get({ id: TRANSLATION_POST_PROCESSOR_SETTING_KEYS.zhCnMarkdownSmartQuotes }),
      db.settings.get({ id: TRANSLATION_POST_PROCESSOR_SETTING_KEYS.zhMarkdownTextSpacing }),
      db.settings.get({ id: TRANSLATION_POST_PROCESSOR_SETTING_KEYS.regexReplacementRules })
    ])

    const features: TranslationPostProcessorFeatures = {
      ...DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES,
      zhCnMarkdownSmartQuotes: Boolean(
        quotesSetting?.value ?? DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES.zhCnMarkdownSmartQuotes
      ),
      zhMarkdownTextSpacing: Boolean(
        spacingSetting?.value ?? DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES.zhMarkdownTextSpacing
      )
    }

    const regexReplacementRules = Array.isArray(regexSetting?.value)
      ? (regexSetting.value as RegexReplacementRule[])
      : []

    return {
      features,
      regexReplacementRules
    }
  } catch (error) {
    logger.warn('[loadTranslationPostProcessorSettings] Failed to read settings, using defaults.', error as Error)
    return {
      features: DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES,
      regexReplacementRules: []
    }
  }
}

export async function applyTranslationPostProcessingWithLatestSettings(
  content: string,
  options: Omit<TranslationPostProcessOptions, 'settings'>
): Promise<string> {
  const settings = await loadTranslationPostProcessorSettings()
  return applyTranslationPostProcessing(content, { ...options, settings })
}

export function applyTranslationPostProcessing(content: string, options: TranslationPostProcessOptions): string {
  const context: TranslationPostProcessorContext = {
    features: options.settings?.features ?? DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES,
    markdownEnabled: options.markdownEnabled,
    targetLanguage: options.targetLanguage,
    regexReplacementRules: options.settings?.regexReplacementRules ?? []
  }

  try {
    return applyTranslationPostProcessors(content, context)
  } catch (error) {
    logger.warn(
      '[applyTranslationPostProcessing] Failed to apply translation post-processors, using original content.',
      error as Error
    )
    return content
  }
}
