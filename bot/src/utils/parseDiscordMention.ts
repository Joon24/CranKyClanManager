/** `<@123>`, `<@!123>`, `@123`, `123` 형식에서 Discord 유저 ID 추출 */
export function parseDiscordMention(input: string): string | null {
  const trimmed = input.trim();
  const mentionMatch = trimmed.match(/^(?:<@!?)?(\d{17,20})>?$/);
  if (mentionMatch) return mentionMatch[1];

  const inlineMatch = trimmed.match(/<@!?(\d{17,20})>/);
  if (inlineMatch) return inlineMatch[1];

  return null;
}
