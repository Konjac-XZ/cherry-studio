import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import LanguageSelect from '@renderer/components/LanguageSelect'
import { HStack } from '@renderer/components/Layout'
import useTranslate from '@renderer/hooks/useTranslate'
import { GlossaryService } from '@renderer/services/GlossaryService'
import type { GlossaryEntry, TranslateLanguageCode } from '@renderer/types'
import type { TableProps } from 'antd'
import { Button, Form, Input, Modal, Popconfirm, Space, Table } from 'antd'
import { memo, startTransition, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingGroup, SettingTitle } from '..'

const logger = loggerService.withContext('GlossarySettings')

interface GlossaryFormValues {
  sourcePhrase: string
  targetPhrase: string
  targetLanguage: TranslateLanguageCode
}

const GlossarySettings = () => {
  const { t } = useTranslation()
  const { getLanguageByLangcode } = useTranslate()
  const [entries, setEntries] = useState<GlossaryEntry[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<GlossaryEntry>()
  const [form] = Form.useForm<GlossaryFormValues>()

  const onDelete = useCallback(
    async (id: string) => {
      try {
        await GlossaryService.delete(id)
        setEntries((prev) => prev.filter((item) => item.id !== id))
        window.toast.success(t('settings.translate.glossary.success.delete'))
      } catch {
        window.toast.error(t('settings.translate.glossary.error.delete'))
      }
    },
    [t]
  )

  const onClickAdd = () => {
    startTransition(() => {
      setEditingEntry(undefined)
      form.resetFields()
      setIsModalOpen(true)
    })
  }

  const onClickEdit = (entry: GlossaryEntry) => {
    startTransition(() => {
      setEditingEntry(entry)
      form.setFieldsValue({
        sourcePhrase: entry.sourcePhrase,
        targetPhrase: entry.targetPhrase,
        targetLanguage: entry.targetLanguage
      })
      setIsModalOpen(true)
    })
  }

  const onCancel = () => {
    startTransition(() => {
      setIsModalOpen(false)
    })
  }

  const handleSubmit = useCallback(
    async (values: GlossaryFormValues) => {
      if (editingEntry) {
        try {
          await GlossaryService.update(editingEntry.id, values)
          setEntries((prev) =>
            prev.map((item) => (item.id === editingEntry.id ? { ...item, ...values, updatedAt: Date.now() } : item))
          )
          window.toast.success(t('settings.translate.glossary.success.update'))
        } catch {
          window.toast.error(t('settings.translate.glossary.error.update'))
        }
      } else {
        try {
          const added = await GlossaryService.add(values)
          setEntries((prev) => [added, ...prev])
          window.toast.success(t('settings.translate.glossary.success.add'))
        } catch (e) {
          if ((e as Error).message === 'DUPLICATE_ENTRY') {
            window.toast.error(t('settings.translate.glossary.error.duplicate'))
          } else {
            window.toast.error(t('settings.translate.glossary.error.add'))
          }
        }
      }
      setIsModalOpen(false)
    },
    [editingEntry, t]
  )

  const columns: TableProps<GlossaryEntry>['columns'] = useMemo(
    () => [
      {
        title: t('settings.translate.glossary.source'),
        dataIndex: 'sourcePhrase',
        ellipsis: true
      },
      {
        title: t('settings.translate.glossary.target'),
        dataIndex: 'targetPhrase',
        ellipsis: true
      },
      {
        title: t('settings.translate.glossary.language'),
        dataIndex: 'targetLanguage',
        width: 180,
        render: (langCode: TranslateLanguageCode) => {
          const language = getLanguageByLangcode(langCode)
          return `${language.emoji} ${language.label()}`
        }
      },
      {
        title: t('settings.translate.custom.table.action.title'),
        key: 'action',
        width: 96,
        render: (_, record) => {
          return (
            <Space>
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onClickEdit(record)} />
              <Popconfirm
                title={t('settings.translate.glossary.delete.title')}
                description={t('settings.translate.glossary.delete.description')}
                onConfirm={() => onDelete(record.id)}>
                <Button type="text" size="small" icon={<DeleteOutlined />} danger />
              </Popconfirm>
            </Space>
          )
        }
      }
    ],
    [getLanguageByLangcode, onDelete, t]
  )

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await GlossaryService.getAll()
        setEntries(data)
      } catch (error) {
        logger.error('Failed to load glossary entries:', error as Error)
      }
    }
    void loadData()
  }, [])

  const formItemLayout = {
    labelCol: { span: 8 },
    wrapperCol: { span: 16 }
  }

  const footer = useMemo(() => {
    return [
      <Button key="modal-cancel" onClick={onCancel}>
        {t('common.cancel')}
      </Button>,
      <Button key="modal-save" type="primary" onClick={form.submit}>
        {editingEntry ? t('common.save') : t('common.add')}
      </Button>
    ]
  }, [editingEntry, form.submit, t])

  return (
    <>
      <SettingGroup>
        <GlossarySettingsContainer>
          <HStack justifyContent="space-between" style={{ padding: '4px 0' }}>
            <SettingTitle>{t('settings.translate.glossary.title')}</SettingTitle>
            <Button
              type="primary"
              icon={<PlusOutlined size={16} />}
              onClick={onClickAdd}
              style={{ marginBottom: 5, marginTop: -5 }}>
              {t('common.add')}
            </Button>
          </HStack>
          <TableContainer>
            <Table<GlossaryEntry>
              columns={columns}
              pagination={{ position: ['bottomCenter'], defaultPageSize: 10, size: 'small' }}
              dataSource={entries}
              rowKey="id"
              size="small"
            />
          </TableContainer>
        </GlossarySettingsContainer>
      </SettingGroup>
      <Modal
        open={isModalOpen}
        title={editingEntry ? t('common.edit') : t('common.add')}
        footer={footer}
        onCancel={onCancel}
        maskClosable={false}
        transitionName="animation-move-down"
        forceRender
        centered
        styles={{ body: { padding: '20px' } }}>
        <Form form={form} onFinish={handleSubmit} validateTrigger="onBlur" colon={false}>
          <Form.Item
            name="sourcePhrase"
            label={t('settings.translate.glossary.source')}
            {...formItemLayout}
            rules={[{ required: true, message: t('settings.translate.glossary.error.source_empty') }]}>
            <Input placeholder={t('settings.translate.glossary.source_placeholder')} />
          </Form.Item>
          <Form.Item
            name="targetPhrase"
            label={t('settings.translate.glossary.target')}
            {...formItemLayout}
            rules={[{ required: true, message: t('settings.translate.glossary.error.target_empty') }]}>
            <Input placeholder={t('settings.translate.glossary.target_placeholder')} />
          </Form.Item>
          <Form.Item
            name="targetLanguage"
            label={t('settings.translate.glossary.language')}
            {...formItemLayout}
            rules={[{ required: true, message: t('settings.translate.glossary.error.language_empty') }]}>
            <LanguageSelect style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

const GlossarySettingsContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
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

export default memo(GlossarySettings)
