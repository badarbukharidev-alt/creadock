import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appointments, courses, customers, digitalEntitlements, emailCampaigns, emailDeliveries, enrollments, lessons, membershipPlans, orderItems, orders, products, services, subscriptions } from "../drizzle/schema";

const state = vi.hoisted(() => ({
  rows: new Map<unknown, Array<Record<string, unknown>>>(),
  inserts: [] as Array<{ table: unknown; values: unknown }>,
  updates: [] as Array<{ table: unknown; values: unknown }>,
  nextId: 10,
  creator: { id: 1, userId: 1, handle: "creator", displayName: "Creator", isPublished: true },
}));

vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: (table: unknown) => {
        const rows = () => state.rows.get(table) ?? [];
        const query = {
          limit: async () => rows(),
          orderBy: async () => rows(),
          then: (resolve: (value: Array<Record<string, unknown>>) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(rows()).then(resolve, reject),
        };
        return { where: () => query, orderBy: async () => rows() };
      },
    }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        state.inserts.push({ table, values });
        const id = state.nextId++;
        if (table === customers) state.rows.set(customers, [{ id, creatorId: 1, email: (values as { email: string }).email, marketingOptIn: false }]);
        if (table === orders) state.rows.set(orders, [{ id, orderNumber: `MVP-TEST-${id}` }]);
        const result = [{ insertId: id }] as Array<{ insertId: number }> & { onDuplicateKeyUpdate?: (args: unknown) => Promise<void> };
        result.onDuplicateKeyUpdate = async () => undefined;
        return result;
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
    createCheckout: async ({ orderId }: { orderId: number }) => ({ id: `cs_test_${orderId}`, url: `https://checkout.stripe.test/session/${orderId}` }),
  },
  stripeStatus: () => ({ configured: true }),
}));

const { appRouter } = await import("./routers");

function creatorContext(): TrpcContext {
  return {
    user: { id: 1, openId: "creator", name: "Creator", email: "creator@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(() => {
  state.rows.clear(); state.inserts.length = 0; state.updates.length = 0; state.nextId = 10;
});

describe("CreaDock commerce router success paths", () => {
  it("creates a pending product order and a real Stripe Checkout Session", async () => {
    state.rows.set(products, [{ id: 2, creatorId: 1, name: "Creator kit", status: "published", price: "24.00", currency: "USD", fileUrl: "/manus-storage/kit.pdf", externalUrl: null }]);
    state.rows.set(customers, []); state.rows.set(lessons, []);
    const result = await appRouter.createCaller(creatorContext()).storefront.purchase({ handle: "creator", email: "buyer@example.com", productId: 2 });
    expect(result).toMatchObject({ kind: "product", productName: "Creator kit" });
    expect(result.checkoutUrl).toContain("https://checkout.stripe.test/session/");
    expect(state.inserts.some((entry) => entry.table === orders && (entry.values as { status: string }).status === "pending")).toBe(true);
    expect(state.inserts.some((entry) => entry.table === orderItems)).toBe(true);
    expect(state.inserts.some((entry) => entry.table === digitalEntitlements)).toBe(false);
  });

  it("creates a pending membership order and a Stripe subscription checkout", async () => {
    state.rows.set(membershipPlans, [{ id: 3, creatorId: 1, name: "Studio", status: "published", price: "12.00", interval: "month" }]); state.rows.set(customers, []);
    const result = await appRouter.createCaller(creatorContext()).storefront.purchase({ handle: "creator", email: "member@example.com", membershipPlanId: 3 });
    expect(result).toMatchObject({ kind: "membership", planName: "Studio" });
    expect(result.checkoutUrl).toContain("https://checkout.stripe.test/session/");
    expect(state.inserts.some((entry) => entry.table === subscriptions)).toBe(false);
  });

  it("confirms an MVP booking reservation", async () => {
    state.rows.set(services, [{ id: 4, creatorId: 1, name: "Office hours", status: "published" }]); state.rows.set(customers, []);
    const result = await appRouter.createCaller(creatorContext()).storefront.book({ handle: "creator", serviceId: 4, email: "guest@example.com" });
    expect(result).toMatchObject({ serviceName: "Office hours" });
    expect(state.inserts.some((entry) => entry.table === appointments && (entry.values as { status: string }).status === "confirmed")).toBe(true);
    expect(state.inserts.some((entry) => entry.table === emailDeliveries && (entry.values as { kind: string }).kind === "booking_confirmation")).toBe(true);
  });

  it("persists completed course lesson progress", async () => {
    state.rows.set(courses, [{ id: 5, creatorId: 1, title: "Craft", status: "published" }]);
    state.rows.set(lessons, [{ id: 6, courseId: 5, title: "Start", kind: "text" }]); state.rows.set(customers, []); state.rows.set(enrollments, []);
    const result = await appRouter.createCaller(creatorContext()).storefront.completeLesson({ handle: "creator", courseId: 5, lessonId: 6, email: "student@example.com" });
    expect(result).toEqual({ completedLessonIds: [6] });
    expect(state.inserts.some((entry) => entry.table === enrollments && JSON.stringify((entry.values as { completedLessonIds: number[] }).completedLessonIds) === "[6]")).toBe(true);
  });

  it("marks a creator campaign sent", async () => {
    await appRouter.createCaller(creatorContext()).marketing.markSent({ id: 7 });
    expect(state.updates.some((entry) => entry.table === emailCampaigns && (entry.values as { status: string }).status === "sent")).toBe(true);
  });
});
