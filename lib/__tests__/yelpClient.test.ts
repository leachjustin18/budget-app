import test from "node:test";
import assert from "node:assert/strict";
import { fetchYelpAutocomplete } from "@budget/lib/yelpClient";

void test("yelp client returns null when API key is not configured", async () => {
  const result = await fetchYelpAutocomplete("Target");
  assert.strictEqual(result, null);
});
