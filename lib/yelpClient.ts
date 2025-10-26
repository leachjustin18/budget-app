import "server-only";

const DEFAULT_AUTOCOMPLETE_URL = "https://api.yelp.com/v3/autocomplete";

export type YelpBusinessSuggestion = {
  id: string;
  name: string;
};

export type YelpAutocompleteResult = {
  businesses?: YelpBusinessSuggestion[];
  categories?: Array<{ alias: string; title: string }>;
  terms?: Array<{ text: string }>;
};

export type YelpAutocompleteOptions = {
  latitude?: number;
  longitude?: number;
  retries?: number;
  signal?: AbortSignal;
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });

export const fetchYelpAutocomplete = async (
  text: string,
  options: YelpAutocompleteOptions = {}
): Promise<YelpAutocompleteResult | null> => {
  if (!text.trim()) {
    return null;
  }

  const apiKey = process.env.YELP_API_KEY ?? "";
  if (!apiKey) {
    return null;
  }

  const apiUrl = process.env.YELP_API_URL ?? DEFAULT_AUTOCOMPLETE_URL;

  const maxRetries = options.retries ?? 2;
  const baseDelay = 250;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const url = new URL(apiUrl);
    url.searchParams.set("text", text);

    if (typeof options.latitude === "number" && typeof options.longitude === "number") {
      url.searchParams.set("latitude", options.latitude.toString());
      url.searchParams.set("longitude", options.longitude.toString());
    }

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: options.signal,
        cache: "no-store",
      });

      if (response.ok) {
        return (await response.json()) as YelpAutocompleteResult;
      }

      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < maxRetries
      ) {
        const wait = baseDelay * 2 ** attempt;
        await delay(wait);
        continue;
      }

      return null;
    } catch (error) {
      if (options.signal?.aborted) {
        throw error;
      }
      if (attempt < maxRetries) {
        const wait = baseDelay * 2 ** attempt;
        await delay(wait);
        continue;
      }
      return null;
    }
  }

  return null;
};
