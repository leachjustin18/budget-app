import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalizeMerchantName,
  normalizeMerchantKey,
} from "@budget/lib/merchantNormalization";

void test("merchant normalization removes domain suffixes and canonicalizes storefronts", () => {
  assert.strictEqual(canonicalizeMerchantName("Target.com"), "Target");
  assert.strictEqual(normalizeMerchantKey("Target.com"), "target");
});

void test("merchant normalization maps marketplace prefixes to canonical names", () => {
  assert.strictEqual(canonicalizeMerchantName("AMZN Mktp US *12345"), "Amazon");
  assert.strictEqual(normalizeMerchantKey("AMZN Mktp US *12345"), "amazon");
});

void test("merchant normalization strips store numbers and location hints", () => {
  assert.strictEqual(
    canonicalizeMerchantName("Starbucks Store #1234 Kansas City MO"),
    "Starbucks"
  );
  assert.strictEqual(
    normalizeMerchantKey("Starbucks Store #1234 Kansas City MO"),
    "starbucks"
  );
});

void test("merchant normalization collapses punctuation and produces title case output", () => {
  assert.strictEqual(canonicalizeMerchantName("best-buy #4433"), "Best-Buy");
  assert.strictEqual(normalizeMerchantKey("best-buy #4433"), "bestbuy");
});

void test("merchant normalization keeps descriptors when no overrides apply", () => {
  assert.strictEqual(
    canonicalizeMerchantName("Chipotle Mexican Grill 0045"),
    "Chipotle Mexican Grill"
  );
  assert.strictEqual(
    normalizeMerchantKey("Chipotle Mexican Grill 0045"),
    "chipotlemexicangrill"
  );
});

void test("merchant normalization handles url prefixed merchants", () => {
  assert.strictEqual(
    canonicalizeMerchantName("https://www.barnesandnoble.com/store/123"),
    "Barnesandnoble Com"
  );
  assert.strictEqual(
    normalizeMerchantKey("https://www.barnesandnoble.com/store/123"),
    "barnesandnoblecom"
  );
});
