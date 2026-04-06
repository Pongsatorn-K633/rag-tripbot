import { LineBotClient } from '@line/bot-sdk'

const lineClient = LineBotClient.fromChannelAccessToken({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
})

export async function replyToLine(
  replyToken: string,
  text: string
): Promise<void> {
  await lineClient.replyMessage({
    replyToken,
    messages: [{ type: 'text', text }],
  })
}

export async function pushToLine(
  lineId: string,
  text: string
): Promise<void> {
  await lineClient.pushMessage({
    to: lineId,
    messages: [{ type: 'text', text }],
  })
}

export async function replyFlexMessage(
  replyToken: string,
  altText: string,
  contents: Record<string, unknown>
): Promise<void> {
  await lineClient.replyMessage({
    replyToken,
    messages: [{
      type: 'flex',
      altText,
      contents: contents as import('@line/bot-sdk').messagingApi.FlexContainer,
    }],
  })
}
