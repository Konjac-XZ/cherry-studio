import { toast } from '@renderer/services/toast'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ProviderModelList from '../ProviderModelList'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<object>()

  return {
    ...actual,
    useTranslation: () => ({
      i18n: { language: 'en-US' },
      t: (key: string) => key
    })
  }
})

vi.mock('@cherrystudio/ui', async (importOriginal) => {
  const actual = await importOriginal<object>()

  return {
    ...actual,
    Tooltip: ({ children }: any) => <>{children}</>
  }
})

vi.mock('@renderer/components/VirtualList', () => ({
  DynamicVirtualList: ({ list, children, className, getItemKey }: any) => (
    <div className={className}>
      {list.map((item: unknown, index: number) => (
        <div key={getItemKey?.(index) ?? index}>{children(item, index)}</div>
      ))}
    </div>
  ),
  GroupedSortableVirtualList: ({ groups, renderGroupHeader }: any) => (
    <div>
      {groups.map(({ group, header }: any, index: number) => (
        <div key={index}>{renderGroupHeader(header, group, index)}</div>
      ))}
    </div>
  )
}))

vi.mock('../ModelDrawer', () => ({
  EditModelDrawer: () => null
}))

vi.mock('../modelListHealthContext', () => ({
  useModelListHealthRun: () => ({
    apiKeyEntries: [],
    savingKeyId: null,
    toggleApiKey: vi.fn()
  })
}))

const { groupNamesMock, modelListGroupMock, modelListStateMock, onRenameGroupMock, providerMetaState, searchTextMock } =
  vi.hoisted(() => ({
    groupNamesMock: { value: new Set(['OpenAI']) },
    modelListGroupMock: vi.fn(
      ({ groupName, onRenameGroup }: { groupName: string; onRenameGroup?: (groupName: string) => void }) => (
        <button type="button" onClick={() => onRenameGroup?.(groupName)}>
          {groupName}
        </button>
      )
    ),
    modelListStateMock: { hasNoModels: false, hasVisibleModels: true },
    onRenameGroupMock: vi.fn(),
    providerMetaState: {
      isApiKeyFieldVisible: true,
      provider: { id: 'openai', authOptional: false, apiKeys: [] as Array<{ id: string; isEnabled: boolean }> }
    },
    searchTextMock: { value: '' }
  }))

vi.mock('../../hooks/providerSetting/useProviderMeta', () => ({
  useProviderMeta: () => providerMetaState
}))

vi.mock('../ModelListGroup', () => ({
  default: modelListGroupMock
}))

vi.mock('../useProviderModelList', () => ({
  useProviderModelList: () => ({
    header: {
      modelCount: 1,
      hasVisibleModels: modelListStateMock.hasVisibleModels,
      hasNoModels: modelListStateMock.hasNoModels,
      searchText: searchTextMock.value,
      setSearchText: vi.fn()
    },
    sections: {
      isLoading: false,
      hasNoModels: modelListStateMock.hasNoModels,
      hasVisibleModels: modelListStateMock.hasVisibleModels,
      displayEnabledModelCount: 1,
      enabledSections: [{ groupName: 'OpenAI', items: [] }],
      disabled: false,
      reorderDisabled: false,
      pendingModelIds: new Set<string>(),
      defaultModelIds: new Set<string>(),
      groupNames: groupNamesMock.value,
      renameDisabled: false,
      onEditModel: vi.fn(),
      onDeleteModel: vi.fn(),
      onDeleteModels: vi.fn(),
      onRenameGroup: onRenameGroupMock,
      onUpdateLayout: vi.fn()
    },
    editDrawer: {
      open: false,
      model: null,
      onClose: vi.fn()
    }
  })
}))

