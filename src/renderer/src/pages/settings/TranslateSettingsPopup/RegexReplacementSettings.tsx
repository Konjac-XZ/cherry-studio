import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { HStack } from '@renderer/components/Layout'
import db from '@renderer/databases'
import { uuid } from '@renderer/utils'
import type { RegexReplacementRule } from '@renderer/utils/translationPostProcessors'
import { TRANSLATION_POST_PROCESSOR_SETTING_KEYS } from '@renderer/utils/translationPostProcessors'
import type { TableProps } from 'antd'
import { Button, Form, Input, Popconfirm, Space, Table, Typography } from 'antd'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingGroup, SettingTitle } from '..'

const { Text } = Typography

interface AddFormValues {
  pattern: string
  flags: string
  replacement: string
}

const RegexReplacementSettings = () => {
  const { t } = useTranslation()
  const [rules, setRules] = useState<RegexReplacementRule[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [patternError, setPatternError] = useState<string | undefined>()
  const [form] = Form.useForm<AddFormValues>()

  useEffect(() => {
    void (async () => {
      const entry = await db.settings.get({ id: TRANSLATION_POST_PROCESSOR_SETTING_KEYS.regexReplacementRules })
      if (entry && Array.isArray(entry.value)) {
        setRules(entry.value as RegexReplacementRule[])
      }
    })()
  }, [])

  const persistRules = useCallback(async (newRules: RegexReplacementRule[]) => {
    setRules(newRules)
    await db.settings.put({ id: TRANSLATION_POST_PROCESSOR_SETTING_KEYS.regexReplacementRules, value: newRules })
  }, [])

  const onDelete = useCallback(
    async (id: string) => {
      try {
        await persistRules(rules.filter((r) => r.id !== id))
        window.toast.success(t('settings.translate.regex_replacement.success.delete'))
      } catch {
        window.toast.error(t('settings.translate.regex_replacement.error.delete'))
      }
    },
    [persistRules, rules, t]
  )

  const validatePattern = (pattern: string, flags: string): boolean => {
    try {
      new RegExp(pattern, flags || undefined)
      return true
    } catch {
      return false
    }
  }

  const handleAddSubmit = useCallback(
    async (values: AddFormValues) => {
      const pattern = values.pattern.trim()
      const flags = values.flags?.trim() ?? ''
      const replacement = values.replacement ?? ''

      if (!validatePattern(pattern, flags)) {
        setPatternError(t('settings.translate.regex_replacement.error.invalid_pattern'))
        return
      }

      const newRule: RegexReplacementRule = {
        id: uuid(),
        pattern,
        flags,
        replacement
      }

      try {
        await persistRules([...rules, newRule])
        window.toast.success(t('settings.translate.regex_replacement.success.add'))
        setShowAddForm(false)
        form.resetFields()
        setPatternError(undefined)
      } catch {
        window.toast.error(t('settings.translate.regex_replacement.error.add'))
      }
    },
    [form, persistRules, rules, t]
  )

  const onCancelAdd = useCallback(() => {
    setShowAddForm(false)
    form.resetFields()
    setPatternError(undefined)
  }, [form])

  const columns: TableProps<RegexReplacementRule>['columns'] = useMemo(
    () => [
      {
        title: t('settings.translate.regex_replacement.pattern'),
        dataIndex: 'pattern',
        ellipsis: true,
        render: (v: string) => (
          <Text code style={{ fontSize: 12 }}>
            /{v}/
          </Text>
        )
      },
      {
        title: t('settings.translate.regex_replacement.flags'),
        dataIndex: 'flags',
        width: 70,
        render: (v: string) => <Text type="secondary">{v || '—'}</Text>
      },
      {
        title: t('settings.translate.regex_replacement.replacement'),
        dataIndex: 'replacement',
        ellipsis: true,
        render: (v: string) => (v ? <Text>{v}</Text> : <Text type="secondary">{'""'}</Text>)
      },
      {
        title: t('settings.translate.custom.table.action.title'),
        key: 'action',
        width: 80,
        render: (_, record) => (
          <Popconfirm
            title={t('settings.translate.regex_replacement.delete.title')}
            description={t('settings.translate.regex_replacement.delete.description')}
            onConfirm={() => onDelete(record.id)}>
            <Button type="text" size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        )
      }
    ],
    [onDelete, t]
  )

  return (
    <SettingGroup>
      <RegexContainer>
        <HStack justifyContent="space-between" style={{ padding: '4px 0' }}>
          <SettingTitle>{t('settings.translate.regex_replacement.title')}</SettingTitle>
          {!showAddForm && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowAddForm(true)}
              style={{ marginBottom: 5, marginTop: -5 }}>
              {t('common.add')}
            </Button>
          )}
        </HStack>

        {showAddForm && (
          <AddFormContainer>
            <Form
              form={form}
              onFinish={handleAddSubmit}
              validateTrigger="onBlur"
              colon={false}
              style={{ marginBottom: 4 }}>
              <HStack gap={8} alignItems="flex-start" style={{ flexWrap: 'wrap' }}>
                <Form.Item
                  name="pattern"
                  label={t('settings.translate.regex_replacement.pattern')}
                  style={{ flex: '3 1 160px', marginBottom: 8 }}
                  validateStatus={patternError ? 'error' : undefined}
                  help={patternError}
                  rules={[
                    {
                      required: true,
                      message: t('settings.translate.regex_replacement.error.pattern_required')
                    }
                  ]}>
                  <Input
                    placeholder={t('settings.translate.regex_replacement.pattern_placeholder')}
                    onChange={() => setPatternError(undefined)}
                  />
                </Form.Item>
                <Form.Item
                  name="flags"
                  label={t('settings.translate.regex_replacement.flags')}
                  initialValue="g"
                  style={{ flex: '1 1 60px', marginBottom: 8 }}>
                  <Input placeholder="gi" maxLength={10} />
                </Form.Item>
                <Form.Item
                  name="replacement"
                  label={t('settings.translate.regex_replacement.replacement')}
                  style={{ flex: '3 1 160px', marginBottom: 8 }}>
                  <Input placeholder={t('settings.translate.regex_replacement.replacement_placeholder')} />
                </Form.Item>
              </HStack>
              <Space>
                <Button type="primary" htmlType="submit">
                  {t('common.add')}
                </Button>
                <Button onClick={onCancelAdd}>{t('common.cancel')}</Button>
              </Space>
            </Form>
          </AddFormContainer>
        )}

        <TableContainer>
          <Table<RegexReplacementRule>
            columns={columns}
            dataSource={rules}
            rowKey="id"
            size="small"
            pagination={rules.length > 10 ? { position: ['bottomCenter'], defaultPageSize: 10, size: 'small' } : false}
          />
        </TableContainer>
      </RegexContainer>
    </SettingGroup>
  )
}

const RegexContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`

const AddFormContainer = styled.div`
  background: var(--color-background-soft);
  border: 0.5px solid var(--color-border);
  border-radius: 8px;
  padding: 12px 16px 4px;
  margin-bottom: 12px;
`

const TableContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;

  .ant-table-thead > tr > th,
  .ant-table-tbody > tr > td {
    padding-top: 8px;
    padding-bottom: 8px;
  }
`

export default memo(RegexReplacementSettings)
