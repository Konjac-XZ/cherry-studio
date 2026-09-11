export {
  clipboardFingerprint,
  formatClipboardMarkdown,
  htmlToTranslateMarkdown,
  shouldPreferPlainTextClipboard,
  shouldPreferPlainTextCodeBlock
} from './clipboardMarkdown'
export {
  type ComposerInputTranslationCoordinatorOptions,
  coordinateComposerInputTranslation
} from './composerInputTranslation'
export type { JsonStructure } from './jsonStructure'
export { getJsonStructureForDisplay, parseJsonStructure } from './jsonStructure'
export type { JsonStructureCopySeparator } from './jsonStructureCopy'
export { normalizeJsonStructureSelection } from './jsonStructureCopy'
export {
  determineTargetLanguage,
  getTargetLanguageForBidirectional,
  isEquivalentBidirectionalLanguage,
  pickBidirectionalTarget,
  UNKNOWN_LANG_CODE
} from './language'
export {
  clampTranslatePanelSize,
  getTranslatePanelBounds,
  MIN_TRANSLATE_PANEL_PERCENT
} from './layout'
export { getTranslateModifierLabel } from './platform'
export {
  applyRegexReplacementRules,
  applyRegexReplacementRulesThrough,
  applyTranslationPostProcessors,
  DEFAULT_TRANSLATION_POST_PROCESSOR_FEATURES,
  evaluateRegexReplacementRulesThrough,
  normalizeEnMarkdownStraightQuotes,
  normalizeZhCnMarkdownQuotes,
  type RegexReplacementEvaluation,
  type RegexReplacementIssue,
  type RegexReplacementRule,
  shouldApplyEnMarkdownStraightQuotes,
  shouldApplyZhCnMarkdownSmartQuotes,
  shouldApplyZhMarkdownTextSpacing,
  type TranslationPostProcessorContext,
  type TranslationPostProcessorFeatures
} from './postProcessors'
export { normalizeEditedTranslateFontSize, normalizePersistedTranslateFontSize } from './preferences'
export { createInputScrollHandler, createOutputScrollHandler, handleScrollSync } from './scrollSync'
export { resolveTranslatePlan, translateText, type TranslateTextOptions } from './translateText'
export { normalizeZhMarkdownTextSpacing } from './zhMarkdownSpacing'
