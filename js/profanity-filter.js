/**
 * Profanity Filter - Client-side content moderation
 * Ported from mobile/utils/profanityFilter.ts
 * Checks text against a curated list of inappropriate words
 * Supports English, Turkish, Maltese, and common leet-speak variations
 */

const ENGLISH_WORDS = [
  'fuck', 'shit', 'ass', 'asshole', 'bitch', 'bastard', 'damn', 'dick',
  'pussy', 'cock', 'cunt', 'whore', 'slut', 'nigger', 'nigga', 'faggot',
  'retard', 'wanker', 'bollocks', 'prick', 'twat', 'motherfucker',
  'bullshit', 'goddamn', 'jackass', 'douchebag', 'dipshit',
  'shithead', 'dickhead', 'arsehole', 'fuckface', 'fucktard',
  'cumshot', 'blowjob', 'handjob', 'porn', 'porno', 'pornography',
  'nude', 'nudes', 'naked', 'sex', 'sexy', 'hentai',
  'dildo', 'vibrator', 'fetish', 'bondage', 'bdsm',
  'cocaine', 'heroin', 'meth', 'methamphetamine', 'ecstasy',
  'marijuana', 'weed', 'cannabis',
  'kill', 'murder', 'rape', 'terrorist', 'terrorism', 'bomb',
  'suicide', 'nazi', 'kkk', 'holocaust',
];

const TURKISH_WORDS = [
  'amk', 'aq', 'amına', 'amina', 'sikeyim', 'sikerim', 'siktiğimin',
  'siktimin', 'siktirgit', 'siktir', 'piç', 'pic', 'orospu', 'kahpe',
  'pezevenk', 'gavat', 'ibne', 'götveren', 'gotveren', 'yarak',
  'yarrak', 'taşak', 'tasak', 'dalyarak', 'amcık', 'amcik',
  'götlek', 'gotlek', 'manyak', 'salak', 'gerizekalı', 'gerizekali',
  'aptal', 'mal', 'dangalak', 'hıyar', 'hiyar', 'puşt', 'pust',
  'bok', 'boktan', 'hassiktir', 'hasiktir', 'lan', 'ulan',
  'ananı', 'anani', 'ananın', 'ananin', 'bacını', 'bacini',
  'oç', 'oc', 'mk', 'sg', 'skm', 'skrm', 'skim', 'skicem',
];

const MALTESE_WORDS = [
  'madonna', 'ostja', 'ostia', 'żobb', 'zobb', 'żobbi', 'zobbi',
  'mitt ommok', 'mittommok', 'ommok', 'missierek', 'qaħba', 'qahba',
  'ħara', 'hara', 'għaraq', 'ġurdien', 'ġahan', 'gahan',
];

const ITALIAN_WORDS = [
  'cazzo', 'merda', 'vaffanculo', 'stronzo', 'coglion', 'figa', 'puttana',
  'troia', 'minchia', 'bastardo', 'finocchio', 'palle', 'cornuto',
];

const ALL_BANNED_WORDS = [
  ...ENGLISH_WORDS,
  ...TURKISH_WORDS,
  ...MALTESE_WORDS,
  ...ITALIAN_WORDS,
];

const LEET_MAP = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
  '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i',
  '+': 't', '(': 'c', '|': 'l',
};

function normalizeText(text) {
  let normalized = text.toLowerCase();

  normalized = normalized
    .split('')
    .map(char => LEET_MAP[char] || char)
    .join('');

  normalized = normalized.replace(/[.\-_*#~`'"!?,;:]/g, '');
  normalized = normalized.replace(/\b(\w)\s+(?=\w\b)/g, '$1');
  normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');

  return normalized;
}

export function checkProfanity(text) {
  if (!text || text.trim().length === 0) {
    return { hasProfanity: false, matchedWord: null };
  }

  const normalized = normalizeText(text);

  for (const word of ALL_BANNED_WORDS) {
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedWord, 'gi');

    if (regex.test(normalized)) {
      return { hasProfanity: true, matchedWord: word };
    }
  }

  return { hasProfanity: false, matchedWord: null };
}

export function checkFieldsForProfanity(fields) {
  for (const field of fields) {
    const result = checkProfanity(field.value);
    if (result.hasProfanity) {
      return {
        hasProfanity: true,
        fieldName: field.name,
        matchedWord: result.matchedWord,
      };
    }
  }

  return { hasProfanity: false, fieldName: null, matchedWord: null };
}
