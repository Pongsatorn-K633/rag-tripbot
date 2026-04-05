import { webhook } from '@line/bot-sdk'

export interface ParsedEvent {
  type: 'text' | 'other'
  lineId: string
  sourceType: 'user' | 'group'
  replyToken: string
  text?: string
}

export function parseEvent(event: webhook.Event): ParsedEvent | null {
  if (event.type !== 'message') {
    return null
  }

  const messageEvent = event as webhook.MessageEvent
  if (messageEvent.message.type !== 'text') {
    return null
  }

  const source = messageEvent.source
  if (!source) return null

  const lineId =
    source.type === 'group'
      ? (source as webhook.GroupSource).groupId
      : (source as webhook.UserSource).userId

  if (!lineId) return null

  const textContent = messageEvent.message as webhook.TextMessageContent

  return {
    type: 'text',
    lineId,
    sourceType: source.type === 'group' ? 'group' : 'user',
    replyToken: messageEvent.replyToken ?? '',
    text: textContent.text.trim(),
  }
}
