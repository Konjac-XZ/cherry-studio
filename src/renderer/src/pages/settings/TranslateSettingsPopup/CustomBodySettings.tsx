import CodeEditor from '@renderer/components/CodeEditor'
import { useTheme } from '@renderer/context/ThemeProvider'
import useTranslate from '@renderer/hooks/useTranslate'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SettingGroup, SettingTitle } from '..'

const CustomBodySettings = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { settings, updateSettings } = useTranslate()
  const [localValue, setLocalValue] = useState(settings.customBody)

  const onBlur = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      updateSettings({ customBody: '' })
      return
    }
    try {
      JSON.parse(trimmed)
      updateSettings({ customBody: trimmed })
    } catch {
      window.toast.error(t('settings.provider.copilot.invalid_json'))
    }
  }

  return (
    <SettingGroup theme={theme}>
      <SettingTitle style={{ marginBottom: 12 }}>{t('settings.translate.custom_body')}</SettingTitle>
      <CodeEditor
        value={localValue}
        language="json"
        onChange={setLocalValue}
        onBlur={onBlur}
        height="120px"
        placeholder='{ "thinkingConfig": { "thinkingBudget": 128 } }'
      />
    </SettingGroup>
  )
}

export default CustomBodySettings
