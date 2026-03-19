import { RedoOutlined } from '@ant-design/icons'
import { HStack } from '@renderer/components/Layout'
import { TRANSLATE_NATIVE_LANGUAGE_PROMPT, TRANSLATE_PROMPT } from '@renderer/config/prompts'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useSettings } from '@renderer/hooks/useSettings'
import { useAppDispatch } from '@renderer/store'
import { setNativeLanguageTranslateModelPrompt, setOtherLanguageTranslateModelPrompt } from '@renderer/store/settings'
import { Input, Tooltip } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingGroup, SettingTitle } from '..'

const TranslatePromptSettings = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { nativeLanguageTranslateModelPrompt, otherLanguageTranslateModelPrompt, userNativeLanguage } = useSettings()

  const [localNativePrompt, setLocalNativePrompt] = useState(nativeLanguageTranslateModelPrompt)
  const [localOtherPrompt, setLocalOtherPrompt] = useState(otherLanguageTranslateModelPrompt)

  const dispatch = useAppDispatch()

  useEffect(() => {
    setLocalNativePrompt(nativeLanguageTranslateModelPrompt)
  }, [nativeLanguageTranslateModelPrompt])

  useEffect(() => {
    setLocalOtherPrompt(otherLanguageTranslateModelPrompt)
  }, [otherLanguageTranslateModelPrompt])

  const onResetNativePrompt = () => {
    setLocalNativePrompt(TRANSLATE_NATIVE_LANGUAGE_PROMPT)
    dispatch(setNativeLanguageTranslateModelPrompt(TRANSLATE_NATIVE_LANGUAGE_PROMPT))
  }

  const onResetOtherPrompt = () => {
    setLocalOtherPrompt(TRANSLATE_PROMPT)
    dispatch(setOtherLanguageTranslateModelPrompt(TRANSLATE_PROMPT))
  }

  return (
    <SettingGroup theme={theme}>
      <SettingTitle style={{ marginBottom: 12 }}>
        {t('settings.translate.prompt')}
      </SettingTitle>
      <PromptDescription>{t('settings.translate.prompt_hint')}</PromptDescription>

      <PromptSection>
        <HStack alignItems="center" gap={10} height={30}>
          {t('settings.translate.prompt_native')}
          {localNativePrompt !== TRANSLATE_NATIVE_LANGUAGE_PROMPT && (
            <Tooltip title={t('common.reset')}>
              <ResetButton type="reset" onClick={onResetNativePrompt}>
                <RedoOutlined size={16} />
              </ResetButton>
            </Tooltip>
          )}
        </HStack>
        <PromptDescription>
          {t('settings.translate.prompt_native_description', {
            nativeLanguage: userNativeLanguage || t('common.not_set')
          })}
        </PromptDescription>
        <Input.TextArea
          value={localNativePrompt}
          onChange={(e) => setLocalNativePrompt(e.target.value)}
          onBlur={(e) => dispatch(setNativeLanguageTranslateModelPrompt(e.target.value))}
          autoSize={{ minRows: 4, maxRows: 10 }}
          placeholder={t('settings.translate.prompt_native_placeholder')}
        />
      </PromptSection>

      <PromptSection>
        <HStack alignItems="center" gap={10} height={30}>
          {t('settings.translate.prompt_other')}
          {localOtherPrompt !== TRANSLATE_PROMPT && (
            <Tooltip title={t('common.reset')}>
              <ResetButton type="reset" onClick={onResetOtherPrompt}>
                <RedoOutlined size={16} />
              </ResetButton>
            </Tooltip>
          )}
        </HStack>
        <PromptDescription>{t('settings.translate.prompt_other_description')}</PromptDescription>
        <Input.TextArea
          value={localOtherPrompt}
          onChange={(e) => setLocalOtherPrompt(e.target.value)}
          onBlur={(e) => dispatch(setOtherLanguageTranslateModelPrompt(e.target.value))}
          autoSize={{ minRows: 4, maxRows: 10 }}
          placeholder={t('settings.translate.prompt_other_placeholder')}
        />
      </PromptSection>
    </SettingGroup>
  )
}

const PromptSection = styled.div`
  & + & {
    margin-top: 20px;
  }
`

const PromptDescription = styled.div`
  color: var(--color-text-2);
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 8px;
`

const ResetButton = styled.button`
  background-color: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text);
  padding: 0;
  width: 30px;
  height: 30px;

  &:hover {
    background: var(--color-list-item);
    border-radius: 8px;
  }
`

export default TranslatePromptSettings
