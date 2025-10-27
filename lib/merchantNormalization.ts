const DOMAIN_SUFFIXES = [
  ".com",
  ".co",
  ".org",
  ".net",
  ".gov",
  ".io",
  ".me",
  ".us",
  ".biz",
  ".info",
];

const BUSINESS_SUFFIXES = new Set([
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "company",
  "co",
  "llc",
  "llp",
  "plc",
  "pty",
  "limited",
  "ltd",
]);

const LOCATION_TOKENS = new Set([
  "usa",
  "us",
  "united",
  "states",
  "unitedstates",
  "canada",
  "ca",
]);

const STATE_CODES = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
]);

const MERCHANT_OVERRIDES: Array<{ matcher: RegExp; canonical: string }> = [
  { matcher: /^(?:AMAZON|AMZN|AMAZONMARKETPLACE)/, canonical: "Amazon" },
  { matcher: /^TARGET/, canonical: "Target" },
  { matcher: /^(?:WM|WAL[-\s]?MART|WALMART|WMT)/, canonical: "Walmart" },
  { matcher: /^COSTCO/, canonical: "Costco" },
  { matcher: /^STARBUCKS/, canonical: "Starbucks" },
  { matcher: /^MCDONALD/, canonical: "McDonalds" },
  { matcher: /^KROGER/, canonical: "Kroger" },
  { matcher: /(?:WHOLE)\s?FOODS/, canonical: "Whole Foods" },
  { matcher: /(?:TRADER)\s?JOE/, canonical: "Trader Joe's" },
  { matcher: /^HOME\s+DEPOT/, canonical: "The Home Depot" },
  { matcher: /^LOWE'?S/, canonical: "Lowe's" },
  { matcher: /BEST\s+BUY/, canonical: "Best Buy" },
  { matcher: /APPLE\s+COM/, canonical: "Apple" },
  { matcher: /OPENAI\s+CHATGPT\s+SUBSCR?/, canonical: "ChatGPT Subscription" },
  { matcher: /^CHICK[-\s]?FIL[-\s]?A/, canonical: "Chick-fil-A" },
  { matcher: /^PAPA\s+JOHN'?S/, canonical: "Papa Johns" },
  { matcher: /^FAZOLI'S?/, canonical: "Fazolis" },
];

const STORE_NUMBER_PATTERN = /(?:\b(?:store|st|no|number|#)\s*)?#?\s*\d{2,}$/i;

const DOMAIN_PATTERN = /https?:\/\/(?:www\.)?/i;

const NON_WORD_PATTERN = /[\u2013\u2014]/g;

const PUNCTUATION_PATTERN = /["!,.;:?*~`^_+=<>|\\]/g;

const SLASH_PATTERN = /[\/]+/g;

const AMPERSAND_PATTERN = /&/g;

const AT_PATTERN = /@budget/g;

const MULTIPLE_SPACES = /\s+/g;

const APOSTROPHE_PATTERN = /'+/g;

const DIACRITIC_SAFE_PATTERN = /[^A-Za-z0-9\s'-]/g;

const DIGIT_TOKEN = /^\d+$/;

const HASH_TOKEN = /^#?\d+$/;

const BUSINESS_SUFFIX_PATTERN = /^\d+(?:st|nd|rd|th)?$/i;

const COMMON_STOPWORDS = new Set(["the", "llc", "inc", "and"]);

const stripUrlComponents = (value: string): string => value.replace(DOMAIN_PATTERN, "");

const stripDomainSuffixes = (value: string): string => {
  let result = value;
  for (const suffix of DOMAIN_SUFFIXES) {
    if (result.endsWith(suffix)) {
      result = result.slice(0, -suffix.length);
      break;
    }
  }
  return result;
};

const stripTrailingStoreNumbers = (value: string): string => {
  let working = value.trim();
  while (STORE_NUMBER_PATTERN.test(working)) {
    working = working.replace(STORE_NUMBER_PATTERN, "").trim();
  }
  return working;
};

const normalizeSeparators = (value: string): string =>
  value
    .replace(NON_WORD_PATTERN, "-")
    .replace(PUNCTUATION_PATTERN, " ")
    .replace(SLASH_PATTERN, " ")
    .replace(AMPERSAND_PATTERN, " and ")
    .replace(AT_PATTERN, " at ")
    .replace(APOSTROPHE_PATTERN, "'");

const trimBusinessSuffixes = (tokens: string[]): string[] => {
  let end = tokens.length;
  while (end > 0) {
    const token = tokens[end - 1];
    const normalized = token.replace(/\./g, "").toLowerCase();
    if (BUSINESS_SUFFIXES.has(normalized) || BUSINESS_SUFFIX_PATTERN.test(normalized)) {
      end -= 1;
      continue;
    }
    break;
  }
  return tokens.slice(0, end);
};

const trimLocationTokens = (tokens: string[]): string[] => {
  let end = tokens.length;
  while (end > 0) {
    const token = tokens[end - 1];
    const alphanumeric = token.replace(/[^A-Za-z0-9]/g, "");
    if (!alphanumeric) {
      end -= 1;
      continue;
    }

    if (LOCATION_TOKENS.has(alphanumeric.toUpperCase())) {
      end -= 1;
      continue;
    }

    if (STATE_CODES.has(alphanumeric.toUpperCase())) {
      end -= 1;
      continue;
    }

    if (HASH_TOKEN.test(alphanumeric)) {
      end -= 1;
      continue;
    }

    break;
  }

  return tokens.slice(0, end);
};

const titleCaseWord = (word: string): string => {
  if (!word) return word;
  if (/^[A-Z0-9&]+$/.test(word) && word.length <= 3) {
    return word;
  }
  const lower = word.toLowerCase();
  return lower.replace(/(^[a-z])|([-'][a-z])/g, (segment) => segment.toUpperCase());
};

const applyOverrides = (candidate: string): string => {
  const upper = candidate.toUpperCase();
  for (const override of MERCHANT_OVERRIDES) {
    if (override.matcher.test(upper)) {
      return override.canonical;
    }
  }
  return candidate;
};

const squashTokens = (tokens: string[]): string => {
  const filtered = tokens.filter((token) => {
    if (!token) return false;
    if (DIGIT_TOKEN.test(token)) return false;
    const lower = token.toLowerCase();
    if (COMMON_STOPWORDS.has(lower)) return true;
    return true;
  });
  if (!filtered.length) {
    return tokens.join(" ");
  }
  return filtered.join(" ");
};

export const canonicalizeMerchantName = (input?: string | null): string => {
  if (!input) return "";

  let candidate = input.replace(/\u00a0/g, " ").trim();
  if (!candidate) return "";

  candidate = stripUrlComponents(candidate);
  candidate = candidate.replace(MULTIPLE_SPACES, " ").trim();
  candidate = stripDomainSuffixes(candidate);
  candidate = normalizeSeparators(candidate);
  candidate = candidate.replace(DIACRITIC_SAFE_PATTERN, " ");
  candidate = candidate.replace(MULTIPLE_SPACES, " ").trim();
  candidate = stripTrailingStoreNumbers(candidate);

  let tokens = candidate.split(/\s+/).filter(Boolean);
  if (!tokens.length) return "";

  tokens = trimBusinessSuffixes(tokens);
  tokens = trimLocationTokens(tokens);
  if (!tokens.length) {
    tokens = candidate.split(/\s+/).filter(Boolean);
  }

  const consolidated = squashTokens(tokens).trim();
  if (!consolidated) return "";

  const overridden = applyOverrides(consolidated);
  const titled = overridden
    .split(/\s+/)
    .map((token) => titleCaseWord(token))
    .join(" ");

  return titled.trim();
};

export const normalizeMerchantKey = (input?: string | null): string => {
  if (!input) return "";
  const canonical = canonicalizeMerchantName(input);
  const base = canonical || input;
  const withoutDiacritics = base
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  return withoutDiacritics.replace(/[^a-z0-9]+/g, "");
};

export const merchantAliasComponents = (
  raw: string
): {
  canonicalName: string;
  normalizedKey: string;
} => {
  const canonicalName = canonicalizeMerchantName(raw);
  const normalizedKey = normalizeMerchantKey(raw);
  return {
    canonicalName,
    normalizedKey,
  };
};
