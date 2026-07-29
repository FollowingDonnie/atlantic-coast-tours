# Human + AI Build Notes

Project: Atlantic Coast Tours  
Student: 25146041  
Build partner: OpenAI Codex

These notes capture decisions, pain points, and fixes from the build process.
They are not the final assessment reflection.

## Architecture decisions

- GitHub Pages can host the customer interface but cannot safely hold an API
  key. A small Render service therefore protects the OpenAI key and runs the
  language-model tool loop.
- The Google Sheet is a live data source, not an application backend. The server
  fetches its public CSV export for every relevant question and deliberately
  keeps no catalogue cache or copy.
- The language model selects strict function tools. `search_tours` reads the
  Sheet; `check_weather` geocodes the destination and requests a live forecast.
- Sheet text is treated as untrusted data. Instruction-like phrases are removed
  before rows reach the model, while numeric values are preserved exactly.
- Suspicious numbers are never silently corrected. They are reported, clearly
  caveated, and referred for staff confirmation.

## Problems and what changed

1. **Secrets and static hosting**
   - Pain point: it was initially easy to think the Sheet and OpenAI together
     removed the need for a server.
   - Learning: browser code would expose the OpenAI key. The final split is a
     public static frontend plus a server-side API.

2. **Keyword-only retrieval**
   - Pain point: the prototype missed valid concepts such as microchipping and
     telehealth when exact keywords were absent from a fixed allow-list.
   - Learning: the final tool accepts structured filters and free-text intent,
     then searches all relevant row fields. The model is not blocked by a
     brittle topic gate.

3. **Untrusted Sheet content**
   - Pain point: two descriptions contained text addressed to an AI, attempting
     to influence how absurd prices were handled.
   - Fix: sanitize instruction-like text as data-channel prompt injection,
     preserve the original numeric value, and attach a separate quality flag.

4. **Zero availability and special offers**
   - Pain point: an attractive offer could make a sold-out tour sound bookable.
   - Fix: named sold-out rows remain retrievable, and the assistant states zero
     spaces before discussing the offer or alternatives.

5. **Combined tool questions**
   - Pain point: a model initially sent a landmark name to the geocoder instead
     of the town returned by the tour row.
   - Fix: the prompt requires a sequential flow: Sheet lookup first, then an
     exact-town weather lookup, with one structured retry if geocoding fails.

6. **Customer waiting state**
   - Pain point: without visible feedback, a correct model call looked frozen.
   - Fix: the interface shows a changing human-readable typing state and disables
     duplicate sends while a request is active.

7. **Technical trace in the customer UI**
   - Pain point: raw tool names and traces were useful during development but
     inappropriate for customers.
   - Fix: the interface shows only friendly source provenance and a Dublin-time
     live-check timestamp.

8. **Responsive layout**
   - Pain point: a long textarea placeholder overflowed on a narrow mobile view.
   - Fix: shorten the prompt and run automated desktop/mobile overflow checks.

9. **Render-only weather failure**
   - Pain point: Open-Meteo worked locally but returned HTTP 429 from Render's
     shared outbound IP.
   - Fix: retain Open-Meteo as the primary source and live geocoder, retry
     transient responses once, then transparently use the official MET Norway
     forecast API only for the rate-limited forecast. Provenance names both
     providers; the model never misattributes the result.

10. **Verification harness mismatch**
    - Pain point: the first deployment probe read `answer` while the API returns
      `reply`, producing misleading null output even though tools had run.
    - Fix: inspect one raw response, align the harness with the actual contract,
      and retain a repeatable browser-level acceptance test.

## Verification performed

- Nine automated unit tests.
- Live Google Sheet check confirming all 30 rows and the zero-slot trap.
- Live weather check.
- Live edge cases: off-topic request, special offers, zero availability,
  implausible price, and a combined tour-plus-weather question.
- Headless Chrome checks at desktop and mobile sizes.
- End-to-end browser test through the GitHub Pages URL and Render API.

## AI use

Codex was used to inspect the brief, research official API documentation, plan
the architecture, generate and review code, diagnose failures, run tests,
publish to GitHub, and prepare evidence. The student directed the requirements,
tested the deployed interaction, questioned design decisions, supplied account
access and secrets through environment settings, and remains responsible for
the judgement and final reflection.
