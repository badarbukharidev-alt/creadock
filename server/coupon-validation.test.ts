import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { coupons, customers, orderItems, orders, products } from "../drizzle/schema";

const state = vi.hoisted(() => ({
  rows: new Map<unknown, Array<Record<string, unknown>>>(),
  inserts: [] as Array<{ table: unknown; values: unknown }>,
  updates: [] as Array<{ table: unknown; values: unknown }>,
  checkoutCalls: [] as Array<Record<string, unknown>>,
  nextId: 100,
  creator: { id: 1, userId: 1, handle: "creator", displayName: "Creator", isPublished: true },
}));

function queryContains(condition: unknown, expected: string | boolean): boolean {
  if (!condition || typeof condition !== "object") return false;
  const value = condition as { name?: string; value?: unknown; queryChunks?: unknown[] };
  if (value.name === expected || value.value === expected) return true;
  return value.queryChunks?.some((chunk) => queryContains(chunk, expected)) ?? false;
}

vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: (table: unknown) => {
        const rows = (condition?: unknown) => {
          const storedRows = state.rows.get(table) ?? [];
          if (table === coupons && queryContains(condition, "isActive") && queryContains(condition, true)) return storedRows.filter((coupon) => coupon.isActive === true);
          return storedRows;
        };
        const query = (condition?: unknown) => ({
          limit: async () => rows(condition),
          orderBy: async () => rows(condition),
          then: (resolve: (value: Array<Record<string, unknown>>) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(rows(condition)).then(resolve, reject),
        });
        return { where: (condition: unknown) => query(condition), orderBy: async () => rows() };
      },
    }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        state.inserts.push({ table, values });
        const id = state.nextId++;
        if (table === customers) state.rows.set(customers, [{ id, creatorId: 1, email: (values as { email: string }).email, marketingOptIn: false }]);
        if (table === orders) state.rows.set(orders, [{ id, orderNumber: `MVP-TEST-${id}` }]);
        return [{ insertId: id }];
      },
    }),
    update: (table: unknown) => ({
      set: (values: unknown) => {
        state.updates.push({ table, values });
        return { where: async () => undefined };
      },
    }),
  }),
  getCreatorForHandle: async () => state.creator,
  getOrCreateCreator: async () => state.creator,
  getCreatorDashboard: async () => ({}),
  getAdminSummary: async () => ({}),
}));

vi.mock("./payments", () => ({
  stripeProvider: {
    isConfigured: () => true,
    createCheckout: async (input: Record<string, unknown>) => {
      state.checkoutCalls.push(input);
      return { id: `cs_test_${input.orderId}`, url: `https://checkout.stripe.test/session/${input.orderId}` };
    },
  },
  stripeStatus: () => ({ configured: true }),
}));

const { appRouter } = await import("./routers");

function publicContext(): TrpcContext {
  return { user: null, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

function publishedProduct(price = "100.00") {
  return { id: 2, creatorId: 1, name: "Creator kit", status: "published", visibility: "public", price, currency: "USD" };
}

function activeCoupon(overrides: Record<string, unknown> = {}) {
  return { id: 3, creatorId: 1, code: "LAUNCH20", type: "percent", amount: "20", isActive: true, startsAt: null, expiresAt: null, minimumAmount: null, maxRedemptions: null, redemptions: 0, ...overrides };
}

beforeEach(() => {
  state.rows.clear();
  state.inserts.length = 0;
  state.updates.length = 0;
  state.checkoutCalls.length = 0;
  state.nextId = 100;
  state.rows.set(customers, []);
});

describe("storefront coupon checkout validation", () => {
  it("applies an active percentage coupon, rounds the total, and records its redemption", async () => {
    state.rows.set(products, [publishedProduct("24.99")]);
    state.rows.set(coupons, [activeCoupon({ amount: "20" })]);

    await appRouter.createCaller(publicContext()).storefront.purchase({ handle: "creator", email: "buyer@example.com", productId: 2, couponCode: "launch20" });

    expect(state.inserts).toContainEqual(expect.objectContaining({ table: orders, values: expect.objectContaining({ total: "19.99" }) }));
    expect(state.checkoutCalls).toContainEqual(expect.objectContaining({ amount: "19.99", metadata: expect.objectContaining({ couponCode: "LAUNCH20" }) }));
    expect(state.updates).toContainEqual(expect.objectContaining({ table: coupons, values: { redemptions: 1 } }));
    expect(state.inserts.some((entry) => entry.table === orderItems)).toBe(true);
  });

  it("applies an active fixed coupon without allowing a negative checkout total", async () => {
    state.rows.set(products, [publishedProduct("12.00")]);
    state.rows.set(coupons, [activeCoupon({ type: "fixed", amount: "15.00" })]);

    await appRouter.createCaller(publicContext()).storefront.purchase({ handle: "creator", email: "buyer@example.com", productId: 2, couponCode: "LAUNCH20" });

    expect(state.inserts).toContainEqual(expect.objectContaining({ table: orders, values: expect.objectContaining({ total: "0.00" }) }));
    expect(state.checkoutCalls).toContainEqual(expect.objectContaining({ amount: "0.00" }));
  });

  it.each([
    ["inactive", activeCoupon({ isActive: false })],
    ["expired", activeCoupon({ expiresAt: new Date("2000-01-01") })],
    ["not started", activeCoupon({ startsAt: new Date("2999-01-01") })],
    ["below the minimum", activeCoupon({ minimumAmount: "150.00" })],
    ["at the redemption limit", activeCoupon({ maxRedemptions: 2, redemptions: 2 })],
  ])("rejects a coupon that is %s", async (_label, coupon) => {
    state.rows.set(products, [publishedProduct("100.00")]);
    state.rows.set(coupons, [coupon]);

    await expect(appRouter.createCaller(publicContext()).storefront.purchase({ handle: "creator", email: "buyer@example.com", productId: 2, couponCode: "LAUNCH20" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "This coupon is unavailable." });
    expect(state.inserts.some((entry) => entry.table === orders)).toBe(false);
    expect(state.updates.some((entry) => entry.table === coupons)).toBe(false);
  });
});
