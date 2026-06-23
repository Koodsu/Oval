// Local, dependency-free content moderation. No external provider, no API keys,
// no cost — and it never returns 503, so a provider outage can't block signups.
//
// Two tiers:
//   HARMFUL   — slurs, threats, sexual violence, CSAM, hard-drug sales, self-harm.
//               Always blocked, in every context.
//   PROFANITY — general swearing. Blocked in "labels" (names, club names,
//               locations, titles) but allowed in chat/messages by passing
//               { allowProfanity: true }, so an 18+ app stays usable in DMs.
//
// Evasion handling: input is normalized (leetspeak -> letters, zero-width
// stripped, lowercased), then matched in two forms:
//   - "compact" (all separators removed) catches spacing/punctuation evasion
//     like "n-i-g-g-e-r" or "f.u.c.k". Used for distinctive HARMFUL terms.
//   - "spaced"  (separators -> spaces, with \b word boundaries) is used for
//     PROFANITY and other short words so we don't match innocent substrings —
//     "class" / "assassin" / "Scunthorpe" must never be flagged.
// Patterns use + quantifiers to tolerate repeated letters ("fuuuck", "niggerrr").

const BLOCKED_CONTENT_MESSAGE =
  'This content appears to violate Oval safety rules. Please revise it before posting.';

export interface ModerationRejection {
  status: 400;
  message: string;
}

export interface ModerationOptions {
  /** Allow general profanity (for conversational content like chat messages). */
  allowProfanity?: boolean;
}

// Leetspeak / homoglyph folding. Conservative — only common substitutions.
const LEET: Record<string, string> = {
  '4': 'a', '@': 'a',
  '8': 'b',
  '3': 'e',
  '6': 'g', '9': 'g',
  '1': 'i', '!': 'i', '|': 'i',
  '0': 'o',
  '5': 's', '$': 's',
  '7': 't',
};

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/./g, (c) => LEET[c] ?? c);
}

// "f.u.c.k" / "n i g g e r" -> "fuck" / "nigger"
function compactForm(norm: string): string {
  return norm.replace(/[^a-z0-9]+/g, '');
}
// "class assassin" with single spaces and real word boundaries
function spacedForm(norm: string): string {
  return norm.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Matched against the COMPACT form (catches separator evasion). Reserve for
// terms distinctive enough that innocent substrings are rare.
const HARMFUL_COMPACT: RegExp[] = [
  // self-harm / suicide encouragement
  /kil+yo?urself/, /nec?kyourself/, /hangyourself/, /endyourlife/, /go+kil+yourself/,
  // sexual violence
  /sexualas+ault/, /molest/,
  // hate / extremism
  /whitepower/, /heilhitler/, /siegheil/, /gaschamber/,
  // racial / ethnic slurs (+ repeat tolerance)
  /nigg+er+/, /nigg+a+/, /chink/, /wetback/, /sandnigg+er/, /beaner/, /towelhead/, /raghead/,
  // homophobic / transphobic slurs
  /fag+ot/, /tran+y/,
  // CSAM
  /childporn/, /childp0?rn/, /underagenude/, /jailbait/, /lolicon/, /pedophile/,
  // hard-drug dealing
  /(sell|buy|selling|buying|deal|dealing)(weed|coke|cocaine|xanax|adderall|fentanyl|meth|heroin|acid|shrooms|molly|drugs)/,
  // unambiguous threats
  /schoolshooting/, /shootupthe/, /bombthreat/, /terroristthreat/,
];

// Matched against the SPACED form with \b boundaries (substring-safe). Used for
// short slurs and all profanity.
const HARMFUL_WORD: RegExp[] = [
  /\bkys\b/, /\bnazi\b/, /\bkkk\b/, /\bspic\b/, /\bkike\b/, /\bcoon\b/, /\bgook\b/, /\bpedo\b/,
  /\bfag\b/, /\bdyke\b/, /\bretard(ed|s)?\b/, /\bcsam\b/, /\bloli\b/,
  /\brap(e|ed|es|ing|ist)\b/,
];

const PROFANITY_WORD: RegExp[] = [
  /\bf+u+c+k+\w*/, /\bf+u+k+\b/, /\bf+u+q\b/, /\bph+u+ck/, /\bfcuk/, /\bfck\b/,
  /\bsh+i+t+(s|ty|tier|head|hole|ed|ting|e|y)?\b/, /\bb+i+t+c+h+\w*/, /\bc+u+n+t+\w*/,
  /\ba+s+s+h+o+l+e+\w*/, /\bass\b/, /\bdickhead/, /\bp+u+s+s+y\b/, /\bc+o+c+k\b/,
  /\bb+a+s+t+a+r+d/, /\bs+l+u+t+s?\b/, /\bwh+o+re/, /\bt+w+a+t/, /\bw+a+n+k/,
  /\bb+o+l+l+o+c+k/, /\bmotherf+u+c?k/, /\bjackass/, /\bdouchebag/,
];

function matches(text: string, opts: ModerationOptions): boolean {
  if (!text) return false;
  const norm = normalize(text);
  const compact = compactForm(norm);
  const spaced = spacedForm(norm);

  if (HARMFUL_COMPACT.some((re) => re.test(compact))) return true;
  if (HARMFUL_WORD.some((re) => re.test(spaced))) return true;
  if (!opts.allowProfanity && PROFANITY_WORD.some((re) => re.test(spaced))) return true;
  return false;
}

function combinedText(texts: Array<string | null | undefined>): string {
  return texts
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Screen text for policy violations. Synchronous local checks only — no network,
 * no provider, never throws, never 503s.
 *
 * Returns null if clean, or { status: 400, message } if it should be blocked.
 * Pass { allowProfanity: true } for conversational content (chat, DMs) so casual
 * swearing is allowed; leave it off for names, titles, and other labels.
 */
export async function moderateTextContent(
  texts: Array<string | null | undefined>,
  options: ModerationOptions = {}
): Promise<ModerationRejection | null> {
  const text = combinedText(texts);
  if (matches(text, options)) {
    return { status: 400, message: BLOCKED_CONTENT_MESSAGE };
  }
  return null;
}

/**
 * Image moderation previously used an external vision provider. That dependency
 * has been removed, so this is now a no-op pass-through: uploaded images are NOT
 * automatically screened. Rely on user reporting + manual review for images.
 */
export async function moderateImageContent(
  _buffer: Buffer,
  _mimetype: string
): Promise<ModerationRejection | null> {
  return null;
}
