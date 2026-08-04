export const POD_TITLE_REQUIRED_MESSAGE = 'Add a specific title so people know what they are joining.';
export const POD_TITLE_GIBBERISH_MESSAGE =
  'Use a clear, descriptive title instead of random letters.';

// Keep this compact trigram model and its audited exceptions synchronized with
// backend/src/lib/contentModeration.ts. It was tested against 114,804 English
// words of 10+ letters from macOS's web2 dictionary.
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

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '');
}

function looksLikeGibberish(value: string): boolean {
  const words = normalize(value).match(/[a-z]+/g) ?? [];

  return words.some((word) => {
    // Course codes, acronyms, and normal short words are intentionally exempt.
    // The backend uses the same threshold and remains the final authority.
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

export function getPodTitleValidationError(value: string): string | null {
  const title = value.trim();
  if (!title) return POD_TITLE_REQUIRED_MESSAGE;
  if (title.length > 60) return 'Pod titles can be up to 60 characters.';
  if (looksLikeGibberish(title)) return POD_TITLE_GIBBERISH_MESSAGE;
  return null;
}
