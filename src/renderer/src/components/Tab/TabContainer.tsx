import { PlusOutlined } from '@ant-design/icons'
import { Sortable, useDndReorder } from '@renderer/components/dnd'
import Scrollbar from '@renderer/components/Scrollbar'
import { isLinux, isMac, isWin } from '@renderer/config/constant'
import { DEFAULT_MIN_APPS } from '@renderer/config/minapps'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useFullscreen } from '@renderer/hooks/useFullscreen'
import { useMinappPopup } from '@renderer/hooks/useMinappPopup'
import { useMinapps } from '@renderer/hooks/useMinapps'
import { getThemeModeLabel, getTitleLabel } from '@renderer/i18n/label'
import tabsService from '@renderer/services/TabsService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import type { Tab } from '@renderer/store/tabs'
import { addTab, removeTab, setActiveTab, setTabs } from '@renderer/store/tabs'
import { ThemeMode } from '@renderer/types'
import { classNames } from '@renderer/utils'
import { Button, Tooltip } from 'antd'
import {
  ChevronRight,
  FileSearch,
  Folder,
  Hammer,
  Home,
  Languages,
  LayoutGrid,
  Monitor,
  Moon,
  NotepadText,
  Palette,
  Settings,
  Sparkle,
  Sun,
  Terminal,
  X
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import MinAppIcon from '../Icons/MinAppIcon'
import WindowControls from '../WindowControls'

interface TabsContainerProps {
  children: React.ReactNode
}

const getTabIcon = (tabId: string, minapps: any[]): React.ReactNode | undefined => {
  // Check if it's a minapp tab (format: apps:appId)
  if (tabId.startsWith('apps:')) {
    const appId = tabId.replace('apps:', '')
    const app = [...DEFAULT_MIN_APPS, ...minapps].find((app) => app.id === appId)
    if (app) {
      return <MinAppIcon size={14} app={app} />
    }
  }

  switch (tabId) {
    case 'home':
      return <Home size={14} />
    case 'agents':
      return <Sparkle size={14} />
    case 'translate':
      return <Languages size={14} />
    case 'paintings':
      return <Palette size={14} />
    case 'apps':
      return <LayoutGrid size={14} />
    case 'notes':
      return <NotepadText size={14} />
    case 'knowledge':
      return <FileSearch size={14} />
    case 'mcp':
      return <Hammer size={14} />
    case 'files':
      return <Folder size={14} />
    case 'settings':
      return <Settings size={14} />
    case 'code':
      return <Terminal size={14} />
    default:
      return null
  }
}

let lastSettingsPath = '/settings/provider'
const specialTabs = ['launchpad', 'settings']

const TabsContainer: React.FC<TabsContainerProps> = ({ children }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const tabs = useAppSelector((state) => state.tabs.tabs)
  const activeTabId = useAppSelector((state) => state.tabs.activeTabId)
  const isFullscreen = useFullscreen()
  const { settedTheme, toggleTheme } = useTheme()
  const { hideMinappPopup } = useMinappPopup()
  const { minapps } = useMinapps()
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScroll, setCanScroll] = useState(false)

  const getTabId = (path: string): string => {
    if (path === '/') return 'home'
    const segments = path.split('/')
    // Handle minapp paths: /apps/appId -> apps:appId
    if (segments[1] === 'apps' && segments[2]) {
      return `apps:${segments[2]}`
    }
    return segments[1] // 获取第一个路径段作为 id
  }

  const getTabTitle = (tabId: string): string => {
    // Check if it's a minapp tab
    if (tabId.startsWith('apps:')) {
      const appId = tabId.replace('apps:', '')
      const app = [...DEFAULT_MIN_APPS, ...minapps].find((app) => app.id === appId)
      return app ? app.name : 'MinApp'
    }
    return getTitleLabel(tabId)
  }

  const shouldCreateTab = (path: string) => {
    if (path === '/') return false
    if (path === '/settings') return false
    return !tabs.some((tab) => tab.id === getTabId(path))
  }

  const removeSpecialTabs = useCallback(() => {
    specialTabs.forEach((tabId) => {
      if (activeTabId !== tabId) {
        dispatch(removeTab(tabId))
      }
    })
  }, [activeTabId, dispatch])

  useEffect(() => {
    const tabId = getTabId(location.pathname)
    const currentTab = tabs.find((tab) => tab.id === tabId)

    if (!currentTab && shouldCreateTab(location.pathname)) {
      dispatch(addTab({ id: tabId, path: location.pathname }))
    } else if (currentTab) {
      dispatch(setActiveTab(currentTab.id))
    }

    // 当访问设置页面时，记录路径
    if (location.pathname.startsWith('/settings/')) {
      lastSettingsPath = location.pathname
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, location.pathname])

  useEffect(() => {
    removeSpecialTabs()
  }, [removeSpecialTabs])

  const closeTab = (tabId: string) => {
    tabsService.closeTab(tabId)
  }

  const handleAddTab = () => {
    hideMinappPopup()
    navigate('/launchpad')
  }

  const handleSettingsClick = () => {
    hideMinappPopup()
    navigate(lastSettingsPath)
  }

  const handleTabClick = (tab: Tab) => {
    hideMinappPopup()
    navigate(tab.path)
  }

  const handleScrollRight = () => {
    scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })
  }

  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    const checkScrollability = () => {
      setCanScroll(scrollElement.scrollWidth > scrollElement.clientWidth)
    }

    checkScrollability()

    const resizeObserver = new ResizeObserver(checkScrollability)
    resizeObserver.observe(scrollElement)

    window.addEventListener('resize', checkScrollability)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', checkScrollability)
    }
  }, [tabs])

  const visibleTabs = useMemo(() => tabs.filter((tab) => !specialTabs.includes(tab.id)), [tabs])

  const { onSortEnd } = useDndReorder<Tab>({
    originalList: tabs,
    filteredList: visibleTabs,
    onUpdate: (newTabs) => dispatch(setTabs(newTabs)),
    itemKey: 'id'
  })

  return (
    <Container>
      <TabsBar $isFullscreen={isFullscreen}>
        <TabsArea>
          <TabsScroll ref={scrollRef}>
            <Sortable
              items={visibleTabs}
              itemKey="id"
              layout="list"
              horizontal
              gap={'6px'}
              onSortEnd={onSortEnd}
              className="tabs-sortable"
              renderItem={(tab) => (
                <Tab key={tab.id} active={tab.id === activeTabId} onClick={() => handleTabClick(tab)}>
                  <TabHeader>
                    {tab.id && <TabIcon>{getTabIcon(tab.id, minapps)}</TabIcon>}
                    <TabTitle>{getTabTitle(tab.id)}</TabTitle>
                  </TabHeader>
                  {tab.id !== 'home' && (
                    <CloseButton
                      className="close-button"
                      data-no-dnd
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(tab.id)
                      }}>
                      <X size={12} />
                    </CloseButton>
                  )}
                </Tab>
              )}
            />
          </TabsScroll>
          {canScroll && (
            <ScrollButton onClick={handleScrollRight} className="scroll-right-button" shape="circle" size="small">
              <ChevronRight size={16} />
            </ScrollButton>
          )}
          <AddTabButton onClick={handleAddTab} className={classNames({ active: activeTabId === 'launchpad' })}>
            <PlusOutlined />
          </AddTabButton>
        </TabsArea>
        <RightButtonsContainer>
          <Tooltip
            title={t('settings.theme.title') + ': ' + getThemeModeLabel(settedTheme)}
            mouseEnterDelay={0.8}
            placement="bottom">
            <ThemeButton onClick={toggleTheme}>
              {settedTheme === ThemeMode.dark ? (
                <Moon size={16} />
              ) : settedTheme === ThemeMode.light ? (
                <Sun size={16} />
              ) : (
                <Monitor size={16} />
              )}
            </ThemeButton>
          </Tooltip>
          <SettingsButton onClick={handleSettingsClick} $active={activeTabId === 'settings'}>
            <Settings size={16} />
          </SettingsButton>
          <WindowControls />
        </RightButtonsContainer>
      </TabsBar>
      <TabContent>{children}</TabContent>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`

const TabsBar = styled.div<{ $isFullscreen: boolean }>`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 5px;
  padding-left: ${({ $isFullscreen }) => (!$isFullscreen && isMac ? 'env(titlebar-area-x)' : '15px')};
  padding-right: ${({ $isFullscreen }) => ($isFullscreen ? '12px' : isWin ? '140px' : isLinux ? '120px' : '12px')};
  height: var(--navbar-height);
  min-height: env(titlebar-area-height);
  position: relative;
  -webkit-app-region: drag;

  /* 确保交互元素在拖拽区域之上 */
  > * {
    position: relative;
    z-index: 1;
    -webkit-app-region: no-drag;
  }
