'use client'

interface MessageBubbleProps {
  role: 'user' | 'bot'
  content: string
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex w-full mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-2 mt-1"
          style={{ backgroundColor: '#1a2744', color: '#c9a84c' }}
        >
          AI
        </div>
      )}
      <div
        className="max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
        style={
          isUser
            ? { backgroundColor: '#c9a84c', color: '#ffffff' }
            : { backgroundColor: '#ffffff', color: '#1a2744', border: '1px solid #e5e7eb' }
        }
      >
        {content}
      </div>
      {isUser && (
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ml-2 mt-1"
          style={{ backgroundColor: '#c9a84c', color: '#ffffff' }}
        >
          คุณ
        </div>
      )}
    </div>
  )
}
