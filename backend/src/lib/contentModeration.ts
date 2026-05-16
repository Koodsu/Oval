const OBJECTIONABLE_PATTERNS: RegExp[] = [
  /\b(kill\s+yourself|kys)\b/i,
  /\b(rape|raping)\b/i,
  /\b(nazi|white\s+power)\b/i,
  /\b(faggot|fag)\b/i,
  /\b(nigger|nigga)\b/i,
  /\b(retard|retarded)\b/i,
  /\b(terrorist\s+threat|bomb\s+threat)\b/i,
  /\b(sell(?:ing)?\s+(?:weed|coke|cocaine|xanax|adderall|fentanyl|drugs))\b/i,
];

export function findObjectionableContent(texts: Array<string | null | undefined>): string | null {
  const combined = texts
    .filter((text): text is string => typeof text === 'string')
    .join('\n')
    .trim();

  if (!combined) return null;
  const matched = OBJECTIONABLE_PATTERNS.find((pattern) => pattern.test(combined));
  return matched ? 'This content appears to violate Bridge safety rules. Please revise it before posting.' : null;
}
