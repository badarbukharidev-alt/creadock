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

async function completeOrder(orderId: number, paymentIntentId: string | null, stripeSubscriptionId: string | null) {
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
        await db.insert(subscriptions).values({ planId: plan.id, customerId: customer.id, stripeSubscriptionId, status: "active" }).onDuplicateKeyUpdate({ set: { status: "active", stripeSubscriptionId } });
        await sendEmail({ to: customer.email, ...emailTemplates.membership(customer.name || "there", plan.name) }, { kind: "membership_confirmation", creatorId: order.creatorId, customerId: customer.id });
      }
    }
  }
}

async function refundOrder(paymentIntentId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const order = (await db.select().from(orders).where(eq(orders.stripePaymentIntentId, paymentIntentId)).limit(1))[0];
  if (!order || order.status === "refunded") return;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  await db.update(orders).set({ status: "refunded" }).where(eq(orders.id, order.id));
  for (const item of items) {
    if (item.productId) { await db.delete(digitalEntitlements).where(and(eq(digitalEntitlements.orderId, order.id), eq(digitalEntitlements.productId, item.productId))); const linkedCourses = await db.select({ id: courses.id }).from(courses).where(and(eq(courses.productId, item.productId), eq(courses.creatorId, order.creatorId))); for (const course of linkedCourses) if (order.customerId) await db.delete(enrollments).where(and(eq(enrollments.courseId, course.id), eq(enrollments.customerId, order.customerId))); }
    if (item.membershipPlanId && order.customerId) await db.update(subscriptions).set({ status: "cancelled" }).where(and(eq(subscriptions.customerId, order.customerId), eq(subscriptions.planId, item.membershipPlanId)));
  }
}

export function mapStripeSubscriptionStatus(stripeStatus: string) {
  return stripeStatus === "active" || stripeStatus === "trialing" ? "active" : stripeStatus === "past_due" || stripeStatus === "unpaid" || stripeStatus === "incomplete" ? "past_due" : stripeStatus === "paused" ? "paused" : "cancelled";
}

async function syncSubscription(stripeSubscriptionId: string, stripeStatus: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const status = mapStripeSubscriptionStatus(stripeStatus);
  await db.update(subscriptions).set({ status }).where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
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
      await completeOrder(completedOrderId, typeof session.payment_intent === "string" ? session.payment_intent : null, typeof session.subscription === "string" ? session.subscription : null);
    }
    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      if (typeof charge.payment_intent === "string") await refundOrder(charge.payment_intent);
    }
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      await syncSubscription(subscription.id, event.type === "customer.subscription.deleted" ? "canceled" : subscription.status);
    }
    await db.update(paymentEvents).set({ status: "processed", processedAt: new Date() }).where(eq(paymentEvents.id, paymentEventId));
    return res.json({ received: true });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Webhook verification failed" });
  }
}