`

const TabsArea = styled.div`
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  gap: 6px;
  padding-right: 2rem;
  position: relative;

  -webkit-app-region: drag;

  > * {
    -webkit-app-region: no-drag;
  }

  &:hover {
    .scroll-right-button {
      opacity: 1;
    }
  }
`

const TabsScroll = styled(Scrollbar)`
  &::-webkit-scrollbar {
    display: none;
  }
`

const Tab = styled.div<{ active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  padding-right: 8px;
  background: ${(props) => (props.active ? 'var(--color-list-item)' : 'transparent')};
  transition: background 0.2s;
  border-radius: var(--list-item-border-radius);
  user-select: none;
  height: 30px;
  min-width: 90px;

  .close-button {
    opacity: 0;
    transition: opacity 0.2s;
  }

  &:hover {
    background: ${(props) => (props.active ? 'var(--color-list-item)' : 'var(--color-list-item)')};
    .close-button {
      opacity: 1;
    }
  }
`

const TabHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
`

const TabIcon = styled.span`
  display: flex;
  align-items: center;
  color: var(--color-text-2);
  flex-shrink: 0;
`

const TabTitle = styled.span`
  color: var(--color-text);
  font-size: 13px;
  display: flex;
  align-items: center;
  margin-right: 4px;
  overflow: hidden;
  white-space: nowrap;
