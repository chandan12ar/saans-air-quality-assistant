import { describe, expect, it } from "vitest";
import { intFromEnv } from "@/lib/serverDeps";

describe("intFromEnv", () => {
  it("accepts positive integers", () => {
    expect(intFromEnv("25", 10)).toBe(25);
  });
  it.each([undefined, "", "abc", "0", "-3", "2.5", "NaN", "Infinity"])("falls back for %s", (v) => {
    expect(intFromEnv(v, 10)).toBe(10);
  });
});