describe('ProviderModelList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    modelListStateMock.hasNoModels = false
    modelListStateMock.hasVisibleModels = true
    groupNamesMock.value = new Set(['OpenAI'])
    onRenameGroupMock.mockResolvedValue(undefined)
    providerMetaState.provider = { id: 'openai', authOptional: false, apiKeys: [] }
    searchTextMock.value = ''
  })

  it('shows guidance to get models when the provider has no models', () => {
    modelListStateMock.hasNoModels = true
    modelListStateMock.hasVisibleModels = false

    render(<ProviderModelList providerId="openai" disabled={false} />)

    expect(screen.getByText('settings.models.empty')).toBeInTheDocument()
    expect(screen.getByText('settings.models.empty_hint')).toBeInTheDocument()
  })

  it('offers to continue setup when a required provider already has a saved key but no models', () => {
    modelListStateMock.hasNoModels = true
    modelListStateMock.hasVisibleModels = false
    providerMetaState.provider = { id: 'openai', authOptional: false, apiKeys: [{ id: 'key-1', isEnabled: true }] }
    const onContinueApiSetup = vi.fn()

    render(<ProviderModelList providerId="openai" disabled={false} onContinueApiSetup={onContinueApiSetup} />)

    expect(screen.getByText('settings.provider.api_setup.models_empty_hint')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'settings.provider.api_setup.continue_models' }))
    expect(onContinueApiSetup).toHaveBeenCalledTimes(1)
  })

  it('does not offer model setup when every saved key is disabled', () => {
    modelListStateMock.hasNoModels = true
    modelListStateMock.hasVisibleModels = false
    providerMetaState.provider = { id: 'openai', authOptional: false, apiKeys: [{ id: 'key-1', isEnabled: false }] }

    render(<ProviderModelList providerId="openai" disabled={false} onContinueApiSetup={vi.fn()} />)

    expect(
      screen.queryByRole('button', { name: 'settings.provider.api_setup.continue_models' })
    ).not.toBeInTheDocument()
  })

  it('renders model groups without section action rows', () => {
    render(<ProviderModelList providerId="openai" disabled={false} />)

    expect(screen.getAllByText('OpenAI')).toHaveLength(1)
    expect(screen.queryByText('settings.models.enabled_models')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'settings.models.more_actions' })).not.toBeInTheDocument()
  })

  it('passes collapsed state to model groups from the header toggle', () => {
    render(<ProviderModelList providerId="openai" disabled={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'settings.models.collapse_all' }))

    expect(modelListGroupMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: false
      }),
      undefined
    )
  })

  it('expands model groups when search text is active', () => {
    const { rerender } = render(<ProviderModelList providerId="openai" disabled={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'settings.models.collapse_all' }))

    expect(modelListGroupMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: false
      }),
      undefined
    )

    searchTextMock.value = 'gpt'
    rerender(<ProviderModelList providerId="openai" disabled={false} />)

    expect(modelListGroupMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true
      }),
      undefined
    )
  })

  it('renames a group to an unused name from the header action', async () => {
    render(<ProviderModelList providerId="openai" disabled={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'OpenAI' }))
    const dialog = screen.getByRole('dialog', { name: 'settings.models.manage.rename_group_title' })
    const input = within(dialog).getByLabelText('common.name')
    fireEvent.change(input, { target: { value: '  Renamed  ' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'settings.models.manage.rename_group' }))

    await waitFor(() => expect(onRenameGroupMock).toHaveBeenCalledWith('OpenAI', 'Renamed'))
    expect(screen.queryByRole('dialog', { name: 'settings.models.manage.merge_group_title' })).not.toBeInTheDocument()
  })

  it('requires confirmation before merging into an existing group', async () => {
    groupNamesMock.value = new Set(['OpenAI', 'Existing'])
    render(<ProviderModelList providerId="openai" disabled={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'OpenAI' }))
    const renameDialog = screen.getByRole('dialog', { name: 'settings.models.manage.rename_group_title' })
    fireEvent.change(within(renameDialog).getByLabelText('common.name'), { target: { value: 'Existing' } })
    fireEvent.click(within(renameDialog).getByRole('button', { name: 'settings.models.manage.rename_group' }))

    const mergeDialog = await screen.findByRole('dialog', { name: 'settings.models.manage.merge_group_title' })
    expect(onRenameGroupMock).not.toHaveBeenCalled()
    fireEvent.click(within(mergeDialog).getByRole('button', { name: 'common.cancel' }))
    expect(onRenameGroupMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'OpenAI' }))
    const secondRenameDialog = screen.getByRole('dialog', { name: 'settings.models.manage.rename_group_title' })
    fireEvent.change(within(secondRenameDialog).getByLabelText('common.name'), { target: { value: 'Existing' } })
    fireEvent.click(within(secondRenameDialog).getByRole('button', { name: 'settings.models.manage.rename_group' }))
    const secondMergeDialog = await screen.findByRole('dialog', { name: 'settings.models.manage.merge_group_title' })
    fireEvent.click(
      within(secondMergeDialog).getByRole('button', { name: 'settings.models.manage.merge_group_confirm' })
    )

    await waitFor(() => expect(onRenameGroupMock).toHaveBeenCalledWith('OpenAI', 'Existing'))
  })

  it('shows rename-specific feedback when persistence fails', async () => {
    onRenameGroupMock.mockRejectedValueOnce(new Error('rename failed'))
    render(<ProviderModelList providerId="openai" disabled={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'OpenAI' }))
    const dialog = screen.getByRole('dialog', { name: 'settings.models.manage.rename_group_title' })
    fireEvent.change(within(dialog).getByLabelText('common.name'), { target: { value: 'Renamed' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'settings.models.manage.rename_group' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('settings.models.manage.group_rename_failed'))
  })
})
