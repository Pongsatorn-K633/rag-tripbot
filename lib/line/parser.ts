import { webhook } from '@line/bot-sdk'

export interface ParsedEvent {
  type: 'text' | 'other'
  lineId: string
  sourceType: 'user' | 'group'
  replyToken: string
  text?: string
  /** True if LINE's mention.mentionees included this bot's userId (not @all). */
  mentionedBot?: boolean
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

  // Detect whether the bot itself was @-mentioned (not @all).
  // LINE exposes mention.mentionees[] with entries of either { type: 'user', userId }
  // or { type: 'all' }. We only treat a user-type mention matching LINE_BOT_USER_ID
  // as a real mention of us.
  const botUserId = process.env.LINE_BOT_USER_ID
  const mentionees =
    (textContent as unknown as { mention?: { mentionees?: Array<{ type?: string; userId?: string }> } })
      .mention?.mentionees ?? []
  const mentionedBot =
    !!botUserId &&
    mentionees.some((m) => m?.type === 'user' && m.userId === botUserId)

  return {
    type: 'text',
    lineId,
    sourceType: source.type === 'group' ? 'group' : 'user',
    replyToken: messageEvent.replyToken ?? '',
    text: textContent.text.trim(),
    mentionedBot,
  }
}
