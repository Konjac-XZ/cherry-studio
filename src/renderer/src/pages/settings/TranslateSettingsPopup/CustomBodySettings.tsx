import CodeEditor from '@renderer/components/CodeEditor'
import { DeleteIcon } from '@renderer/components/Icons'
import { HStack } from '@renderer/components/Layout'
import { TRANSLATE_AUTO_DISABLE_THINKING_KEY } from '@renderer/config/translateSettings'
import { useTheme } from '@renderer/context/ThemeProvider'
import db from '@renderer/databases'
import useTranslate from '@renderer/hooks/useTranslate'
import type { AssistantSettingCustomParameters } from '@renderer/types'
import { Button, Col, Input, InputNumber, Row, Select, Switch, Tooltip } from 'antd'
import { HelpCircle, PlusIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SettingGroup, SettingRow, SettingTitle } from '..'

const CustomBodySettings = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { settings, updateSettings } = useTranslate()
  const [params, setParams] = useState<AssistantSettingCustomParameters[]>(settings.customParameters ?? [])
  const [autoDisableThinking, setAutoDisableThinking] = useState(true)

  useEffect(() => {
    void (async () => {
      const autoDisableThinkingSetting = await db.settings.get({ id: TRANSLATE_AUTO_DISABLE_THINKING_KEY })
      if (autoDisableThinkingSetting) {
        setAutoDisableThinking(Boolean(autoDisableThinkingSetting.value))
      } else {
        setAutoDisableThinking(true)
        await db.settings.put({ id: TRANSLATE_AUTO_DISABLE_THINKING_KEY, value: true })
      }
    })()
  }, [])

  const save = (updated: AssistantSettingCustomParameters[]) => {
    setParams(updated)
    updateSettings({ customParameters: updated })
  }

  const onAdd = () => {
    save([...params, { name: '', value: '', type: 'string' }])
  }

  const onDelete = (index: number) => {
    save(params.filter((_, i) => i !== index))
  }

  const onUpdate = (index: number, field: 'name' | 'value' | 'type', value: string | number | boolean) => {
    const next = [...params]
    if (field === 'type') {
      const defaultValue = value === 'number' ? 0 : value === 'boolean' ? false : ''
      next[index] = { ...next[index], type: value as AssistantSettingCustomParameters['type'], value: defaultValue }
    } else {
      next[index] = { ...next[index], [field]: value }
    }
    save(next)
  }

  const onAutoDisableThinkingChange = async (checked: boolean) => {
    setAutoDisableThinking(checked)
    await db.settings.put({ id: TRANSLATE_AUTO_DISABLE_THINKING_KEY, value: checked })
  }

  const renderValueInput = (param: AssistantSettingCustomParameters, index: number) => {
    switch (param.type) {
      case 'number':
        return (
          <InputNumber
            style={{ width: '100%' }}
            value={param.value as number}
            onChange={(v) => onUpdate(index, 'value', v ?? 0)}
            step={0.01}
          />
        )
      case 'boolean':
        return (
          <Select
            value={param.value as boolean}
            onChange={(v) => onUpdate(index, 'value', v)}
            style={{ width: '100%' }}
            options={[
              { label: 'true', value: true },
              { label: 'false', value: false }
            ]}
          />
        )
      case 'json': {
        const jsonValue = typeof param.value === 'string' ? param.value : JSON.stringify(param.value, null, 2)
        let hasError = false
        if (jsonValue.trim()) {
          try {
            JSON.parse(jsonValue)
          } catch {
            hasError = true
          }
        }
        return (
          <>
            <CodeEditor
              value={jsonValue}
              language="json"
              onChange={(v) => onUpdate(index, 'value', v)}
              expanded={false}
              height="auto"
              maxHeight="200px"
              minHeight="60px"
              options={{ lint: true, lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
              style={{
                borderRadius: 6,
                overflow: 'hidden',
                border: `1px solid ${hasError ? 'var(--color-error)' : 'var(--color-border)'}`
              }}
            />
            {hasError && (
              <div style={{ color: 'var(--color-error)', fontSize: 12, marginTop: 4 }}>
                {t('models.json_parse_error')}
              </div>
            )}
          </>
        )
      }
      default:
        return <Input value={param.value as string} onChange={(e) => onUpdate(index, 'value', e.target.value)} />
    }
  }

  return (
    <SettingGroup theme={theme}>
      <SettingRow style={{ minHeight: 30 }}>
        <SettingTitle>{t('settings.translate.custom_body')}</SettingTitle>
        <Button icon={<PlusIcon size={18} />} onClick={onAdd}>
          {t('models.add_parameter')}
        </Button>
      </SettingRow>
      {params.map((param, index) => (
        <div key={index} style={{ marginTop: 10 }}>
          <Row align="stretch" gutter={10}>
            <Col span={6}>
              <Input
                placeholder={t('models.parameter_name')}
                value={param.name}
                onChange={(e) => onUpdate(index, 'name', e.target.value)}
              />
            </Col>
            <Col span={6}>
              <Select value={param.type} onChange={(v) => onUpdate(index, 'type', v)} style={{ width: '100%' }}>
                <Select.Option value="string">{t('models.parameter_type.string')}</Select.Option>
                <Select.Option value="number">{t('models.parameter_type.number')}</Select.Option>
                <Select.Option value="boolean">{t('models.parameter_type.boolean')}</Select.Option>
                <Select.Option value="json">{t('models.parameter_type.json')}</Select.Option>
              </Select>
            </Col>
            {param.type !== 'json' && <Col span={10}>{renderValueInput(param, index)}</Col>}
            <Col span={param.type === 'json' ? 12 : 2} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                color="danger"
                variant="filled"
                icon={<DeleteIcon size={14} className="lucide-custom" />}
                onClick={() => onDelete(index)}
              />
            </Col>
          </Row>
          {param.type === 'json' && <div style={{ marginTop: 6 }}>{renderValueInput(param, index)}</div>}
        </div>
      ))}

      <SettingRow style={{ marginTop: 16 }}>
        <div style={{ fontSize: 14, lineHeight: '18px', color: 'var(--color-text-1)' }}>
          <HStack alignItems="center" gap={5}>
            {t('translate.settings.minimize_thinking.label')}
            <Tooltip title={t('translate.settings.minimize_thinking.tip')}>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                <HelpCircle size={14} style={{ color: 'var(--color-text-3)' }} />
              </span>
            </Tooltip>
          </HStack>
        </div>
        <Switch checked={autoDisableThinking} onChange={(checked) => void onAutoDisableThinkingChange(checked)} />
      </SettingRow>
    </SettingGroup>
  )
}

export default CustomBodySettings
