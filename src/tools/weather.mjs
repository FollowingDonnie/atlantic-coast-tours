import { checkMetNorwayFallback } from "./met-norway.mjs";
import { checkOpenMeteoEnsemble } from "./open-meteo-ensemble.mjs";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export const weatherTool = {
  type: "function",
  name: "check_weather",
  description:
    "Get a live Open-Meteo forecast for an Atlantic Coast Tours destination. Use whenever the customer asks about weather, rain, temperature, wind, or suitability for a dated trip.",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description:
          "Irish destination, town, or county from the customer's question or a matched tour."
      },
      date: {
        type: ["string", "null"],
        description:
          "Forecast date in YYYY-MM-DD format. Resolve relative dates using today's date supplied in the system instructions; use null when no date is requested."
      }
    },
    required: ["location", "date"],
    additionalProperties: false
  },
  strict: true
};

export async function checkWeather(args, { fetchImpl = fetch } = {}) {
  const fetchedAt = new Date().toISOString();
  const place = await geocodeIrishLocation(args.location, fetchImpl);
  const date = args.date || localIsoDate(new Date());
  validateIsoDate(date);

  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(place.latitude));
  url.searchParams.set("longitude", String(place.longitude));
  url.searchParams.set("timezone", "Europe/Dublin");
  url.searchParams.set("start_date", date);
  url.searchParams.set("end_date", date);
  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "wind_speed_10m_max"
    ].join(",")
  );

  const response = await fetchWithTimeout(
    url,
    { headers: weatherRequestHeaders() },
    12_000,
    fetchImpl
  );

  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 429) {
      try {
        return await checkOpenMeteoEnsemble(place, date, fetchedAt, { fetchImpl });
      } catch {
        return checkMetNorwayFallback(place, date, fetchedAt, { fetchImpl });
      }
    }
    if (response.status === 400) {
      return {
        source: sourceMetadata(),
        fetchedAt,
        available: false,
        location: place,
        date,
        reason:
          "Open-Meteo cannot provide that date. It may be outside the available forecast window.",
        providerDetail: detail.slice(0, 180)
      };
    }
    throw new Error(`Open-Meteo forecast returned HTTP ${response.status}.`);
  }

  const data = await response.json();
  const daily = data.daily;
  if (!daily?.time?.length) {
    return {
      source: sourceMetadata(),
      fetchedAt,
      available: false,
      location: place,
      date,
      reason: "No forecast was returned for that location and date."
    };
  }

  return {
    source: sourceMetadata(),
    fetchedAt,
    available: true,
    location: place,
    date: daily.time[0],
    forecast: {
      summary: weatherCodeSummary(daily.weather_code?.[0]),
      weather_code: daily.weather_code?.[0],
      temperature_max_c: daily.temperature_2m_max?.[0],
      temperature_min_c: daily.temperature_2m_min?.[0],
      precipitation_probability_max_percent:
        daily.precipitation_probability_max?.[0],
      wind_speed_max_kmh: daily.wind_speed_10m_max?.[0]
    },
    guidance:
      "Weather forecasts can change. Customers should recheck close to departure, especially for exposed coastal activities."
  };
}

export async function geocodeIrishLocation(location, fetchImpl = fetch) {
  const query = String(location ?? "")
    .replace(/\bCo\.\s*/gi, "")
    .replace(/\bCounty\s+/gi, "")
    .split(",")[0]
    .trim();

  if (!query) {
    throw new Error("A location is required for a weather lookup.");
  }

  const url = new URL(GEOCODING_URL);
  url.searchParams.set("name", query);
  url.searchParams.set("count", "10");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  url.searchParams.set("countryCode", "IE");

  const response = await fetchWithTimeout(
    url,
    { headers: weatherRequestHeaders() },
    10_000,
    fetchImpl
  );
  if (!response.ok) {
    throw new Error(`Open-Meteo geocoding returned HTTP ${response.status}.`);
  }

  const data = await response.json();
  const result = data.results?.find((candidate) => candidate.country_code === "IE");
  if (!result) {
    throw new Error(`No Irish location matching "${location}" was found.`);
  }

  return {
    requested: location,
    name: result.name,
    county: result.admin1 || result.admin2 || "",
    country: result.country,
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone
  };
}

export function weatherCodeSummary(code) {
  if (code === 0) return "clear";
  if ([1, 2].includes(code)) return "mainly clear";
  if (code === 3) return "overcast";
  if ([45, 48].includes(code)) return "foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "rain";
  if ([71, 73, 75, 77].includes(code)) return "snow";
  if ([80, 81, 82].includes(code)) return "rain showers";
  if ([85, 86].includes(code)) return "snow showers";
  if ([95, 96, 99].includes(code)) return "thunderstorms";
  return "mixed conditions";
}

function validateIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T12:00:00Z`))) {
    throw new Error(`Invalid forecast date "${value}".`);
  }
}

function localIsoDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}
function weatherRequestHeaders() {
  return {
    Accept: "application/json",
    "User-Agent":
      "AtlanticCoastToursStudentProject/1.0 (weather data via Open-Meteo)"
  };
}


function sourceMetadata() {
  return {
    name: "Open-Meteo",
    url: "https://open-meteo.com/"
  };
}

async function fetchWithTimeout(url, init, timeoutMs, fetchImpl) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

