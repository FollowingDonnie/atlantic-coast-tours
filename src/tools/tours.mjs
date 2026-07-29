import { parseCsv } from "../csv.mjs";

export const SHEET_ID = "1balBGf8QhZ5dc-RCCAPt2kcrcf6m_YRh0HL_r8bBtJw";
export const SHEET_GID = "120683740";
export const SHEET_TITLE = "CA2 - Atlantic Coast Tours";

const SHEET_CSV_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export` +
  `?format=csv&gid=${SHEET_GID}`;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "any",
  "are",
  "at",
  "be",
  "can",
  "do",
  "for",
  "have",
  "i",
  "in",
  "is",
  "me",
  "of",
  "on",
  "please",
  "show",
  "the",
  "this",
  "to",
  "tour",
  "tours",
  "what",
  "with",
  "you"
]);

export const searchToursTool = {
  type: "function",
  name: "search_tours",
  description:
    "Fetch and search Atlantic Coast Tours' live Google Sheet. Use for every question about tours, destinations, prices, offers, schedules, meeting points, capacity, or spaces this week.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "The customer's relevant tour request in a few words, such as 'Connemara hike' or 'special offers'."
      },
      tour_name: {
        type: ["string", "null"],
        description: "A named tour or distinctive part of its name, otherwise null."
      },
      category: {
        type: ["string", "null"],
        description:
          "Requested activity category such as Boat Tour, Cycling, Food Tour, Kayak Trip, Cliff Walk, or Outdoor Activity; otherwise null."
      },
      location: {
        type: ["string", "null"],
        description: "Requested destination or county, otherwise null."
      },
      max_price_eur: {
        type: ["number", "null"],
        description: "Maximum customer budget per person in euro, otherwise null."
      },
      availability: {
        type: "string",
        enum: ["any", "available_only", "sold_out_only"],
        description: "Whether to filter by current slots_this_week."
      },
      offers_only: {
        type: "boolean",
        description: "True only when the customer specifically asks for offers or deals."
      }
    },
    required: [
      "query",
      "tour_name",
      "category",
      "location",
      "max_price_eur",
      "availability",
      "offers_only"
    ],
    additionalProperties: false
  },
  strict: true
};

export async function fetchLiveTours({ fetchImpl = fetch } = {}) {
  const response = await fetchWithTimeout(
    SHEET_CSV_URL,
    {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache"
      }
    },
    12_000,
    fetchImpl
  );

  if (!response.ok) {
    throw new Error(`The live tour sheet returned HTTP ${response.status}.`);
  }

  const csv = await response.text();
  const rows = parseCsv(csv).map(normalizeTourRow);

  if (rows.length === 0) {
    throw new Error("The live tour sheet returned no tour rows.");
  }

  return {
    rows,
    fetchedAt: new Date().toISOString(),
    source: {
      name: "Live Google Sheet",
      title: SHEET_TITLE,
      url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`
    }
  };
}

export async function searchTours(args, options = {}) {
  const liveData = await fetchLiveTours(options);
  const matches = rankTourRows(liveData.rows, args).slice(0, 8);

  return {
    source: liveData.source,
    fetchedAt: liveData.fetchedAt,
    sheetRowCount: liveData.rows.length,
    query: args,
    matchCount: matches.length,
    tours: matches
  };
}

export function rankTourRows(rows, args) {
  const queryTokens = tokens(args.query);
  const nameTokens = tokens(args.tour_name);
  const categoryTokens = tokens(args.category);
  const locationTokens = tokens(args.location);
  const hasSpecificTarget =
    nameTokens.length > 0 || categoryTokens.length > 0 || locationTokens.length > 0;

  return rows
    .map((tour) => {
      const searchableName = normalize(tour.tour_name);
      const searchableCategory = normalize(tour.category);
      const searchableLocation = normalize(tour.location);
      const searchableAll = normalize(
        [
          tour.tour_name,
          tour.category,
          tour.location,
          tour.meeting_point,
          tour.special_offer,
          tour.description
        ].join(" ")
      );

      let score = 0;
      score += scoreTokens(nameTokens, searchableName, 8);
      score += scoreTokens(categoryTokens, searchableCategory, 6);
      score += scoreTokens(locationTokens, searchableLocation, 6);
      score += scoreTokens(queryTokens, searchableAll, 2);

      if (args.tour_name && searchableName.includes(normalize(args.tour_name))) {
        score += 18;
      }
      if (args.category && searchableCategory.includes(normalize(args.category))) {
        score += 10;
      }
      if (args.location && searchableLocation.includes(normalize(args.location))) {
        score += 10;
      }
      if (args.offers_only && tour.special_offer) {
        score += 8;
      }

      return { tour, score };
    })
    .filter(({ tour, score }) => {
      if (args.max_price_eur !== null && tour.price_eur > args.max_price_eur) {
        return false;
      }
      if (args.offers_only && !tour.special_offer) {
        return false;
      }
      if (args.availability === "sold_out_only" && tour.slots_this_week !== 0) {
        return false;
      }

      const namedTourMatch =
        nameTokens.length > 0 &&
        nameTokens.every((token) => normalize(tour.tour_name).includes(token));
      if (
        args.availability === "available_only" &&
        tour.slots_this_week === 0 &&
        !namedTourMatch
      ) {
        return false;
      }

      return !hasSpecificTarget || score > 0;
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return right.tour.slots_this_week - left.tour.slots_this_week;
    })
    .map(({ tour }) => tour);
}

export function normalizeTourRow(row) {
  const price = finiteNumber(row.price_eur);
  const slots = finiteNumber(row.slots_this_week);

  return {
    tour_id: cleanCell(row.tour_id),
    tour_name: cleanCell(row.tour_name),
    category: cleanCell(row.category),
    location: cleanCell(row.location),
    meeting_point: cleanCell(row.meeting_point),
    price_eur: price,
    duration_hours: finiteNumber(row.duration_hours),
    capacity: finiteNumber(row.capacity),
    availability: cleanCell(row.availability),
    slots_this_week: slots,
    special_offer: cleanCell(row.special_offer),
    description: sanitizeUntrustedDescription(row.description),
    data_quality: {
      suspicious_price: price > 1_000,
      sold_out_this_week: slots === 0
    }
  };
}

export function sanitizeUntrustedDescription(value) {
  return cleanCell(value)
    .replace(
      /\s*(?:note|instruction|message)\s+to\s+(?:the\s+)?(?:ai|assistant|model)\s*:[\s\S]*$/i,
      ""
    )
    .trim();
}

function cleanCell(value) {
  return String(value ?? "").replace(/[\u0000-\u001f]+/g, " ").trim();
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function tokens(value) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function scoreTokens(needles, haystack, weight) {
  return needles.reduce(
    (score, token) => score + (haystack.includes(token) ? weight : 0),
    0
  );
}

async function fetchWithTimeout(url, init, timeoutMs, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

