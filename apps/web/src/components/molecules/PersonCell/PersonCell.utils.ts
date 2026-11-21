/** Words reduced to their letters ("O'Neil" -> "ONeil"); words with no letters are dropped. */
function letterWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}]/gu, ''))
    .filter(Boolean);
}

/**
 * "Priya Sharma" -> "PS"; "Madonna" -> "MA"; ignores extra whitespace, punctuation and digits,
 * and a parenthesised note ("Global HR (demo)" -> "GH").
 */
export function initialsOf(name: string): string {
  const withoutNotes = letterWords(name.replace(/\([^)]*\)|\[[^\]]*\]/g, ' '));
  const words = withoutNotes.length > 0 ? withoutNotes : letterWords(name);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[words.length - 1]![0]}`.toUpperCase();
}
