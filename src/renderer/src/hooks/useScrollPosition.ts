import { throttle } from 'lodash'
import { useEffect, useRef } from 'react'

export default function useScrollPosition(key: string) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollKey = `scroll:${key}`
  // const logger = loggerService.withContext('useScrollPosition')

  const handleScroll = throttle(() => {
    const position = containerRef.current?.scrollTop ?? 0
    window.requestAnimationFrame(() => {
      window.keyv.set(scrollKey, position)
    })
  }, 100)

  useEffect(() => {
    if (containerRef.current) {
      const scroll = () => {
        containerRef.current?.scrollTo({ top: window.keyv.get(scrollKey) || 0 })
      }
      scroll()
      const timer = setTimeout(() => {
        scroll()
      }, 100)
      return () => clearTimeout(timer)
    }
    return
  }, [scrollKey])

  return { containerRef, handleScroll }
}
