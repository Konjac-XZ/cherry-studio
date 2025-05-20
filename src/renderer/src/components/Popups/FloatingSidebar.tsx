import HomeTabs from '@renderer/pages/home/Tabs/index'
import { Assistant, Topic } from '@renderer/types'
import { Popover } from 'antd'
import { FC, useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import styled from 'styled-components'

import Scrollbar from '../Scrollbar'

interface Props {
  children: React.ReactNode
  activeAssistant: Assistant
  setActiveAssistant: (assistant: Assistant) => void
  activeTopic: Topic
  setActiveTopic: (topic: Topic) => void
  position: 'left' | 'right'
}

const FloatingSidebar: FC<Props> = ({
  children,
  activeAssistant,
  setActiveAssistant,
  activeTopic,
  setActiveTopic,
  position = 'left'
}) => {
  const [open, setOpen] = useState(false)

  useHotkeys('esc', () => {
    setOpen(false)
  })

  const [maxHeight, setMaxHeight] = useState(Math.floor(window.innerHeight * 0.75))

  useEffect(() => {
    const handleResize = () => {
      setMaxHeight(Math.floor(window.innerHeight * 0.75))
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const content = (
    <PopoverContent maxHeight={maxHeight}>
      <HomeTabs
        activeAssistant={activeAssistant}
        activeTopic={activeTopic}
        setActiveAssistant={setActiveAssistant}
        setActiveTopic={setActiveTopic}
        position={position}
        forceToSeeAllTab={true}></HomeTabs>
    </PopoverContent>
  )

  return (
    <Popover
      open={open}
      onOpenChange={(visible) => {
        setOpen(visible)
      }}
      content={content}
      trigger={['hover', 'click']}
      placement="bottomRight"
      arrow={false}
      mouseEnterDelay={0.8} // 800ms delay before showing
      mouseLeaveDelay={20}
      styles={{
        body: {
          padding: 0,
          background: 'var(--color-background)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12)'
        }
      }}>
      {children}
    </Popover>
  )
}

const PopoverContent = styled(Scrollbar)<{ maxHeight: number }>`
  max-height: ${(props) => props.maxHeight}px;
  overflow-y: auto;
`

export default FloatingSidebar
