const MET_NORWAY_URL =
  "https://api.met.no/weatherapi/locationforecast/2.0/compact";

export async function checkMetNorwayFallback(
  place,
  date,
  fetchedAt,
  { fetchImpl = fetch } = {}
) {
  const url = new URL(MET_NORWAY_URL);
  url.searchParams.set("lat", String(place.latitude));
  url.searchParams.set("lon", String(place.longitude));

  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "AtlanticCoastToursStudentProject/1.0 https://followingdonnie.github.io/atlantic-coast-tours/"
      }
    },
    12_000,
    fetchImpl
  );

  if (!response.ok) {
    throw new Error(
      `Open-Meteo was rate-limited and the MET Norway fallback returned HTTP ${response.status}.`
    );
  }

  const data = await response.json();
  const periods = (data.properties?.timeseries || []).filter(
    (period) => dublinIsoDate(new Date(period.time)) === date
  );

  if (!periods.length) {
    return {
      source: sourceMetadata(),
      fetchedAt,
      available: false,
      location: place,
      date,
      reason: "No forecast was returned for that location and date.",
      fallbackReason: "Open-Meteo forecast endpoint returned HTTP 429."
    };
  }

  const temperatures = periods
    .map((period) => period.data?.instant?.details?.air_temperature)
    .filter(Number.isFinite);
  const winds = periods
    .map((period) => period.data?.instant?.details?.wind_speed)
    .filter(Number.isFinite);
  const hourlyRain = periods
    .map(
      (period) =>
        period.data?.next_1_hours?.details?.precipitation_amount ?? 0
    )
    .filter(Number.isFinite);
  const symbols = periods
    .map((period) => period.data?.next_1_hours?.summary?.symbol_code)
    .filter(Boolean);

  return {
    source: sourceMetadata(),
    fetchedAt,
    available: true,
    location: place,
    date,
    forecast: {
      summary: symbolSummary(symbols),
      temperature_max_c: temperatures.length ? Math.max(...temperatures) : null,
      temperature_min_c: temperatures.length ? Math.min(...temperatures) : null,
      precipitation_probability_max_percent: null,
      precipitation_total_mm: hourlyRain.length
        ? Number(hourlyRain.reduce((sum, value) => sum + value, 0).toFixed(1))
        : null,
      wind_speed_max_kmh: winds.length
        ? Number((Math.max(...winds) * 3.6).toFixed(1))
        : null
    },
    fallbackReason:
      "Open-Meteo supplied live geocoding but its forecast endpoint rate-limited the Render server, so MET Norway supplied the live forecast.",
    guidance:
      "Weather forecasts can change. Customers should recheck close to departure, especially for exposed coastal activities."
  };
}

function symbolSummary(symbols) {
  const joined = symbols.join(" ").toLowerCase();
  if (joined.includes("thunder")) return "thunderstorms";
  if (joined.includes("snow") || joined.includes("sleet")) {
    return "wintry showers";
  }
  if (joined.includes("rain")) return "rain";
  if (joined.includes("fog")) return "foggy";
  if (joined.includes("cloudy")) return "cloudy";
  if (joined.includes("fair")) return "mainly clear";
  if (joined.includes("clearsky")) return "clear";
  return "mixed conditions";
}

function sourceMetadata() {
  return {
    name: "Open-Meteo geocoding + MET Norway forecast",
    url: "https://api.met.no/weatherapi/locationforecast/2.0/"
  };
}

function dublinIsoDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
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
