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
const GIBBERISH_CONTENT_MESSAGE =
  'Use a clear, descriptive pod title so people know what they are joining.';

export interface ModerationRejection {
  status: 400;
  message: string;
}

export interface ModerationOptions {
  /** Allow general profanity (for conversational content like chat messages). */
  allowProfanity?: boolean;
  /** Reject likely keyboard-mash text. Intended for short public labels such as pod titles. */
  rejectGibberish?: boolean;
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

// Top 1,000 character trigrams learned from macOS's 234k-word English
// dictionaries (web2 + web2a). A trigram model proved much less prone to false
// positives than the earlier repeated-bigram rule: the full dictionary audit
// caught 25 rare-but-real words, which are explicitly preserved below.
const COMMON_TRIGRAM_DATA = `
e$$y$$s$$^^s^^pn$$^^c^^a^^ud$$r$$l$$t$$^un^^t^^ma$$ly$c$$^^ber$essic$^^dal$ion^^rss$teratied$^^hus$ingm$$on$te$^^i^^eous
tiones^^oentatele$tic^^f^^g^co^^nicag$$ist^^lan$^prbleng$calant^reine^inablperh$$erint$allne$trast$ia$ver^sutricon^pary$
prealiproite^^wstiene^caismoniis$ty$nte^diianntiratsm$ive^detor^nothe^anlitophste^^vlinerolatricmantinari^trasteraatoder
^stresranmen^manonstr^peitigrandeherriaitytro^seintina^chlesmatolollyphorinometed^poaniectizeundiliae$overoplogereonaula
ialdis^meid$chimetishtivostk$$^henicacese$phistanatum$ve$oriomarapin$emictilaroneniseleidaparaphnalforsisracestminze$ide
^miphaelllen^mo^ba^sptal^phncecatgenmontisand^besto^^ko$$rouermoliillntaoid^sa^ovphyp$$eliersris^scmicngllislicculcartom
inireduncetelanraltat^terosreaancchatence$^hyrom^thchelliar$comre$recarti$$araritardenish$plachollaencthoosior$misacteti
athortotooreontniaetrhalicisubglynit^ta^larononoanghor^aroraachendunsdiainotanshirottur^enenoogrdenke$itaorm^al^^jrocton
alacrondi^brhrountscoretsside$ful^ho^expol^plmernerurencoogilas^crntrdaecorageidianaler^haesiaryalenthnchcenporbilthinin
hea^aces$ikearc^focol^shbrauriercliarentariouharquihinemahicdinvensuptabposium^gaetaberindliken$et$^lilleassamioseiat^si
ge$hipelyomogerpleomimorsem^soertotholeons^ne^pillofer^totteout^raura^bihan^bongekerkindicdrospecertelcopuniincsiortiise
^grcanpatrchrioserounearridpinogeicoabiramitholypenthrainedilacctoanetiaemeoroataephrmaens^leope^amhemupehyprepochizasin
eryeouifianotre^muondcrapalotiholletamephewormalquaerreat^^qhilpicalohonopi^quip$gictitsitecolizmarlecolame$rabtopiscpan
hy$adeimpern^dooponarunaileareoncultled^flgy$ck$velackead^veodi^clloscourm$radadi^ceansunpasispo^imspiemo^buma$epipti^ro
^wahenchrsalomyficla$^fisnelornsintoaciceaoryote^ap^asustrd$oodelaocamitsen^vienara$cinsiaibldlyblyrol^geul$rogtillounos
roocrenomdnerthdesthaghtcy$ongciaodohisniztleslynetnou^loich^ps^pu^fand$icuogyoceremealatrisoighpri^aueanmelsomcepqueune
my$ras^orodeifoimeosp^^zzatrelwaretherlbrohelickinsollrrech$eptompclelea^blf$$decnedrte^tucritol^frshaiceampapphyddoniss
ocoockuti^syoscel$unr^dagintchamarmiattbarrdina$rusaveorp^adnstcelautedlsseod$^tiacoscagalscrlum^cuystlocsheragthyclaerp
^vata$itoscetoculiake^ouson^elopandandrliouto^epagielodradomsoluro^glescth$eveedniacneugislushettoseurraiisinrelopydreae
ienlam^natestru^godalrerervx$$ily^wirsehotifeuslarrlabornorrdiohylaronne^cyannngisulnsepe$ilasurncyettungaccditcitacrilo
rifossulltacreededbripte^fenoprigcurgonypeligmiamuldlehiaotanabhomsanpitrefndoll$nansmaimatlyganad$ckenaclotripunf^mysch
ceoetootrmoueasoplicrsorecairemacrieiviiolasepsesiccidtrybalselordcostifmededeea$lidgatpisecilowmasierhedscisquimi^ci^sl
ntleed^wherbw$$lonrmo^hibacextpedrilailponvalnsuee$poddrierghoucapapoeudrimnotrrirt$rphwinlnesilpulngumpetemmesmpherfbla
esotogdemeseambrizdelbulsphmil^drglousetimootusipec^abusncocunbctaualtid^ispli^^yulosivvisysiutebatmidhooinfegarodrnispa
belom$acasidot$nocoptgleeinoursedobinolpetatuvinbit^guamonorltiny$echituseugneprareghos^rilemtylempil$deaudomotagommenci
`.replace(/\s/g, '');

const COMMON_TRIGRAMS = new Set(
  Array.from(
    { length: COMMON_TRIGRAM_DATA.length / 3 },
    (_, index) => COMMON_TRIGRAM_DATA.slice(index * 3, index * 3 + 3),
  ),
);

const KNOWN_LOW_FREQUENCY_WORDS = new Set([
  'avoirdupois', 'azoxybenzoic', 'caughnawaga', 'fifteenfold', 'hlidhskjalf',
  'husbandfield', 'johnadreams', 'kalashnikov', 'kalymmocyte', 'kitkahaxki',
  'kitkehahki', 'kornskeppur', 'kotukutuku', 'kuskwogmiut', 'mushrebiyeh',
  'oxybenzaldehyde', 'razoumofskya', 'satyashodak', 'sixteenfold', 'swashbuckle',
  'twelvefold', 'whiffenpoof', 'xylobalsamum', 'yajnavalkya', 'zaklohpakap',
]);

const KEYBOARD_RUNS = [
  'qwerty', 'werty', 'asdfg', 'sdfgh', 'dfghj', 'fghjk', 'ghjkl',
  'zxcvb', 'xcvbn', 'cvbnm',
];

function looksLikeGibberish(text: string): boolean {
  const words = normalize(text).match(/[a-z]+/g) ?? [];

  return words.some((word) => {
    // Short words/acronyms and normal multi-word connective text are too easy
    // to misclassify, so only scrutinize long tokens.
    if (word.length < 10) return false;
    if (KEYBOARD_RUNS.some((run) => word.includes(run) || word.includes(run.split('').reverse().join('')))) {
      return true;
    }

    const vowels = (word.match(/[aeiouy]/g) ?? []).length;
    const vowelRatio = vowels / word.length;
    if (vowelRatio < 0.15 || vowelRatio > 0.8) return true;
    if (KNOWN_LOW_FREQUENCY_WORDS.has(word)) return false;

    const padded = `^^${word}$$`;
    let commonCount = 0;
    for (let index = 0; index < padded.length - 2; index += 1) {
      if (COMMON_TRIGRAMS.has(padded.slice(index, index + 3))) commonCount += 1;
    }
    return commonCount / (padded.length - 2) < 0.24;
  });
}

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
  if (options.rejectGibberish && looksLikeGibberish(text)) {
    return { status: 400, message: GIBBERISH_CONTENT_MESSAGE };
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
