import { Textarea } from '@heroui/react'
import { AgentBaseWithId, UpdateAgentBaseForm } from '@renderer/types'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SettingsItem, SettingsTitle } from './shared'

export interface DescriptionSettingProps {
  base: AgentBaseWithId | undefined | null
  update: (form: UpdateAgentBaseForm) => Promise<void>
}

export const DescriptionSetting: React.FC<DescriptionSettingProps> = ({ base, update }) => {
  const { t } = useTranslation()
  const [description, setDescription] = useState<string | undefined>(base?.description?.trim())

  const updateDesc = useCallback(
    (description: UpdateAgentBaseForm['description']) => {
      if (!base) return
      update({ id: base.id, description })
    },
    [base, update]
  )
  if (!base) return null

  return (
    <SettingsItem>
      <SettingsTitle>{t('common.description')}</SettingsTitle>
      <Textarea
        value={description}
        onValueChange={setDescription}
        onBlur={() => {
          if (description !== base.description) {
            updateDesc(description)
          }
        }}
      />
    </SettingsItem>
  )
}
