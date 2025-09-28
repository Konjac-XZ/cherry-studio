// import { useRuntime } from '@renderer/hooks/useRuntime'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import type { Message } from '@renderer/types/newMessage'
import { Popover } from 'antd'
import { t } from 'i18next'
import styled from 'styled-components'

interface MessageTokensProps {
  message: Message
  isLastMessage?: boolean
}

const MessageTokens: React.FC<MessageTokensProps> = ({ message }) => {
  // const { generating } = useRuntime()
  const locateMessage = () => {
    EventEmitter.emit(EVENT_NAMES.LOCATE_MESSAGE + ':' + message.id, false)
  }

  const getPrice = () => {
    const inputTokens = message?.usage?.prompt_tokens ?? 0
    const outputTokens = message?.usage?.completion_tokens ?? 0
    const model = message.model

    // For OpenRouter, use the cost directly from usage if available
    if (model?.provider === 'openrouter' && message?.usage?.cost !== undefined) {
      return message.usage.cost
    }

    if (!model || model.pricing?.input_per_million_tokens === 0 || model.pricing?.output_per_million_tokens === 0) {
      return 0
    }
    return (
      (inputTokens * (model.pricing?.input_per_million_tokens ?? 0) +
        outputTokens * (model.pricing?.output_per_million_tokens ?? 0)) /
      1000000
    )
  }

  const getPriceString = () => {
    const price = getPrice()
    if (price === 0) {
      return ''
    }
    // For OpenRouter, always show cost even without pricing config
    const shouldShowCost = message.model?.provider === 'openrouter' || price > 0
    if (!shouldShowCost) {
      return ''
    }
    const currencySymbol = message.model?.pricing?.currencySymbol || '$'
    return `| ${t('models.price.cost')}: ${currencySymbol}${price.toFixed(6)}`
  }

  if (!message.usage) {
    return <div />
  }

  if (message.role === 'user') {
    return (
      <MessageMetadata className="message-tokens" onClick={locateMessage}>
        {`Tokens: ${message?.usage?.total_tokens}`}
      </MessageMetadata>
    )
  }

  if (message.role === 'assistant') {
    let metrixs: string | null = null
    let hasMetrics = false

    const metrics = message.metrics
    if (metrics) {
      const completionTokens =
        typeof metrics.completion_tokens === 'number' && Number.isFinite(metrics.completion_tokens)
          ? Math.max(0, metrics.completion_tokens)
          : null

      const completionDurationMs =
        typeof metrics.time_completion_millsec === 'number' && Number.isFinite(metrics.time_completion_millsec)
          ? Math.max(0, metrics.time_completion_millsec)
          : null

      const timeToFirstTokenMs =
        typeof metrics.time_first_token_millsec === 'number' && Number.isFinite(metrics.time_first_token_millsec)
          ? Math.max(0, metrics.time_first_token_millsec)
          : null

      if (completionTokens !== null || completionDurationMs !== null || timeToFirstTokenMs !== null) {
        hasMetrics = true

        const tokenSpeed =
          completionTokens !== null && completionDurationMs !== null && completionDurationMs > 0
            ? completionTokens / (completionDurationMs / 1000)
            : null

        metrixs = t('settings.messages.metrics', {
          time_first_token_millsec: timeToFirstTokenMs !== null ? timeToFirstTokenMs : '—',
          token_speed:
            tokenSpeed !== null && Number.isFinite(tokenSpeed)
              ? tokenSpeed.toFixed(0)
              : '—'
        })
      }
    }

    const tokensInfo = (
      <span className="tokens">
        Tokens:
        <span>{message?.usage?.total_tokens}</span>
        <span>↑{message?.usage?.prompt_tokens}</span>
        <span>↓{message?.usage?.completion_tokens}</span>
        <span>{getPriceString()}</span>
      </span>
    )

    return (
      <MessageMetadata className="message-tokens" onClick={locateMessage}>
        {hasMetrics && metrixs ? (
          <Popover content={metrixs} placement="top" trigger="hover" styles={{ root: { fontSize: 11 } }}>
            {tokensInfo}
          </Popover>
        ) : (
          tokensInfo
        )}
      </MessageMetadata>
    )
  }

  return null
}

const MessageMetadata = styled.div`
  font-size: 10px;
  color: var(--color-text-3);
  user-select: text;
  cursor: pointer;
  text-align: right;

  .tokens span {
    padding: 0 2px;
  }
`

export default MessageTokens
