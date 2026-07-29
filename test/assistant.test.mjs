import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeCustomerReply } from "../src/assistant.mjs";

test("customer replies remove internal implementation language", () => {
  const reply = sanitizeCustomerReply(
    [
      "The live Sheet shows the tour costs EUR 68.",
      "I queried the API and searched the database row with a tool call.",
      "The model then used the source data."
    ].join(" ")
  );

  assert.equal(
    reply,
    [
      "The current tour listing shows the tour costs EUR 68.",
      "I checked the service and checked the tour listing with a service check.",
      "The assistant then used the current information."
    ].join(" ")
  );
  assert.doesNotMatch(
    reply,
    /\b(?:sheet|tools?|api|database|source data|the model|queried|searched|fetched)\b/i
  );
});
