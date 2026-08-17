import { beforeEach, describe, expect, it, vi } from "vitest";
import { courses, customers, enrollments, membershipPlans, orderItems, orders, paymentEvents, subscriptions } from "../drizzle/schema";

const state = vi.hoisted(() => ({
  rows: new Map<unknown, Array<Record<string, unknown>>>(),
  inserts: [] as Array<{ table: unknown; values: unknown }>,
  updates: [] as Array<{ table: unknown; values: unknown }>,
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
        return { where: () => query };
      },
    }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        state.inserts.push({ table, values });
        return { onDuplicateKeyUpdate: async () => [{ insertId: 901 }], then: (resolve: (value: Array<{ insertId: number }>) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve([{ insertId: 901 }]).then(resolve, reject) };
      },
    }),
    update: (table: unknown) => ({ set: (values: unknown) => { state.updates.push({ table, values }); return { where: async () => undefined }; } }),
  }),
}));

const parseWebhook = vi.hoisted(() => vi.fn());
vi.mock("./payments", () => ({ stripeProvider: { parseWebhook } }));

const sendEmail = vi.hoisted(() => vi.fn(async () => ({ id: 1, sent: true })));
vi.mock("./email", () => ({
  sendEmail,
  emailTemplates: {
    purchase: (name: string, product: string) => ({ subject: `Purchase ${product}`, text: name, html: "<p>purchase</p>" }),
    delivery: (name: string, product: string, url: string) => ({ subject: `Delivery ${product}`, text: `${name} ${url}`, html: "<p>delivery</p>" }),
    membership: (name: string, plan: string) => ({ subject: `Membership ${plan}`, text: name, html: "<p>membership</p>" }),
  },
}));

const { dispatchProductFulfillmentEmails, handleStripeWebhook, mapStripeSubscriptionStatus } = await import("./stripeWebhook");

beforeEach(() => {
  state.rows.clear();
  state.inserts.length = 0;
  state.updates.length = 0;
  sendEmail.mockClear();
});

describe("Stripe fulfillment delivery", () => {
  it("records both a purchase confirmation and private product delivery when a file is available", async () => {
    await dispatchProductFulfillmentEmails({ customer: { id: 7, email: "buyer@example.com", name: "Avery" }, product: { name: "Creator Kit" }, deliveryUrl: "https://signed.example/download", creatorId: 3 });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[0]?.[1]).toMatchObject({ kind: "purchase_confirmation", customerId: 7 });
    expect(sendEmail.mock.calls[1]?.[1]).toMatchObject({ kind: "product_delivery", customerId: 7 });
  });
  it("does not create a product-delivery email when no delivery resource is attached", async () => {
    sendEmail.mockClear();
    await dispatchProductFulfillmentEmails({ customer: { id: 8, email: "buyer@example.com", name: null }, product: { name: "Service" }, deliveryUrl: null, creatorId: 3 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0]?.[1]).toMatchObject({ kind: "purchase_confirmation" });
  });
  it("maps paid and trialing Stripe subscriptions to active access", () => {
    expect(mapStripeSubscriptionStatus("active")).toBe("active");
    expect(mapStripeSubscriptionStatus("trialing")).toBe("active");
  });
  it("maps delinquent Stripe subscription states to past-due access", () => {
    expect(mapStripeSubscriptionStatus("past_due")).toBe("past_due");
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("past_due");
  });
  it("maps pauses and cancellation to the local access states", () => {
    expect(mapStripeSubscriptionStatus("paused")).toBe("paused");
    expect(mapStripeSubscriptionStatus("canceled")).toBe("cancelled");
  });

  it("creates membership-sourced enrollment records for every included course after checkout fulfillment", async () => {
    state.rows.set(orders, [{ id: 501, creatorId: 11, customerId: 7, status: "pending" }]);
    state.rows.set(orderItems, [{ id: 601, orderId: 501, membershipPlanId: 33, productId: null }]);
    state.rows.set(customers, [{ id: 7, email: "member@example.com", name: "Avery" }]);
    state.rows.set(membershipPlans, [{ id: 33, name: "Studio", accessRules: { includedCourseIds: [81, 82] } }]);
    state.rows.set(courses, [{ id: 81, creatorId: 11, title: "Included course" }, { id: 82, creatorId: 11, title: "Another included course" }]);
    state.rows.set(paymentEvents, []);
    parseWebhook.mockReturnValue({
      id: "evt_live_membership_501",
      type: "checkout.session.completed",
      created: 1_785_000_000,
      data: { object: { metadata: { orderId: "501" }, payment_intent: "pi_501", subscription: "sub_501" } },
    });
    const response = { status: vi.fn(() => response), json: vi.fn(() => response) };

    await handleStripeWebhook({ headers: { "stripe-signature": "verified" }, body: Buffer.from("event") } as never, response as never);

    expect(state.inserts).toContainEqual(expect.objectContaining({ table: subscriptions, values: expect.objectContaining({ planId: 33, customerId: 7, status: "active", stripeSubscriptionId: "sub_501" }) }));
    expect(state.inserts).toContainEqual(expect.objectContaining({ table: enrollments, values: expect.objectContaining({ courseId: 81, customerId: 7, membershipPlanId: 33, completedLessonIds: [] }) }));
    expect(state.inserts).toContainEqual(expect.objectContaining({ table: enrollments, values: expect.objectContaining({ courseId: 82, customerId: 7, membershipPlanId: 33, completedLessonIds: [] }) }));
    expect(response.json).toHaveBeenCalledWith({ received: true });
  });
});
