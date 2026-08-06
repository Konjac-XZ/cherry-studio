# Source path coverage matrix

This matrix is a path-level backstop for the behavior ledgers. The last column is a routing category, not a task ID or completed disposition; interpret every cell as namespaced `PC-<cell>` (for example raw `T03` means `PC-T03`). Files with multiple responsibilities require region-level crosswalk entries before final verification. Every row must ultimately be covered by a behavior task or an evidenced `v2-native`/`noise` disposition.

Category keys: `PC-R01` repository/build workflow; `PC-T01` translate UI/layout/actions; `PC-T02` translate settings/preferences; `PC-T03` translate execution/model/cancellation; `PC-T04` language/directional decisions; `PC-T05` clipboard/file/platform; `PC-T06` history/cache/data; `PC-T07` post-processing/glossary/regex; `PC-T08` structured JSON output; `PC-N01` conversation processing; `PC-N02` provider/model management; `PC-N03` shortcuts/navigation/window/tab/topic; `PC-N04` rendering and other UI; `PC-N05` model-selection UI defaults/naming; `PC-N09` narrow-window policy; `PC-D01` dirty-overlay Claude Sonnet 5 model support; `PC-SUPPORT` tests/i18n/assets. `AUDIT` is reserved for unresolved classification and currently has zero rows.

