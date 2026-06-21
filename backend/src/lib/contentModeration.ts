const BLOCKED_CONTENT_MESSAGE =
  'This content appears to violate Oval safety rules. Please revise it before posting.';
const MODERATION_UNAVAILABLE_MESSAGE =
  'Safety checks are temporarily unavailable. Please try again shortly.';

const OBJECTIONABLE_PATTERNS: RegExp[] = [
  /\b(kill yourself|kys|go die)\b/i,
  /\b(rape|raping|sexual assault)\b/i,
  /\b(nazi|white power|heil hitler)\b/i,
  /\b(faggot|fag)\b/i,
  /\b(nigger|nigga)\b/i,
  /\b(retard|retarded)\b/i,
  /\b(bomb threat|shoot up|school shooting|terrorist threat)\b/i,
  /\b(sell(?:ing)?|buy(?:ing)?) (weed|coke|cocaine|xanax|adderall|fentanyl|meth|drugs)\b/i,
  /\b(child porn|csam|underage nudes?)\b/i,
];

export interface ModerationRejection {
  status: 400 | 503;
  message: string;
}

interface ModerationResponse {
  results?: Array<{ flagged?: boolean }>;
}

function normalizeForMatching(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[4@]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[5$]/g, 's')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function combinedText(texts: Array<string | null | undefined>): string {
  return texts
    .filter((text): text is string => typeof text === 'string')
    .map((text) => text.trim())
    .filter(Boolean)
    .join('\n');
}

function findLocalViolation(text: string): boolean {
  const normalized = normalizeForMatching(text);
  if (!normalized) return false;
  return OBJECTIONABLE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function moderationIsRequired(): boolean {
  const configured = process.env.MODERATION_ENFORCEMENT?.trim().toLowerCase();
  if (configured) return configured === 'required';
  return process.env.NODE_ENV === 'production';
}

async function requestModeration(input: unknown): Promise<ModerationRejection | null> {
  if (process.env.NODE_ENV === 'test' && process.env.MODERATION_TEST_REMOTE !== 'true') {
    return null;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return moderationIsRequired()
      ? { status: 503, message: MODERATION_UNAVAILABLE_MESSAGE }
      : null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODERATION_MODEL?.trim() || 'omni-moderation-latest',
        input,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Moderation API returned ${response.status}`);
    }

    const body = await response.json() as ModerationResponse;
    return body.results?.some((result) => result.flagged)
      ? { status: 400, message: BLOCKED_CONTENT_MESSAGE }
      : null;
  } catch (err) {
    console.error('[contentModeration] Provider request failed:', err);
    return moderationIsRequired()
      ? { status: 503, message: MODERATION_UNAVAILABLE_MESSAGE }
      : null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function moderateTextContent(
  texts: Array<string | null | undefined>
): Promise<ModerationRejection | null> {
  const text = combinedText(texts);
  if (!text) return null;
  if (findLocalViolation(text)) {
    return { status: 400, message: BLOCKED_CONTENT_MESSAGE };
  }
  return requestModeration(text);
}

export async function moderateImageContent(
  buffer: Buffer,
  mimetype: string
): Promise<ModerationRejection | null> {
  const dataUrl = `data:${mimetype};base64,${buffer.toString('base64')}`;
  return requestModeration([
    {
      type: 'image_url',
      image_url: { url: dataUrl },
    },
  ]);
}
