import { describe, it, expect } from "vitest";
import { isJsonValue, coerceJson } from "../type/json";

describe("Json type utilities", () => {
  it("isJsonValue: accepts primitives/arrays/objects recursively", () => {
    expect(isJsonValue(null)).toBe(true);
    expect(isJsonValue(true)).toBe(true);
    expect(isJsonValue(1)).toBe(true);
    expect(isJsonValue("str")).toBe(true);
    expect(isJsonValue([1, "a", null])).toBe(true);
    expect(isJsonValue({ a: 1, b: "x", c: [null] })).toBe(true);
  });

  it("isJsonValue: rejects functions/undefined/symbols", () => {
    expect(isJsonValue(undefined)).toBe(false);
    expect(isJsonValue(() => {})).toBe(false);
    expect(isJsonValue(Symbol("s"))).toBe(false);
  });

  it("coerceJson: parses valid JSON string", () => {
    const v = coerceJson('{"x":1,"y":[true,null]}');
    expect(v && typeof v === "object").toBe(true);
  });

  it("coerceJson: throws on invalid JSON string", () => {
    expect(() => coerceJson("{invalid")).toThrow();
  });
});


