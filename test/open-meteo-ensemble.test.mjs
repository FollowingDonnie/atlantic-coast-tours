import test from "node:test";
import assert from "node:assert/strict";
import { checkOpenMeteoEnsemble } from "../src/tools/open-meteo-ensemble.mjs";

test("Open-Meteo ensemble fallback returns a daily live forecast", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        daily: {
          time: ["2026-07-30"],
          weather_code: [61],
          temperature_2m_max: [16.2],
          temperature_2m_min: [11.4],
          precipitation_sum: [2.6],
          wind_speed_10m_max: [28.1]
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  const result = await checkOpenMeteoEnsemble(
    {
      name: "Letterfrack",
      latitude: 53.55,
      longitude: -9.95
    },
    "2026-07-30",
    "2026-07-29T12:00:00.000Z",
    { fetchImpl }
  );

  assert.equal(result.available, true);
  assert.equal(result.source.name, "Open-Meteo Ensemble Forecast");
  assert.equal(result.forecast.summary, "rain");
  assert.equal(result.forecast.temperature_max_c, 16.2);
  assert.equal(result.forecast.precipitation_total_mm, 2.6);
  assert.match(result.fallbackReason, /official Open-Meteo Ensemble API/);
});
