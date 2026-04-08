// Trigger-word gate for group chats.
// In group chats, the bot must only respond when explicitly summoned — otherwise
// users would have to create a dedicated group just for the bot.
//
// Triggers (case-insensitive):
//   - "doma ..."         (English prefix)
//   - "โดมะ ..."         (Thai prefix)
//   - "@dopamichi ..."   (literal @-mention text)
//   - "@doma ..."        (short @-mention)
//   - "@โดมะ ..."        (Thai @-mention)
//   - a real LINE @-mention of the bot user (detected via mention.mentionees)
//
// @all is intentionally NOT a trigger — we don't want the bot blurting on every
// broadcast ping.

const TRIGGER_WORDS = ['doma', 'โดมะ', 'dopamichi']

// Build a regex that matches any trigger word at the very start of the text,
// optionally preceded by '@', and followed by end-of-string / punctuation / space.
// Examples that match:  "doma hello"  "โดมะ, ไปไหนดี"  "@dopamichi help"  "Doma:hi"
//
// Note: we cannot use `\b` (word boundary) here because JS's `\w` is ASCII-only,
// so `\b` never fires between Thai letters (e.g. "โดมะ") and a following space —
// meaning "โดมะ hello" would fail to match. Instead we use a unicode-aware
// negative lookahead: after the trigger, the next char must NOT be a letter or
// digit in ANY script. This requires the `u` flag.
const TRIGGER_REGEX = new RegExp(
  `^@?(${TRIGGER_WORDS.map(escapeRegex).join('|')})(?![\\p{L}\\p{N}_])[\\s,:.!?\\-]*`,
  'iu'
)

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface TriggerResult {
  triggered: boolean
  /** Message text with the trigger prefix stripped — pass this to the RAG pipeline. */
  cleanText: string
}

/**
 * Check whether a group-chat message should wake the bot.
 *
 * @param text          Raw message text (already trimmed).
 * @param mentionedBot  True if LINE's mention.mentionees included this bot's userId.
 */
export function checkTrigger(text: string, mentionedBot: boolean): TriggerResult {
  const trimmed = text.trim()

  // 1. Real LINE @-mention of our bot — strip the first @xxx token and accept.
  if (mentionedBot) {
    const cleaned = trimmed.replace(/^@\S+\s*/, '').trim()
    return { triggered: true, cleanText: cleaned || trimmed }
  }

  // 2. Text-based trigger word.
  const match = trimmed.match(TRIGGER_REGEX)
  if (match) {
    return { triggered: true, cleanText: trimmed.slice(match[0].length).trim() }
  }

  return { triggered: false, cleanText: trimmed }
}
