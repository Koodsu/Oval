import { describe, expect, it } from 'vitest';
import { moderateImageContent, moderateTextContent } from './contentModeration';

const blocked = async (text: string, opts = {}) =>
  (await moderateTextContent([text], opts))?.status === 400;
const clean = async (text: string, opts = {}) =>
  (await moderateTextContent([text], opts)) === null;

describe('content moderation (local, no provider)', () => {
  it('blocks harmful content, including evasions', async () => {
    expect(await blocked('kill yourself')).toBe(true);
    expect(await blocked('k1ll your5elf')).toBe(true);      // leetspeak
    expect(await blocked('n-i-g-g-e-r')).toBe(true);        // separators
    expect(await blocked('f@ggot')).toBe(true);             // homoglyph
    expect(await blocked('niggerrr')).toBe(true);           // repeats
    expect(await blocked('child porn')).toBe(true);
    expect(await blocked('school shooting')).toBe(true);
    expect(await blocked('selling adderall')).toBe(true);
    expect(await blocked('kys')).toBe(true);
  });

  it('harmful content is blocked even in chat (allowProfanity)', async () => {
    expect(await blocked('n1gger', { allowProfanity: true })).toBe(true);
    expect(await blocked('kill yourself', { allowProfanity: true })).toBe(true);
  });

  it('blocks profanity in labels (default) but allows it in chat', async () => {
    expect(await blocked('fuck this club')).toBe(true);           // default = label
    expect(await blocked('shitty')).toBe(true);
    expect(await clean('fuck this club', { allowProfanity: true })).toBe(true); // chat
    expect(await clean('this is so shitty lol', { allowProfanity: true })).toBe(true);
  });

  it('catches profanity evasions in labels', async () => {
    expect(await blocked('fuuuck')).toBe(true);
    expect(await blocked('sh1t')).toBe(true);
    expect(await blocked('a$$hole')).toBe(true);
  });

  it('rejects likely keyboard-mash pod titles when requested', async () => {
    const options = { rejectGibberish: true };
    for (const title of [
      'asfoiashdoi',
      'AFOISUDOIAS',
      'qwertyuiop',
      'bcdfghjklm',
      'aaaaaaaaaa',
    ]) {
      expect(await blocked(title, options)).toBe(true);
    }
  });

  it('keeps plausible titles, campus names, and acronyms', async () => {
    const options = { rejectGibberish: true };
    for (const title of [
      'Euchre at Morrill Tower',
      'CSE 2221',
      'MATH 1151 study group',
      'Algorithms exam cram',
      'Pickleball',
      'Thanksgiving potluck',
      'BuckeyeLink help session',
      'RPAC pickup basketball',
      'Mississippi watch party',
      'Ashwaganda supplements',
      'Ashwagandha discussion',
      'Availability',
      'Aboveboard',
      'Birthplace',
      'Postscript',
      'Backstroke',
      'Matchstick',
      'Swashbuckle',
      'Kalashnikov history discussion',
      'Oxybenzaldehyde study session',
      'Twelvefold',
    ]) {
      expect(await clean(title, options)).toBe(true);
    }
  });

  it('does NOT flag innocent words (false-positive guards)', async () => {
    for (const word of [
      'class', 'classic', 'assassin', 'Scunthorpe', 'grape', 'scrape',
      'therapy', 'therapist', 'Niger', 'Nigeria', 'shiitake', 'peacock',
      'Hancock', 'cockpit', 'raccoon', 'analysis', 'Richard',
      'Computer Science', 'Pre-Med', 'Sociology major', 'Ava Chen',
    ]) {
      expect(await clean(word)).toBe(true);
      expect(await clean(word, { allowProfanity: true })).toBe(true);
    }
  });

  it('returns null for empty/clean input', async () => {
    expect(await moderateTextContent([])).toBeNull();
    expect(await moderateTextContent([null, undefined, ''])).toBeNull();
    expect(await clean('Frisbee on the Oval')).toBe(true);
  });

  it('image moderation is a no-op pass-through (provider removed)', async () => {
    expect(await moderateImageContent(Buffer.from('anything'), 'image/png')).toBeNull();
  });
});
