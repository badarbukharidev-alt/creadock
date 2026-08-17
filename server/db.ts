import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  appointments,
  availabilitySlots,
  courses,
  creators,
  customers,
  emailAudiences,
  emailCampaigns,
  emailSequenceSteps,
  emailSequences,
  enrollments,
  lessons,
  membershipPlans,
  orders,
  products,
  services,
  storeVisits,
  storefrontBlocks,
  subscriptions,
  supportTickets,
  type InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    _db = drizzle(process.env.DATABASE_URL);
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { ...user, lastSignedIn: user.lastSignedIn ?? new Date() };
  if (!values.role && user.openId === ENV.ownerOpenId) values.role = "admin";
  await db.insert(users).values(values).onDuplicateKeyUpdate({
    set: {
      name: values.name ?? null,
      email: values.email ?? null,
      loginMethod: values.loginMethod ?? null,
      lastSignedIn: new Date(),
    },
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

function handleFrom(name: string | null | undefined, userId: number) {
  const source = (name || "creator").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 34) || "creator";
  return `${source}${userId}`;
}

export async function getOrCreateCreator(user: { id: number; name?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const existing = (await db.select().from(creators).where(eq(creators.userId, user.id)).limit(1))[0];
  if (existing) return existing;
  const base = handleFrom(user.name, user.id);
  let handle = base;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const duplicate = (await db.select({ id: creators.id }).from(creators).where(eq(creators.handle, handle)).limit(1))[0];
    if (!duplicate) break;
    handle = `${base}${attempt + 2}`;
  }
  await db.insert(creators).values({ userId: user.id, handle, displayName: user.name || "My creator store" });
  return (await db.select().from(creators).where(eq(creators.userId, user.id)).limit(1))[0]!;
}

export async function getCreatorForHandle(handle: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(creators).where(and(eq(creators.handle, handle), eq(creators.isPublished, true))).limit(1))[0];
}

export async function getCreatorDashboard(creatorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [orderRows, customerRows, subscriptionRows, productRows, visitRows] = await Promise.all([
    db.select().from(orders).where(eq(orders.creatorId, creatorId)).orderBy(desc(orders.createdAt)).limit(12),
    db.select().from(customers).where(eq(customers.creatorId, creatorId)),
    db.select().from(subscriptions).innerJoin(membershipPlans, eq(subscriptions.planId, membershipPlans.id)).where(eq(membershipPlans.creatorId, creatorId)),
    db.select().from(products).where(eq(products.creatorId, creatorId)),
    db.select({ count: sql<number>`count(*)` }).from(storeVisits).where(eq(storeVisits.creatorId, creatorId)),
  ]);
  const paidOrders = orderRows.filter((order) => order.status === "paid");
  const revenue = paidOrders.reduce((total, order) => total + Number(order.total), 0);
  const activeSubscriptions = subscriptionRows.filter(({ subscriptions: subscription }) => subscription.status === "active");
  const mrr = activeSubscriptions.reduce((total, { membershipPlans: plan }) => total + Number(plan.price) / (plan.interval === "year" ? 12 : 1), 0);
  return {
    revenue,
    mrr,
    orders: paidOrders.length,
    customers: customerRows.length,
    storeViews: Number(visitRows[0]?.count ?? 0),
    conversionRate: customerRows.length && productRows.length ? Math.min(100, Number(((paidOrders.length / Math.max(customerRows.length, 1)) * 100).toFixed(1))) : 0,
    recentOrders: orderRows,
    activeSubscribers: activeSubscriptions.length,
  };
}

export async function getAdminSummary() {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [creatorRows, orderRows, ticketRows] = await Promise.all([
    db.select().from(creators),
    db.select().from(orders).where(eq(orders.status, "paid")),
    db.select().from(supportTickets).where(eq(supportTickets.status, "open")),
  ]);
  return {
    creators: creatorRows.length,
    platformRevenue: orderRows.reduce((total, order) => total + Number(order.total), 0),
    paidOrders: orderRows.length,
    openTickets: ticketRows.length,
    recentCreators: creatorRows.slice(-8).reverse(),
  };
}

export const tables = {
  appointments,
  availabilitySlots,
  courses,
  creators,
  customers,
  emailAudiences,
  emailCampaigns,
  emailSequenceSteps,
  emailSequences,
  enrollments,
  lessons,
  membershipPlans,
  orders,
  products,
  services,
  storefrontBlocks,
  subscriptions,
  supportTickets,
};
