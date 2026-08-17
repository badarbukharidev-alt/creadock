import Stripe from "stripe";

export type CheckoutOffer = { orderId: number; customerEmail: string; title: string; amount: string; currency: string; mode: "payment" | "subscription"; successUrl: string; cancelUrl: string; metadata: Record<string, string> };

export interface PaymentProvider {
  isConfigured(): boolean;
  createCheckout(offer: CheckoutOffer): Promise<{ id: string; url: string }>;
  parseWebhook(rawBody: Buffer, signature: string): Stripe.Event;
}

class StripeProvider implements PaymentProvider {
  private get client() {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new Error("Stripe is not configured. Add the platform Stripe keys before accepting payments.");
    return new Stripe(secret, { apiVersion: "2026-07-29.dahlia" });
  }
  isConfigured() { return Boolean(process.env.STRIPE_SECRET_KEY && process.env.VITE_STRIPE_PUBLISHABLE_KEY && process.env.STRIPE_WEBHOOK_SECRET); }
  async createCheckout(offer: CheckoutOffer) {
    const unitAmount = Math.round(Number(offer.amount) * 100);
    if (!Number.isSafeInteger(unitAmount) || unitAmount < 50) throw new Error("Checkout amounts must be at least 0.50 in the selected currency.");
    const session = await this.client.checkout.sessions.create({
      mode: offer.mode,
      customer_email: offer.customerEmail,
      client_reference_id: String(offer.orderId),
      success_url: offer.successUrl,
      cancel_url: offer.cancelUrl,
      allow_promotion_codes: true,
      metadata: { orderId: String(offer.orderId), ...offer.metadata },
      line_items: [{ price_data: { currency: offer.currency.toLowerCase(), product_data: { name: offer.title }, unit_amount: unitAmount, recurring: offer.mode === "subscription" ? { interval: "month" } : undefined }, quantity: 1 }],
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { id: session.id, url: session.url };
  }
  parseWebhook(rawBody: Buffer, signature: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error("Stripe webhook signing secret is not configured.");
    return this.client.webhooks.constructEvent(rawBody, signature, secret);
  }
}

export const stripeProvider = new StripeProvider();
export const stripeStatus = () => ({ provider: "stripe", configured: stripeProvider.isConfigured(), publishableKeyConfigured: Boolean(process.env.VITE_STRIPE_PUBLISHABLE_KEY), webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET) });