`

const CloseButton = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
`

const AddTabButton = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  cursor: pointer;
  color: var(--color-text-2);
  border-radius: var(--list-item-border-radius);
  flex-shrink: 0;
  &.active {
    background: var(--color-list-item);
  }
  &:hover {
    background: var(--color-list-item);
  }
`

const ScrollButton = styled(Button)`
  position: absolute;
  right: 4rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;

  border: none;
  box-shadow:
    0 6px 16px 0 rgba(0, 0, 0, 0.08),
    0 3px 6px -4px rgba(0, 0, 0, 0.12),
    0 9px 28px 8px rgba(0, 0, 0, 0.05);
`

const RightButtonsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  padding-right: ${isMac ? '12px' : '0'};
  flex-shrink: 0;
`

const ThemeButton = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  cursor: pointer;
  color: var(--color-text);

  &:hover {
    background: var(--color-list-item);
    border-radius: 8px;
  }
`

const SettingsButton = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  cursor: pointer;
  color: var(--color-text);
  border-radius: 8px;
  background: ${(props) => (props.$active ? 'var(--color-list-item)' : 'transparent')};
  &:hover {
    background: var(--color-list-item);
  }
`

const TabContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
  width: calc(100vw - 12px);
  margin: 6px;
  margin-top: 0;
  border-radius: 8px;
  overflow: hidden;
`

export default TabsContainer
