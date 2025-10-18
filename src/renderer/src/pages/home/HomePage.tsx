import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { useAgentSessionInitializer } from '@renderer/hooks/agents/useAgentSessionInitializer'
import { useAssistants } from '@renderer/hooks/useAssistant'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { useNavbarPosition, useSettings } from '@renderer/hooks/useSettings'
import { useShortcut } from '@renderer/hooks/useShortcuts'
import { useAssistantsTabSortType } from '@renderer/hooks/useStore'
import { useTags } from '@renderer/hooks/useTags'
import { useActiveTopic } from '@renderer/hooks/useTopic'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import NavigationService from '@renderer/services/NavigationService'
import { newMessagesActions } from '@renderer/store/newMessage'
import { setActiveAgentId, setActiveTopicOrSessionAction } from '@renderer/store/runtime'
import { Assistant, Topic } from '@renderer/types'
import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, SECOND_MIN_WINDOW_WIDTH } from '@shared/config/constant'
import { AnimatePresence, motion } from 'motion/react'
import { FC, startTransition, useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import Chat from './Chat'
import Navbar from './Navbar'
import HomeTabs from './Tabs'

let _activeAssistant: Assistant

const HomePage: FC = () => {
  const { assistants } = useAssistants()
  const navigate = useNavigate()
  const { isLeftNavbar } = useNavbarPosition()

  // Initialize agent session hook
  useAgentSessionInitializer()

  const location = useLocation()
  const state = location.state

  const [activeAssistant, _setActiveAssistant] = useState(state?.assistant || _activeAssistant || assistants[0])
  const { activeTopic, setActiveTopic: _setActiveTopic } = useActiveTopic(activeAssistant?.id, state?.topic)
  const { showAssistants, showTopics, topicPosition } = useSettings()
  const { assistantsTabSortType } = useAssistantsTabSortType()
  const { collapsedTags, getGroupedAssistants: groupedAssistants } = useTags()
  const dispatch = useDispatch()
  const { chat } = useRuntime()
  const { activeTopicOrSession } = chat

  _activeAssistant = activeAssistant

  const { orderedAssistantIds, visibleAssistantIds } = useMemo(() => {
    if (!assistants.length) {
      return { orderedAssistantIds: [] as string[], visibleAssistantIds: [] as string[] }
    }

    if (assistantsTabSortType !== 'tags') {
      const ids = assistants.map((assistant) => assistant.id)
      return { orderedAssistantIds: ids, visibleAssistantIds: ids }
    }

    const ordered: string[] = []
    const visible: string[] = []
    const seenOrdered = new Set<string>()
    const seenVisible = new Set<string>()

    groupedAssistants.forEach(({ tag, assistants: groupAssistants }) => {
      const isCollapsed = !!collapsedTags?.[tag]

      groupAssistants.forEach((assistant) => {
        if (!seenOrdered.has(assistant.id)) {
          seenOrdered.add(assistant.id)
          ordered.push(assistant.id)
        }
        if (!isCollapsed && !seenVisible.has(assistant.id)) {
          seenVisible.add(assistant.id)
          visible.push(assistant.id)
        }
      })
    })

    if (!ordered.length) {
      const fallback = assistants.map((assistant) => assistant.id)
      return { orderedAssistantIds: fallback, visibleAssistantIds: fallback }
    }

    if (!visible.length) {
      return { orderedAssistantIds: ordered, visibleAssistantIds: [] }
    }

    return { orderedAssistantIds: ordered, visibleAssistantIds: visible }
  }, [assistants, assistantsTabSortType, collapsedTags, groupedAssistants])

  const setActiveAssistant = useCallback(
    (newAssistant: Assistant) => {
      if (newAssistant.id === activeAssistant.id) return
      startTransition(() => {
        _setActiveAssistant(newAssistant)
        // 同步更新 active topic，避免不必要的重新渲染
        const newTopic = newAssistant.topics[0]
        _setActiveTopic((prev) => (newTopic?.id === prev.id ? prev : newTopic))
      })
    },
    [_setActiveTopic, activeAssistant]
  )

  const setActiveTopic = useCallback(
    (newTopic: Topic) => {
      startTransition(() => {
        _setActiveTopic((prev) => (newTopic?.id === prev.id ? prev : newTopic))
        dispatch(newMessagesActions.setTopicFulfilled({ topicId: newTopic.id, fulfilled: false }))
        dispatch(setActiveTopicOrSessionAction('topic'))
      })
    },
    [_setActiveTopic, dispatch]
  )

  const handleAssistantSwitch = useCallback(
    (direction: 'previous' | 'next') => {
      if (!assistants.length || !activeAssistant?.id) {
        return
      }

      let order = orderedAssistantIds.length ? orderedAssistantIds : assistants.map((assistant) => assistant.id)
      if (!order.length) {
        return
      }

      const isTagView = assistantsTabSortType === 'tags'
      const visible = visibleAssistantIds.length || isTagView ? visibleAssistantIds : order
      const visibleSet = new Set(visible)

      if (visibleSet.size === 0) {
        return
      }

      if (visibleSet.size === 1) {
        const onlyId = visibleSet.values().next().value as string | undefined
        if (onlyId === undefined || onlyId === activeAssistant.id) {
          return
        }
      }

      let currentIndex = order.indexOf(activeAssistant.id)
      if (currentIndex === -1) {
        order = assistants.map((assistant) => assistant.id)
        if (!order.length) {
          return
        }
        currentIndex = order.indexOf(activeAssistant.id)
      }

      if (currentIndex === -1) {
        return
      }

      const offset = direction === 'next' ? 1 : -1
      const total = order.length
      let index = currentIndex

      for (let step = 0; step < total; step++) {
        index = (index + offset + total) % total
        const candidateId = order[index]

        if (candidateId === activeAssistant.id) {
          continue
        }

        if (visibleSet.has(candidateId)) {
          const targetAssistant = assistants.find((assistant) => assistant.id === candidateId)

          if (targetAssistant) {
            setActiveAssistant(targetAssistant)
          }
          break
        }
      }
    },
    [activeAssistant?.id, assistants, assistantsTabSortType, orderedAssistantIds, setActiveAssistant, visibleAssistantIds]
  )

  useShortcut('previous_assistant', () => handleAssistantSwitch('previous'))
  useShortcut('next_assistant', () => handleAssistantSwitch('next'))

  useEffect(() => {
    NavigationService.setNavigate(navigate)
  }, [navigate])

  useEffect(() => {
    state?.assistant && setActiveAssistant(state?.assistant)
    state?.topic && setActiveTopic(state?.topic)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  useEffect(() => {
    const unsubscribe = EventEmitter.on(EVENT_NAMES.SWITCH_ASSISTANT, (assistantId: string) => {
      const newAssistant = assistants.find((a) => a.id === assistantId)
      if (newAssistant) {
        setActiveAssistant(newAssistant)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [assistants, setActiveAssistant])

  useEffect(() => {
    const canMinimize = topicPosition == 'left' ? !showAssistants : !showAssistants && !showTopics
    window.api.window.setMinimumSize(canMinimize ? SECOND_MIN_WINDOW_WIDTH : MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)

    return () => {
      window.api.window.resetMinimumSize()
    }
  }, [showAssistants, showTopics, topicPosition])

  useEffect(() => {
    if (activeTopicOrSession === 'session') {
      setActiveAssistant({
        id: 'fake',
        name: '',
        prompt: '',
        topics: [
          {
            id: 'fake',
            assistantId: 'fake',
            name: 'fake',
            createdAt: '',
            updatedAt: '',
            messages: []
          } as unknown as Topic
        ],
        type: 'chat'
      })
    } else if (activeTopicOrSession === 'topic') {
      dispatch(setActiveAgentId(null))
    }
  }, [activeTopicOrSession, dispatch, setActiveAssistant])

  return (
    <Container id="home-page">
      {isLeftNavbar && (
        <Navbar
          activeAssistant={activeAssistant}
          activeTopic={activeTopic}
          setActiveTopic={setActiveTopic}
          setActiveAssistant={setActiveAssistant}
          position="left"
          activeTopicOrSession={activeTopicOrSession}
        />
      )}
      <ContentContainer id={isLeftNavbar ? 'content-container' : undefined}>
        <AnimatePresence initial={false}>
          {showAssistants && (
            <ErrorBoundary>
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'var(--assistants-width)', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}>
                <HomeTabs
                  activeAssistant={activeAssistant}
                  activeTopic={activeTopic}
                  setActiveAssistant={setActiveAssistant}
                  setActiveTopic={setActiveTopic}
                  position="left"
                />
              </motion.div>
            </ErrorBoundary>
          )}
        </AnimatePresence>
        <ErrorBoundary>
          <Chat
            assistant={activeAssistant}
            activeTopic={activeTopic}
            setActiveTopic={setActiveTopic}
            setActiveAssistant={setActiveAssistant}
          />
        </ErrorBoundary>
      </ContentContainer>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  [navbar-position='left'] & {
    max-width: calc(100vw - var(--sidebar-width));
  }
  [navbar-position='top'] & {
    max-width: 100vw;
  }
`

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  overflow: hidden;
`

export default HomePage