| Old v1 path | Committed diff | Dirty overlay | Path category (`PC-*`) |
| --- | --- | --- | --- |
| `.github/workflows/claude-code-review.yml` | yes | no | R01 |
| `.github/workflows/claude.yml` | yes | no | R01 |
| `.github/workflows/dispatch-docs-update.yml` | yes | no | R01 |
| `.github/workflows/issue-management.yml` | yes | no | R01 |
| `.gitignore` | yes | no | R01 |
| `.vscode/settings.json` | yes | no | R01 |
| `AGENTS.md` | yes | no | R01 |
| `CLAUDE.md` | yes | no | R01 |
| `MIGRATION_BEHAVIOR_TEST_MATRIX.md` | yes | no | R01 |
| `electron-builder.yml` | yes | no | R01 |
| `package.json` | yes | no | R01 |
| `packages/shared/IpcChannel.ts` | yes | no | T05 |
| `packages/shared/config/constant.ts` | yes | no | N09 |
| `packages/shared/utils/api/__tests__/api.test.ts` | yes | no | SUPPORT |
| `pnpm-lock.yaml` | yes | no | R01 |
| `scripts/build-win-x64.js` | yes | no | R01 |
| `scripts/feishu-notify.ts` | yes | no | R01 |
| `src/main/__tests__/builtinSkills.test.ts` | yes | no | SUPPORT |
| `src/main/index.ts` | yes | no | T05 |
| `src/main/ipc.ts` | yes | no | T05 |
| `src/main/knowledge/embedjs/embeddings/__tests__/OllamaEmbeddings.test.ts` | yes | no | N02, SUPPORT |
| `src/main/mcpServers/__tests__/workspaceMemory.test.ts` | yes | no | SUPPORT |
| `src/main/services/ClipboardWatchService.ts` | yes | no | T05 |
| `src/main/services/OvmsManager.ts` | yes | no | N04 |
| `src/main/services/ShortcutService.ts` | yes | no | N03 |
| `src/main/services/WindowService.ts` | yes | no | N03 |
| `src/main/services/__tests__/ClipboardWatchService.test.ts` | yes | no | T05, SUPPORT |
| `src/main/types/clipboard-event.d.ts` | yes | no | T05 |
| `src/main/utils/__tests__/windowUtil.test.ts` | yes | no | N03, SUPPORT |
| `src/preload/index.ts` | yes | no | T05 |
| `src/renderer/src/aiCore/AiProvider.ts` | yes | no | T03 |
| `src/renderer/src/aiCore/prepareParams/parameterBuilder.ts` | yes | no | T03 |
| `src/renderer/src/aiCore/provider/__tests__/providerConfig.test.ts` | yes | no | N02, SUPPORT |
| `src/renderer/src/aiCore/provider/extensions/__tests__/types.test.ts` | yes | no | N02, SUPPORT |
| `src/renderer/src/aiCore/provider/extensions/index.ts` | yes | no | N02 |
| `src/renderer/src/aiCore/provider/providerConfig.ts` | yes | no | N02 |
| `src/renderer/src/aiCore/services/__tests__/__snapshots__/listModels.test.ts.snap` | yes | no | SUPPORT |
| `src/renderer/src/aiCore/services/__tests__/listModels.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/aiCore/services/listModels.ts` | yes | no | N02 |
| `src/renderer/src/aiCore/services/schemas.ts` | yes | no | T03 |
| `src/renderer/src/aiCore/utils/__tests__/extractAiSdkStandardParams.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/aiCore/utils/__tests__/options.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/aiCore/utils/__tests__/reasoning.test.ts` | yes | yes | SUPPORT |
| `src/renderer/src/aiCore/utils/options.ts` | yes | no | T03 |
| `src/renderer/src/aiCore/utils/reasoning.ts` | yes | yes | T03 |
| `src/renderer/src/assets/fonts/country-flag-fonts/TwemojiCountryFlags.woff2` | yes | no | SUPPORT |
| `src/renderer/src/assets/images/apps/gemini.png` | yes | no | SUPPORT |
| `src/renderer/src/assets/images/models/gemini.png` | yes | no | SUPPORT |
| `src/renderer/src/assets/images/models/gpt-5-chat.png` | yes | no | SUPPORT |
| `src/renderer/src/assets/images/models/gpt-5-codex.png` | yes | no | SUPPORT |
| `src/renderer/src/assets/images/models/gpt-5-mini.png` | yes | no | SUPPORT |
| `src/renderer/src/assets/images/models/gpt-5-nano.png` | yes | no | SUPPORT |
| `src/renderer/src/assets/images/models/gpt-5.1-chat.png` | yes | no | SUPPORT |
| `src/renderer/src/assets/images/models/gpt-5.1-codex-mini.png` | yes | no | SUPPORT |
| `src/renderer/src/assets/images/models/gpt-5.1-codex.png` | yes | no | SUPPORT |
| `src/renderer/src/assets/images/models/gpt-5.1.png` | yes | no | SUPPORT |
| `src/renderer/src/assets/images/models/gpt-5.png` | yes | no | SUPPORT |
| `src/renderer/src/assets/styles/font.css` | yes | no | N04 |
| `src/renderer/src/components/CodeBlockView/HtmlArtifactsCard.tsx` | yes | no | N04 |
| `src/renderer/src/components/ContentSearch.tsx` | yes | no | N04 |
| `src/renderer/src/components/Popups/SelectModelPopup/base-popup.tsx` | yes | no | N05 |
| `src/renderer/src/components/QuickPanel/provider.tsx` | yes | no | N04 |
| `src/renderer/src/components/QuickPanel/types.ts` | yes | no | N04 |
| `src/renderer/src/components/Tab/TabContainer.tsx` | yes | no | N03 |
| `src/renderer/src/components/ThinkingEffect.tsx` | yes | no | N04 |
| `src/renderer/src/config/models/__tests__/reasoning.test.ts` | yes | yes | N02, SUPPORT |
| `src/renderer/src/config/models/dedicatedImage.ts` | yes | no | N02 |
| `src/renderer/src/config/models/embedding.ts` | yes | no | N02 |
| `src/renderer/src/config/models/reasoning.ts` | yes | yes | N02, D01 |
| `src/renderer/src/config/models/vision.ts` | yes | yes | N02, D01 |
| `src/renderer/src/config/prompts.ts` | yes | no | T07 |
| `src/renderer/src/config/providers.ts` | yes | no | N02 |
| `src/renderer/src/config/translate.ts` | yes | no | T04 |
| `src/renderer/src/context/CodeStyleProvider.tsx` | yes | no | N04 |
| `src/renderer/src/databases/index.ts` | yes | no | T06 |
| `src/renderer/src/databases/upgrades.ts` | yes | no | T06 |
| `src/renderer/src/handler/NavigationHandler.tsx` | yes | no | N03 |
| `src/renderer/src/hooks/__tests__/useProvider.test.ts` | yes | no | N02, SUPPORT |
| `src/renderer/src/hooks/useAssistant.ts` | yes | no | N01 |
| `src/renderer/src/hooks/useMessageOperations.ts` | yes | no | N01 |
| `src/renderer/src/hooks/useProvider.ts` | yes | no | N02 |
| `src/renderer/src/hooks/useStore.ts` | yes | no | SUPPORT |
| `src/renderer/src/hooks/useTopic.ts` | yes | no | N02 |
| `src/renderer/src/hooks/useTranslate.ts` | yes | no | N01 |
| `src/renderer/src/i18n/label.ts` | yes | no | SUPPORT |
| `src/renderer/src/i18n/locales/en-us.json` | yes | yes | SUPPORT |
| `src/renderer/src/i18n/locales/zh-cn.json` | yes | yes | SUPPORT |
| `src/renderer/src/i18n/locales/zh-tw.json` | yes | yes | SUPPORT |
| `src/renderer/src/i18n/translate/de-de.json` | yes | yes | SUPPORT |
| `src/renderer/src/i18n/translate/el-gr.json` | yes | yes | SUPPORT |
| `src/renderer/src/i18n/translate/es-es.json` | yes | yes | SUPPORT |
| `src/renderer/src/i18n/translate/fr-fr.json` | yes | yes | SUPPORT |
| `src/renderer/src/i18n/translate/ja-jp.json` | yes | yes | SUPPORT |
| `src/renderer/src/i18n/translate/pt-pt.json` | yes | yes | SUPPORT |
| `src/renderer/src/i18n/translate/ro-ro.json` | yes | yes | SUPPORT |
| `src/renderer/src/i18n/translate/ru-ru.json` | yes | yes | SUPPORT |
| `src/renderer/src/i18n/translate/vi-vn.json` | yes | yes | SUPPORT |
| `src/renderer/src/pages/history/components/SearchResults.tsx` | yes | no | N04 |
| `src/renderer/src/pages/history/components/TopicMessages.tsx` | yes | no | N04 |
| `src/renderer/src/pages/home/HomePage.tsx` | yes | no | N03 |
| `src/renderer/src/pages/home/Inputbar/Inputbar.tsx` | yes | no | N03 |
| `src/renderer/src/pages/home/Inputbar/components/InputbarCore.tsx` | yes | no | N03 |
| `src/renderer/src/pages/home/Messages/ChatFlowHistory.tsx` | yes | no | N01 |
| `src/renderer/src/pages/home/Messages/Message.tsx` | yes | no | N01 |
| `src/renderer/src/pages/home/Messages/MessageMenubar.tsx` | yes | no | N01, N04 |
| `src/renderer/src/pages/home/Messages/Messages.tsx` | yes | no | N01 |
| `src/renderer/src/pages/home/Messages/__tests__/MessageGroup.test.tsx` | yes | no | N01, SUPPORT |
| `src/renderer/src/pages/home/Tabs/components/Topics.tsx` | yes | no | N03 |
| `src/renderer/src/pages/home/Tabs/hooks/useUnifiedGrouping.ts` | yes | no | N03 |
| `src/renderer/src/pages/home/components/ChatNavBar/Tools/SettingsTab/AssistantSettingsTab.tsx` | yes | no | N04 |
| `src/renderer/src/pages/onboarding/components/WelcomePage.tsx` | yes | no | N04 |
| `src/renderer/src/pages/settings/AssistantSettings/AssistantKnowledgeBaseSettings.tsx` | yes | no | N04 |
| `src/renderer/src/pages/settings/AssistantSettings/AssistantModelSettings.tsx` | yes | no | N04 |
| `src/renderer/src/pages/settings/DisplaySettings/DisplaySettings.tsx` | yes | no | N04 |
| `src/renderer/src/pages/settings/GeneralSettings.tsx` | yes | no | N04 |
| `src/renderer/src/pages/settings/ModelSettings/ModelSettings.tsx` | yes | no | N04 |
| `src/renderer/src/pages/settings/ProviderSettings/EditModelPopup/EditModelPopup.tsx` | yes | no | N02 |
| `src/renderer/src/pages/settings/ProviderSettings/ModelList/AddModelPopup.tsx` | yes | no | N02 |
| `src/renderer/src/pages/settings/ProviderSettings/ModelList/ManageModelsList.tsx` | yes | no | N02 |
| `src/renderer/src/pages/settings/ProviderSettings/ModelList/ManageModelsPopup.tsx` | yes | no | N02 |
| `src/renderer/src/pages/settings/ProviderSettings/ModelList/NewApiAddModelPopup.tsx` | yes | no | N02 |
| `src/renderer/src/pages/settings/ProviderSettings/ModelList/utils.ts` | yes | no | N02 |
| `src/renderer/src/pages/settings/ProviderSettings/ProviderList.tsx` | yes | no | N02 |
| `src/renderer/src/pages/settings/ProviderSettings/ProviderSetting.tsx` | yes | no | N02 |
| `src/renderer/src/pages/settings/TranslateSettingsPopup/CustomBodySettings.tsx` | yes | no | T02, T07 |
| `src/renderer/src/pages/settings/TranslateSettingsPopup/CustomLanguageModal.tsx` | yes | no | T02 |
| `src/renderer/src/pages/settings/TranslateSettingsPopup/CustomLanguageSettings.tsx` | yes | no | T02 |
| `src/renderer/src/pages/settings/TranslateSettingsPopup/GlossarySettings.tsx` | yes | no | T02, T07 |
| `src/renderer/src/pages/settings/TranslateSettingsPopup/RegexReplacementSettings.tsx` | yes | no | T02, T07 |
| `src/renderer/src/pages/settings/TranslateSettingsPopup/TranslatePromptSettings.tsx` | yes | no | T02 |
| `src/renderer/src/pages/settings/TranslateSettingsPopup/TranslateSettingsPopup.tsx` | yes | no | T02 |
| `src/renderer/src/pages/translate/TranslateHistory.test.tsx` | yes | no | T01, T06, SUPPORT |
| `src/renderer/src/pages/translate/TranslateHistory.tsx` | yes | no | T01, T06 |
| `src/renderer/src/pages/translate/TranslatePage.constants.ts` | yes | no | T01 |
| `src/renderer/src/pages/translate/TranslatePage.styles.ts` | yes | no | T01 |
| `src/renderer/src/pages/translate/TranslatePage.tsx` | yes | yes | T01 |
| `src/renderer/src/pages/translate/TranslatePage.types.ts` | yes | no | T01 |
| `src/renderer/src/pages/translate/TranslatePage.utils.ts` | yes | no | T01 |
| `src/renderer/src/pages/translate/TranslateSettings.tsx` | yes | yes | T02 |
| `src/renderer/src/pages/translate/components/ClipboardWatchToggleButton.tsx` | yes | no | T01 |
| `src/renderer/src/pages/translate/components/DraggableDivider.tsx` | yes | no | T01 |
| `src/renderer/src/pages/translate/components/FlipButton.tsx` | yes | no | T01 |
| `src/renderer/src/pages/translate/components/FloatingActionBar.tsx` | yes | no | T01 |
| `src/renderer/src/pages/translate/components/HtmlConversionToggleButton.tsx` | yes | no | T01 |
| `src/renderer/src/pages/translate/components/JsonStructureView.test.tsx` | yes | yes | T01, T08, SUPPORT |
| `src/renderer/src/pages/translate/components/JsonStructureView.tsx` | yes | yes | T01, T08 |
| `src/renderer/src/pages/translate/components/PolishTranslateToggleButton.tsx` | yes | no | T01 |
| `src/renderer/src/pages/translate/components/PostProcessingToggleButton.tsx` | yes | no | T01 |
| `src/renderer/src/pages/translate/components/TranslateButton.tsx` | yes | no | T01 |
| `src/renderer/src/pages/translate/components/TranslateOutputContent.test.tsx` | yes | yes | T01, SUPPORT |
| `src/renderer/src/pages/translate/components/TranslateOutputContent.tsx` | yes | yes | T01 |
| `src/renderer/src/pages/translate/components/TranslatePageActions.tsx` | yes | no | T01 |
| `src/renderer/src/pages/translate/hooks/__tests__/useDirectionalTranslateModels.test.ts` | yes | no | T04, SUPPORT |
| `src/renderer/src/pages/translate/hooks/__tests__/useTranslateClipboardRead.test.ts` | yes | no | T05, SUPPORT |
| `src/renderer/src/pages/translate/hooks/__tests__/useTranslateClipboardWatch.test.ts` | yes | no | T05, SUPPORT |
| `src/renderer/src/pages/translate/hooks/__tests__/useTranslateClipboardWrite.test.ts` | yes | no | T05, SUPPORT |
| `src/renderer/src/pages/translate/hooks/__tests__/useTranslateExecution.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/pages/translate/hooks/__tests__/useTranslateFlow.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/pages/translate/hooks/__tests__/useTranslateLanguageControls.test.ts` | yes | no | T04, SUPPORT |
| `src/renderer/src/pages/translate/hooks/__tests__/useTranslateModelControls.test.ts` | yes | no | T04, SUPPORT |
| `src/renderer/src/pages/translate/hooks/__tests__/useTranslateSettingsSync.test.ts` | yes | yes | SUPPORT |
| `src/renderer/src/pages/translate/hooks/__tests__/useTranslateStreamingExecution.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/pages/translate/hooks/translateExecution.utils.ts` | yes | no | T03 |
| `src/renderer/src/pages/translate/hooks/useDirectionalTranslateModels.ts` | yes | no | T04 |
| `src/renderer/src/pages/translate/hooks/usePolishTranslateFlow.ts` | yes | no | T03 |
| `src/renderer/src/pages/translate/hooks/useTranslateAutoPasteTrigger.ts` | yes | no | T05 |
| `src/renderer/src/pages/translate/hooks/useTranslateBusyStage.ts` | yes | no | T03 |
| `src/renderer/src/pages/translate/hooks/useTranslateClipboard.ts` | yes | no | T05 |
| `src/renderer/src/pages/translate/hooks/useTranslateClipboardRead.ts` | yes | no | T05 |
| `src/renderer/src/pages/translate/hooks/useTranslateClipboardWatch.ts` | yes | no | T05 |
| `src/renderer/src/pages/translate/hooks/useTranslateClipboardWrite.ts` | yes | no | T05 |
| `src/renderer/src/pages/translate/hooks/useTranslateContentState.ts` | yes | no | T03 |
| `src/renderer/src/pages/translate/hooks/useTranslateExecution.ts` | yes | no | T03 |
| `src/renderer/src/pages/translate/hooks/useTranslateFileInput.ts` | yes | no | T05 |
| `src/renderer/src/pages/translate/hooks/useTranslateFileProcessor.ts` | yes | no | T05 |
| `src/renderer/src/pages/translate/hooks/useTranslateFlow.ts` | yes | no | T03 |
| `src/renderer/src/pages/translate/hooks/useTranslateFontSize.ts` | yes | no | T01 |
| `src/renderer/src/pages/translate/hooks/useTranslateHistorySelection.ts` | yes | no | T06 |
| `src/renderer/src/pages/translate/hooks/useTranslateHtmlConversion.ts` | yes | no | T05 |
| `src/renderer/src/pages/translate/hooks/useTranslateLanguageControls.ts` | yes | no | T04 |
| `src/renderer/src/pages/translate/hooks/useTranslateLayout.ts` | yes | no | T01 |
| `src/renderer/src/pages/translate/hooks/useTranslateMarkdownRenderer.ts` | yes | no | T01 |
| `src/renderer/src/pages/translate/hooks/useTranslateModelControls.ts` | yes | no | T04 |
| `src/renderer/src/pages/translate/hooks/useTranslatePage.ts` | yes | yes | T03 |
| `src/renderer/src/pages/translate/hooks/useTranslatePostProcessing.ts` | yes | no | T07 |
| `src/renderer/src/pages/translate/hooks/useTranslateSettingsSync.ts` | yes | yes | T02 |
| `src/renderer/src/pages/translate/hooks/useTranslateStreamingExecution.ts` | yes | no | T03 |
| `src/renderer/src/pages/translate/hooks/useTranslateTextInput.ts` | yes | no | T05 |
| `src/renderer/src/pages/translate/hooks/useTranslationFlowRunner.ts` | yes | no | T03 |
| `src/renderer/src/pages/translate/jsonStructure.test.ts` | yes | no | T08, SUPPORT |
| `src/renderer/src/pages/translate/jsonStructure.ts` | yes | no | T08 |
| `src/renderer/src/services/ApiService.ts` | yes | no | T03 |
| `src/renderer/src/services/AssistantService.ts` | yes | no | T03 |
| `src/renderer/src/services/GlossaryService.ts` | yes | no | T07 |
| `src/renderer/src/services/MessagesService.ts` | yes | no | N01 |
| `src/renderer/src/services/TranslateLanguageService.ts` | yes | no | T04 |
| `src/renderer/src/services/TranslateService.ts` | yes | no | T03 |
| `src/renderer/src/services/TranslationProcessingService.ts` | yes | no | T03 |
| `src/renderer/src/services/__tests__/AssistantService.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/services/__tests__/GlossaryService.test.ts` | yes | no | T07, SUPPORT |
| `src/renderer/src/services/__tests__/TranslateService.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/services/__tests__/TranslationProcessingService.failure.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/services/__tests__/TranslationProcessingService.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/services/__tests__/assistantReplyPostProcessing.test.ts` | yes | no | N01, SUPPORT |
| `src/renderer/src/services/__tests__/modelManagementPolicy.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/services/__tests__/translateModelPolicy.test.ts` | yes | no | T03, SUPPORT |
| `src/renderer/src/services/assistantReplyPostProcessing.ts` | yes | no | N01 |
| `src/renderer/src/services/languageDetection/LanguageDetector.ts` | yes | no | T04 |
| `src/renderer/src/services/languageDetection/LegacyLlmLanguageDetector.ts` | yes | no | T04 |
| `src/renderer/src/services/languageDetection/detectLanguage.ts` | yes | no | T04 |
| `src/renderer/src/services/languageDetection/francLanguageDetector.ts` | yes | no | T04 |
| `src/renderer/src/services/languageDetection/pureLanguageDetectors.ts` | yes | no | T04 |
| `src/renderer/src/services/modelManagementPolicy.ts` | yes | no | N05 |
| `src/renderer/src/services/translateModelIdentity.ts` | yes | no | T03 |
| `src/renderer/src/services/translateModelPolicy.ts` | yes | no | T03 |
| `src/renderer/src/services/translatePlatform/index.ts` | yes | no | T05 |
| `src/renderer/src/services/translatePlatform/legacyAdapters.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/services/translatePlatform/legacyAdapters.ts` | yes | no | T05 |
| `src/renderer/src/services/translatePlatform/types.ts` | yes | no | T05 |
| `src/renderer/src/services/translateRepositories/cacheKey.ts` | yes | no | T06 |
| `src/renderer/src/services/translateRepositories/index.ts` | yes | no | T06 |
| `src/renderer/src/services/translateRepositories/legacyDexie.test.ts` | yes | yes | T06, SUPPORT |
| `src/renderer/src/services/translateRepositories/legacyDexie.ts` | yes | yes | T06 |
| `src/renderer/src/services/translateRepositories/types.ts` | yes | yes | T06 |
| `src/renderer/src/services/translation/LegacyAssistantTranslationEngine.ts` | yes | no | T03 |
| `src/renderer/src/services/translation/TranslationEngine.ts` | yes | no | T03 |
| `src/renderer/src/services/translation/TranslationUseCase.test.ts` | yes | no | T03, SUPPORT |
| `src/renderer/src/services/translation/TranslationUseCase.ts` | yes | no | T03 |
| `src/renderer/src/store/__tests__/tabs.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/store/index.ts` | yes | no | T02 |
| `src/renderer/src/store/llm.ts` | yes | no | N02 |
| `src/renderer/src/store/migrate.ts` | yes | no | T02 |
| `src/renderer/src/store/settings.ts` | yes | no | T02 |
| `src/renderer/src/store/shortcuts.ts` | yes | no | N03 |
| `src/renderer/src/store/tabs.ts` | yes | no | N03 |
| `src/renderer/src/store/translate.ts` | yes | no | T06 |
| `src/renderer/src/types/index.ts` | yes | no | N01 |
| `src/renderer/src/types/newMessage.ts` | yes | no | N01 |
| `src/renderer/src/types/ollama-ai-provider-v2.d.ts` | yes | no | R05 |
| `src/renderer/src/types/provider.ts` | yes | no | N02 |
| `src/renderer/src/utils/__tests__/api.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/utils/__tests__/markdownConverter.test.ts` | yes | no | T05, SUPPORT |
| `src/renderer/src/utils/__tests__/naming.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/utils/__tests__/prompt.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/utils/__tests__/provider.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/utils/__tests__/shiki.test.ts` | yes | no | N04, SUPPORT |
| `src/renderer/src/utils/__tests__/translate.test.ts` | yes | no | SUPPORT |
| `src/renderer/src/utils/__tests__/translationPostProcessors.test.ts` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/abortController.ts` | yes | no | T03 |
| `src/renderer/src/utils/index.ts` | yes | no | SUPPORT |
| `src/renderer/src/utils/markdownConverter.ts` | yes | no | T05 |
| `src/renderer/src/utils/markdownIt/katex.ts` | yes | no | N04 |
| `src/renderer/src/utils/messageUtils/filters.ts` | yes | no | N02 |
| `src/renderer/src/utils/modelCapabilities.ts` | yes | no | T03 |
| `src/renderer/src/utils/naming.ts` | yes | no | N02 |
| `src/renderer/src/utils/prompt.ts` | yes | no | T07 |
| `src/renderer/src/utils/shiki.ts` | yes | no | N04 |
| `src/renderer/src/utils/translate.ts` | yes | no | T04 |
| `src/renderer/src/utils/translateScroll.ts` | yes | no | T01 |
| `src/renderer/src/utils/translationLanguageRules.test.ts` | yes | no | T04, SUPPORT |
| `src/renderer/src/utils/translationLanguageRules.ts` | yes | no | T04 |
| `src/renderer/src/utils/translationPostProcessors.ts` | yes | no | T07 |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/fixtures/1.input.md` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/fixtures/1.output.md` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/fixtures/2.input.md` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/fixtures/2.output.md` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/fixtures/3.input.md` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/fixtures/3.output.md` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/fixtures/4.input.md` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/fixtures/4.output.md` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/fixtures/5.input.md` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/fixtures/5.output.md` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/fixtures/6.input.md` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/fixtures/6.output.md` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/fixtures/7.input.md` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/fixtures/7.output.md` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/fixtures/8.input.md` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/fixtures/8.output.md` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/fixtures/README.md` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/zhMarkdownSpacing.fixtures.test.ts` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/__tests__/zhMarkdownSpacing.test.ts` | yes | no | T07, SUPPORT |
| `src/renderer/src/utils/zhMarkdownSpacing/index.ts` | yes | no | T07 |
| `src/renderer/src/windows/mini/translate/TranslateWindow.tsx` | yes | no | N03 |
| `src/renderer/src/windows/selection/action/components/ActionTranslate.tsx` | yes | no | N03 |
| `tests/e2e/specs/navigation.spec.ts` | yes | no | N04 |
| `vitest.config.ts` | yes | no | SUPPORT |
| `src/renderer/src/aiCore/prepareParams/__tests__/model-parameters.test.ts` | no | yes | T03, SUPPORT |
| `src/renderer/src/aiCore/prepareParams/modelParameters.ts` | no | yes | T03 |
| `src/renderer/src/config/models/__tests__/models.test.ts` | no | yes | N02, SUPPORT |
| `src/renderer/src/config/models/__tests__/utils.test.ts` | no | yes | N02, SUPPORT |
| `src/renderer/src/config/models/__tests__/websearch.test.ts` | no | yes | N02, SUPPORT |
| `src/renderer/src/config/models/default.ts` | no | yes | N02, D01 |
| `src/renderer/src/config/models/utils.ts` | no | yes | N02, D01 |
| `src/renderer/src/config/models/websearch.ts` | no | yes | N02, D01 |
