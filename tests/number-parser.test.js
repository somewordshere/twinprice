const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = vm.createContext({});
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, "../src/content/number-parser.js"), "utf8"),
  context
);
const { parseLocaleNumber, normalizeDigits } = context.CurrencyNumberParser;

test("parses common international price formats", () => {
  assert.equal(parseLocaleNumber("1,234.56"), 1234.56);
  assert.equal(parseLocaleNumber("1.234,56"), 1234.56);
  assert.equal(parseLocaleNumber("1'234.56"), 1234.56);
  assert.equal(parseLocaleNumber("1\u202f234,56"), 1234.56);
  assert.equal(parseLocaleNumber("1.234"), 1234);
});

test("normalizes full-width digits", () => {
  assert.equal(normalizeDigits("１２３４"), "1234");
  assert.equal(parseLocaleNumber("１，２３４．５０"), 1234.5);
});

test("parses Indian grouping and Arabic digit systems", () => {
  assert.equal(parseLocaleNumber("1,23,456"), 123456);
  assert.equal(parseLocaleNumber("12,34,567.89"), 1234567.89);
  assert.equal(normalizeDigits("١٢٣٤ ۱۲۳۴"), "1234 1234");
  assert.equal(parseLocaleNumber("١٬٢٣٤٫٥٦"), 1234.56);
  assert.equal(parseLocaleNumber("۱٬۲۳۴٫۵۶"), 1234.56);
});

test("supports three-decimal currencies without changing ordinary thousands parsing", () => {
  assert.equal(parseLocaleNumber("1.234"), 1234);
  assert.equal(parseLocaleNumber("1.234", { allowThreeDecimals: true }), 1.234);
  assert.equal(parseLocaleNumber("1,234", { allowThreeDecimals: true }), 1.234);
  assert.equal(parseLocaleNumber("1.234.567", { allowThreeDecimals: true }), 1234567);
  assert.equal(parseLocaleNumber("1,234,567", { allowThreeDecimals: true }), 1234567);
  assert.equal(parseLocaleNumber("1,234.567", { allowThreeDecimals: true }), 1234.567);
  assert.equal(parseLocaleNumber("1.234,567", { allowThreeDecimals: true }), 1234.567);
});

test("rejects malformed amounts instead of converting their numeric prefix", () => {
  for (const value of ["100oops", "1.2.3", "1.234.56", "12 34", "--10", "", "Infinity", "1e3"]) {
    assert.ok(Number.isNaN(parseLocaleNumber(value)), value);
  }
  assert.equal(parseLocaleNumber("-10.00"), -10);
  assert.equal(parseLocaleNumber("−10,00"), -10);
  assert.equal(parseLocaleNumber(".5"), 0.5);
  assert.equal(parseLocaleNumber("1'234.50"), 1234.5);
});
