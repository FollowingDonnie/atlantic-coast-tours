import test from "node:test";
import assert from "node:assert/strict";
import { checkMetNorwayFallback } from "../src/tools/met-norway.mjs";

test("MET Norway fallback preserves live forecast provenance and units", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        properties: {
          timeseries: [
            {
              time: "2026-07-30T09:00:00Z",
              data: {
                instant: {
                  details: { air_temperature: 12, wind_speed: 5 }
                },
                next_1_hours: {
                  summary: { symbol_code: "lightrain" },
                  details: { precipitation_amount: 0.8 }
                }
              }
            },
            {
              time: "2026-07-30T15:00:00Z",
              data: {
                instant: {
                  details: { air_temperature: 16, wind_speed: 7 }
                },
                next_1_hours: {
                  summary: { symbol_code: "cloudy" },
                  details: { precipitation_amount: 0.2 }
                }
              }
            }
          ]
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  const result = await checkMetNorwayFallback(
    {
      name: "Galway",
      latitude: 53.27,
      longitude: -9.05
    },
    "2026-07-30",
    "2026-07-29T12:00:00.000Z",
    { fetchImpl }
  );

  assert.equal(result.available, true);
  assert.match(result.source.name, /Open-Meteo.*MET Norway/);
  assert.equal(result.forecast.summary, "rain");
  assert.equal(result.forecast.temperature_max_c, 16);
  assert.equal(result.forecast.temperature_min_c, 12);
  assert.equal(result.forecast.precipitation_total_mm, 1);
  assert.equal(result.forecast.wind_speed_max_kmh, 25.2);
});
