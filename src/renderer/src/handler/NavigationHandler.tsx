import { useMinappPopup } from '@renderer/hooks/useMinappPopup'
import { useShortcut } from '@renderer/hooks/useShortcuts'
import { useAppSelector } from '@renderer/store'
import { IpcChannel } from '@shared/IpcChannel'
import { useCallback, useEffect } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useLocation, useNavigate } from 'react-router-dom'

const NavigationHandler: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { hideMinappPopup } = useMinappPopup()
  const showSettingsShortcutEnabled = useAppSelector(
    (state) => state.shortcuts.shortcuts.find((s) => s.key === 'show_settings')?.enabled
  )

  useHotkeys(
    'meta+, ! ctrl+,',
    function () {
      if (location.pathname.startsWith('/settings')) {
        return
      }
      navigate('/settings/provider')
    },
    {
      splitKey: '!',
      enableOnContentEditable: true,
      enableOnFormTags: true,
      enabled: showSettingsShortcutEnabled
    }
  )

  const goHome = useCallback(() => {
    hideMinappPopup()
    navigate('/')
  }, [hideMinappPopup, navigate])

  useShortcut('go_home', goHome)

  useEffect(() => {
    const removeListener = window.electron.ipcRenderer.on(IpcChannel.Windows_NavigateHome, goHome)

    return () => {
      removeListener()
    }
  }, [goHome])

  // Listen for navigate to About page event from macOS menu
  useEffect(() => {
    const handleNavigateToAbout = () => {
      navigate('/settings/about')
    }

    const removeListener = window.electron.ipcRenderer.on(IpcChannel.Windows_NavigateToAbout, handleNavigateToAbout)

    return () => {
      removeListener()
    }
  }, [navigate])

  return null
}

export default NavigationHandler
