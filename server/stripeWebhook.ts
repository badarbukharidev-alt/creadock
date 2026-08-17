import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { courses, customers, digitalEntitlements, emailDeliveries, enrollments, membershipPlans, orderItems, orders, paymentEvents, products, subscriptions } from "../drizzle/schema";
import { getDb } from "./db";
import { emailTemplates, sendEmail } from "./email";
import { stripeProvider } from "./payments";

export async function dispatchProductFulfillmentEmails(input: { customer: { id: number; email: string; name: string | null }; product: { name: string }; deliveryUrl: string | null; creatorId: number }) {
  await sendEmail({ to: input.customer.email, ...emailTemplates.purchase(input.customer.name || "there", input.product.name) }, { kind: "purchase_confirmation", creatorId: input.creatorId, customerId: input.customer.id });
  if (input.deliveryUrl) await sendEmail({ to: input.customer.email, ...emailTemplates.delivery(input.customer.name || "there", input.product.name, input.deliveryUrl) }, { kind: "product_delivery", creatorId: input.creatorId, customerId: input.customer.id });
}

async function completeOrder(orderId: number, paymentIntentId: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const order = (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
  if (!order || order.status === "paid") return;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const customer = order.customerId ? (await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1))[0] : null;
  await db.update(orders).set({ status: "paid", stripePaymentIntentId: paymentIntentId }).where(and(eq(orders.id, order.id), eq(orders.status, "pending")));
  for (const item of items) {
    if (item.productId) {
      const product = (await db.select().from(products).where(eq(products.id, item.productId)).limit(1))[0];
      if (product && customer) {
        const deliveryUrl = product.fileUrl || product.externalUrl || null;
        await db.insert(digitalEntitlements).values({ customerId: customer.id, productId: product.id, orderId: order.id, deliveryUrl }).onDuplicateKeyUpdate({ set: { orderId: order.id, deliveryUrl } });
        const linkedCourses = await db.select().from(courses).where(and(eq(courses.productId, product.id), eq(courses.creatorId, order.creatorId)));
        for (const course of linkedCourses) await db.insert(enrollments).values({ courseId: course.id, customerId: customer.id, completedLessonIds: [] }).onDuplicateKeyUpdate({ set: { customerId: customer.id } });
        await dispatchProductFulfillmentEmails({ customer, product, deliveryUrl, creatorId: order.creatorId });
      }
    }
    if (item.membershipPlanId && customer) {
      const plan = (await db.select().from(membershipPlans).where(eq(membershipPlans.id, item.membershipPlanId)).limit(1))[0];
      if (plan) {
        await db.insert(subscriptions).values({ planId: plan.id, customerId: customer.id, status: "active" }).onDuplicateKeyUpdate({ set: { status: "active" } });
        await sendEmail({ to: customer.email, ...emailTemplates.membership(customer.name || "there", plan.name) }, { kind: "membership_confirmation", creatorId: order.creatorId, customerId: customer.id });
      }
    }
  }
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string" || !Buffer.isBuffer(req.body)) return res.status(400).json({ error: "Missing Stripe signature or raw body" });
  try {
    const event = stripeProvider.parseWebhook(req.body, signature);
    if (event.id.startsWith("evt_test_")) return res.json({ verified: true });
    const db = await getDb();
    if (!db) throw new Error("Database is unavailable");
    const existing = (await db.select({ id: paymentEvents.id }).from(paymentEvents).where(eq(paymentEvents.providerEventId, event.id)).limit(1))[0];
    if (existing) return res.json({ received: true, duplicate: true });
    const orderId = event.data.object && "metadata" in event.data.object ? Number(event.data.object.metadata?.orderId || 0) || null : null;
    const recorded = await db.insert(paymentEvents).values({ provider: "stripe", providerEventId: event.id, eventType: event.type, orderId, status: "received", occurredAt: new Date(event.created * 1000) });
    const paymentEventId = Number(recorded[0].insertId);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const completedOrderId = Number(session.metadata?.orderId || session.client_reference_id || 0);
      if (!completedOrderId) throw new Error("Checkout event was missing order metadata");
      await completeOrder(completedOrderId, typeof session.payment_intent === "string" ? session.payment_intent : null);
    }
    await db.update(paymentEvents).set({ status: "processed", processedAt: new Date() }).where(eq(paymentEvents.id, paymentEventId));
    return res.json({ received: true });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Webhook verification failed" });
  }
}
