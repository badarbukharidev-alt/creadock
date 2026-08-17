import { describe, expect, it } from "vitest";
import { calculateMonthlyRecurringRevenue, makeProductSlug, normalizeTags } from "../shared/commerce";

describe("CreaDock commerce utilities", () => {
  it("creates stable URL-safe product slugs", () => {
    expect(makeProductSlug("  The Creator Kit: 2026! ")).toBe("the-creator-kit-2026");
    expect(makeProductSlug("***")).toBe("item");
  });

  it("normalizes and de-duplicates CRM tags", () => {
    expect(normalizeTags([" Customer ", "customer", "Newsletter", ""])).toEqual(["customer", "newsletter"]);
  });

  it("counts only active monthly and annual subscriptions toward MRR", () => {
    expect(calculateMonthlyRecurringRevenue([
      { price: "24", interval: "month", status: "active" },
      { price: "120", interval: "year", status: "active" },
      { price: "50", interval: "month", status: "cancelled" },
    ])).toBe(34);
  });
});
