import { ButtonGroup } from '@cherrystudio/ui'
import React, { memo, useState } from 'react'

import { modelListClasses } from '../primitives/ProviderSettingsPrimitives'
import { useModelListHealthRun } from './modelListHealthContext'
import ProviderModelAdd from './ProviderModelAdd'
import ProviderModelDownload from './ProviderModelDownload'
import ProviderModelList from './ProviderModelList'
import ProviderModelPullReconcile from './ProviderModelPullReconcile'

interface ModelListProps {
  providerId: string
  modelPullGuideVersion?: number
}

function ModelListContent({
  providerId,
  modelPullGuideVersion = 0
}: {
  providerId: string
  modelPullGuideVersion?: number
}) {
  const { isModelChecking } = useModelListHealthRun()
  const [isModelSyncing, setIsModelSyncing] = useState(false)
  const disabled = isModelChecking || isModelSyncing

  return (
    <>
      <ProviderModelList
        providerId={providerId}
        disabled={disabled}
        actions={({ disabled: toolbarDisabled }) => (
          <ButtonGroup className={modelListClasses.toolbarButtonGroup}>
            <ProviderModelPullReconcile
              providerId={providerId}
              disabled={toolbarDisabled}
              guideVersion={modelPullGuideVersion}
              onBusyChange={setIsModelSyncing}
            />
            {providerId === 'ovms' ? (
              <ProviderModelDownload providerId={providerId} disabled={toolbarDisabled} />
            ) : (
              <ProviderModelAdd providerId={providerId} disabled={toolbarDisabled} />
            )}
          </ButtonGroup>
        )}
      />
    </>
  )
}

const ModelList: React.FC<ModelListProps> = ({ providerId, modelPullGuideVersion = 0 }) => {
  return (
    <div className={modelListClasses.cqRoot}>
      <section data-testid="provider-model-list" className={modelListClasses.section}>
        <ModelListContent providerId={providerId} modelPullGuideVersion={modelPullGuideVersion} />
      </section>
    </div>
  )
}

export default memo(ModelList)
