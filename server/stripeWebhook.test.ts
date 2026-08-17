import { describe, expect, it, vi } from "vitest";

const sendEmail = vi.hoisted(() => vi.fn(async () => ({ id: 1, sent: true })));
vi.mock("./email", () => ({
  sendEmail,
  emailTemplates: {
    purchase: (name: string, product: string) => ({ subject: `Purchase ${product}`, text: name, html: "<p>purchase</p>" }),
    delivery: (name: string, product: string, url: string) => ({ subject: `Delivery ${product}`, text: `${name} ${url}`, html: "<p>delivery</p>" }),
  },
}));

const { dispatchProductFulfillmentEmails } = await import("./stripeWebhook");

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
});
