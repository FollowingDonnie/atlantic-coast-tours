const ENSEMBLE_URL =
  "https://ensemble-api.open-meteo.com/v1/ensemble";

export async function checkOpenMeteoEnsemble(
  place,
  date,
  fetchedAt,
  { fetchImpl = fetch } = {}
) {
  const url = new URL(ENSEMBLE_URL);
  url.searchParams.set("latitude", String(place.latitude));
  url.searchParams.set("longitude", String(place.longitude));
  url.searchParams.set("models", "icon_seamless");
  url.searchParams.set("timezone", "Europe/Dublin");
  url.searchParams.set("start_date", date);
  url.searchParams.set("end_date", date);
  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "wind_speed_10m_max"
    ].join(",")
  );

  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "AtlanticCoastToursStudentProject/1.0 (weather data via Open-Meteo)"
      }
    },
    12_000,
    fetchImpl
  );

  if (!response.ok) {
    throw new Error(
      `Open-Meteo Ensemble API returned HTTP ${response.status}.`
    );
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
      reason: "No ensemble forecast was returned for that location and date."
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
      precipitation_probability_max_percent: null,
      precipitation_total_mm: daily.precipitation_sum?.[0],
      wind_speed_max_kmh: daily.wind_speed_10m_max?.[0]
    },
    fallbackReason:
      "The standard Open-Meteo forecast host rate-limited the Render server, so the official Open-Meteo Ensemble API supplied the live forecast.",
    guidance:
      "Weather forecasts can change. Customers should recheck close to departure, especially for exposed coastal activities."
  };
}

function sourceMetadata() {
  return {
    name: "Open-Meteo Ensemble Forecast",
    url: "https://open-meteo.com/en/docs/ensemble-api"
  };
}

function weatherCodeSummary(code) {
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

async function fetchWithTimeout(url, init, timeoutMs, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
