import test from "node:test";
import assert from "node:assert/strict";
import { weatherCodeSummary, weatherTool } from "../src/tools/weather.mjs";

test("Open-Meteo weather codes become customer-friendly summaries", () => {
  assert.equal(weatherCodeSummary(0), "clear");
  assert.equal(weatherCodeSummary(63), "rain");
  assert.equal(weatherCodeSummary(81), "rain showers");
  assert.equal(weatherCodeSummary(95), "thunderstorms");
});

test("the weather tool uses a strict complete schema", () => {
  assert.equal(weatherTool.strict, true);
  assert.equal(weatherTool.parameters.additionalProperties, false);
  assert.deepEqual(
    [...weatherTool.parameters.required].sort(),
    Object.keys(weatherTool.parameters.properties).sort()
  );
});

