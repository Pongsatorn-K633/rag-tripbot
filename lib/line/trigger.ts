// Trigger-word gate for group chats.
// In group chats, the bot must only respond when explicitly summoned — otherwise
// users would have to create a dedicated group just for the bot.
//
// Triggers (case-insensitive, can appear at START or END of the message):
//   - "doma ..."         (English)
//   - "โดมะ ..."         (Thai)
//   - "... doma"         (trigger at the end)
//   - "... โดมะ"         (Thai trigger at the end)
//   - "@dopamichi ..."   (literal @-mention text)
//   - "@doma ..."        (short @-mention)
//   - "@โดมะ ..."        (Thai @-mention)
//   - a real LINE @-mention of the bot user (detected via mention.mentionees)
//
// @all is intentionally NOT a trigger — we don't want the bot blurting on every
// broadcast ping.

const TRIGGER_WORDS = ['doma', 'โดมะ', 'dopamichi']

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const wordPattern = TRIGGER_WORDS.map(escapeRegex).join('|')

// Start-of-message regex:
//   "doma hello"  "โดมะ, ไปไหนดี"  "@dopamichi help"  "Doma:hi"
//
// Unicode-aware lookahead ensures we don't match partial words like "domaburger".
const TRIGGER_START_REGEX = new RegExp(
  `^@?(${wordPattern})(?![\\p{L}\\p{N}_])[\\s,:.!?\\-]*`,
  'iu'
)

// End-of-message regex:
//   "วันสุดท้ายไปไหนบ้าง doma"  "ไปไหนดี โดมะ"
//
// Requires at least one whitespace BEFORE the trigger so we don't match
// "freedoma" or Thai text ending in "โดมะ" as part of a compound word.
// Only whitespace is consumed (not punctuation like ? or !) so the clean
// text retains its trailing punctuation.
const TRIGGER_END_REGEX = new RegExp(
  `\\s+@?(${wordPattern})[\\s,:.!?\\-]*$`,
  'iu'
)

export interface TriggerResult {
  triggered: boolean
  /** Message text with the trigger word stripped — pass this to the RAG pipeline. */
  cleanText: string
}

/**
 * Check whether a group-chat message should wake the bot.
 *
 * The trigger word can appear at the START or END of the message:
 *   - "doma พรุ่งนี้ไปไหน"        → cleanText = "พรุ่งนี้ไปไหน"
 *   - "วันสุดท้ายไปไหนบ้าง doma"  → cleanText = "วันสุดท้ายไปไหนบ้าง"
 *   - "doma"                       → cleanText = "" (greeting case)
 *
 * @param text          Raw message text (already trimmed).
 * @param mentionedBot  True if LINE's mention.mentionees included this bot's userId.
 */
export function checkTrigger(text: string, mentionedBot: boolean): TriggerResult {
  const trimmed = text.trim()

  // 1. Real LINE @-mention of our bot — strip the @xxx token and accept.
  if (mentionedBot) {
    const cleaned = trimmed.replace(/@\S+\s*/g, '').trim()
    return { triggered: true, cleanText: cleaned }
  }

  // 2. Trigger word at the START of the message.
  const startMatch = trimmed.match(TRIGGER_START_REGEX)
  if (startMatch) {
    return { triggered: true, cleanText: trimmed.slice(startMatch[0].length).trim() }
  }

  // 3. Trigger word at the END of the message.
  const endMatch = trimmed.match(TRIGGER_END_REGEX)
  if (endMatch) {
    return { triggered: true, cleanText: trimmed.slice(0, endMatch.index).trim() }
  }

  return { triggered: false, cleanText: trimmed }
}
