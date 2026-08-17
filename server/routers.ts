import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { makeProductSlug, normalizeTags } from "../shared/commerce";
import { mergeCompletedLesson, mvpActiveMembership, mvpCampaignSent, mvpConfirmedBooking, mvpPaidOrder } from "../shared/mvp-workflows";
import {
  appointments,
  availabilitySlots,
  courses,
  creators,
  customers,
  digitalEntitlements,
  emailAudiences,
  emailCampaigns,
  emailSequenceSteps,
  emailSequences,
  enrollments,
  lessons,
  membershipPlans,
  orders,
  orderItems,
  products,
  services,
  storeVisits,
  storefrontBlocks,
  subscriptions,
  supportTickets,
} from "../drizzle/schema";
import { getAdminSummary, getCreatorDashboard, getCreatorForHandle, getDb, getOrCreateCreator } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";

const requireDb = async () => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is unavailable" });
  return db;
};

async function ownedCreator(ctx: { user: { id: number; name?: string | null } }) {
  return getOrCreateCreator(ctx.user);
}

async function getOrCreateCustomer(db: Awaited<ReturnType<typeof requireDb>>, creatorId: number, email: string, name?: string, marketingOptIn = false) {
  const current = (await db.select().from(customers).where(and(eq(customers.creatorId, creatorId), eq(customers.email, email))).limit(1))[0];
  if (current) {
    if (marketingOptIn && !current.marketingOptIn) await db.update(customers).set({ marketingOptIn: true }).where(eq(customers.id, current.id));
    return current;
  }
  const result = await db.insert(customers).values({ creatorId, email, name: name ?? null, tags: marketingOptIn ? ["subscriber"] : ["customer"], marketingOptIn });
  return (await db.select().from(customers).where(eq(customers.id, Number(result[0].insertId))).limit(1))[0]!;
}

function mvpOrderNumber() {
  return `MVP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

const productInput = z.object({
  id: z.number().int().optional(),
  name: z.string().min(2).max(255),
  description: z.string().max(8000).optional(),
  type: z.enum(["digital", "course", "service", "membership", "external"]),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  status: z.enum(["draft", "published", "archived"]),
  fileUrl: z.string().url().optional().or(z.literal("")),
  externalUrl: z.string().url().optional().or(z.literal("")),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    overview: protectedProcedure.query(async ({ ctx }) => getCreatorDashboard((await ownedCreator(ctx)).id)),
  }),
  creator: router({
    mine: protectedProcedure.query(async ({ ctx }) => ownedCreator(ctx)),
    update: protectedProcedure.input(z.object({
      displayName: z.string().min(2).max(160),
      bio: z.string().max(600).optional(),
      handle: z.string().min(3).max(64).regex(/^[a-z0-9-]+$/),
      theme: z.enum(["minimal", "creator", "editorial", "business", "education", "dark"]),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      isPublished: z.boolean(),
    })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const creator = await ownedCreator(ctx);
      const conflict = await db.select({ id: creators.id }).from(creators).where(and(eq(creators.handle, input.handle), eq(creators.userId, creator.userId))).limit(1);
      if (!conflict.length && input.handle !== creator.handle) {
        const used = await db.select({ id: creators.id }).from(creators).where(eq(creators.handle, input.handle)).limit(1);
        if (used.length) throw new TRPCError({ code: "CONFLICT", message: "This storefront handle is already in use" });
      }
      await db.update(creators).set(input).where(eq(creators.id, creator.id));
      return (await db.select().from(creators).where(eq(creators.id, creator.id)).limit(1))[0];
    }),
  }),
  products: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb(); const creator = await ownedCreator(ctx);
      return db.select().from(products).where(eq(products.creatorId, creator.id)).orderBy(desc(products.createdAt));
    }),
    save: protectedProcedure.input(productInput).mutation(async ({ ctx, input }) => {
      const db = await requireDb(); const creator = await ownedCreator(ctx);
      const payload = { ...input, slug: makeProductSlug(input.name), fileUrl: input.fileUrl || null, externalUrl: input.externalUrl || null };
      if (input.id) {
        await db.update(products).set(payload).where(and(eq(products.id, input.id), eq(products.creatorId, creator.id)));
        return input.id;
      }
      const inserted = await db.insert(products).values({ ...payload, creatorId: creator.id });
      return Number(inserted[0].insertId);
    }),
  }),
  courses: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb(); const creator = await ownedCreator(ctx);
      return db.select().from(courses).where(eq(courses.creatorId, creator.id)).orderBy(desc(courses.createdAt));
    }),
    create: protectedProcedure.input(z.object({ title: z.string().min(2).max(255), description: z.string().max(8000).optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb(); const creator = await ownedCreator(ctx);
      const result = await db.insert(courses).values({ ...input, creatorId: creator.id }); return Number(result[0].insertId);
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int(), title: z.string().min(2).max(255), description: z.string().max(8000).optional(), status: z.enum(["draft", "published"]) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb(); const creator = await ownedCreator(ctx);
      await db.update(courses).set({ title: input.title, description: input.description, status: input.status }).where(and(eq(courses.id, input.id), eq(courses.creatorId, creator.id)));
      return { success: true };
    }),
    lessons: protectedProcedure.input(z.object({ courseId: z.number().int() })).query(async ({ ctx, input }) => {
      const db = await requireDb(); const creator = await ownedCreator(ctx);
      const course = (await db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.creatorId, creator.id))).limit(1))[0];
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      return db.select().from(lessons).where(eq(lessons.courseId, input.courseId)).orderBy(lessons.sortOrder);
    }),
    addLesson: protectedProcedure.input(z.object({ courseId: z.number().int(), title: z.string().min(2).max(255), kind: z.enum(["text", "video", "download"]), body: z.string().max(20000).optional(), videoUrl: z.string().url().optional() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb(); const creator = await ownedCreator(ctx);
      const course = (await db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.creatorId, creator.id))).limit(1))[0];
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      const current = await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.courseId, input.courseId));
      const result = await db.insert(lessons).values({ ...input, sortOrder: current.length }); return Number(result[0].insertId);
    }),
    updateLesson: protectedProcedure.input(z.object({ id: z.number().int(), courseId: z.number().int(), title: z.string().min(2).max(255), kind: z.enum(["text", "video", "download"]), body: z.string().max(20000).optional() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); const course = (await db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.creatorId, creator.id))).limit(1))[0]; if (!course) throw new TRPCError({ code: "NOT_FOUND" }); await db.update(lessons).set({ title: input.title, kind: input.kind, body: input.body ?? null }).where(and(eq(lessons.id, input.id), eq(lessons.courseId, course.id))); return { success: true }; }),
    deleteLesson: protectedProcedure.input(z.object({ id: z.number().int(), courseId: z.number().int() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); const course = (await db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.creatorId, creator.id))).limit(1))[0]; if (!course) throw new TRPCError({ code: "NOT_FOUND" }); await db.delete(lessons).where(and(eq(lessons.id, input.id), eq(lessons.courseId, course.id))); return { success: true }; }),
    reorderLessons: protectedProcedure.input(z.object({ courseId: z.number().int(), lessonIds: z.array(z.number().int()).min(1) })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); const course = (await db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.creatorId, creator.id))).limit(1))[0]; if (!course) throw new TRPCError({ code: "NOT_FOUND" }); await Promise.all(input.lessonIds.map((id, sortOrder) => db.update(lessons).set({ sortOrder }).where(and(eq(lessons.id, id), eq(lessons.courseId, course.id))))); return { success: true }; }),
    progress: protectedProcedure.input(z.object({ courseId: z.number().int() })).query(async ({ ctx, input }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); const course = (await db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.creatorId, creator.id))).limit(1))[0]; if (!course) throw new TRPCError({ code: "NOT_FOUND" }); return db.select().from(enrollments).innerJoin(customers, eq(enrollments.customerId, customers.id)).where(eq(enrollments.courseId, course.id)); }),
  }),
  bookings: router({
    services: protectedProcedure.query(async ({ ctx }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); return db.select().from(services).where(eq(services.creatorId, creator.id)); }),
    createService: protectedProcedure.input(z.object({ name: z.string().min(2).max(255), description: z.string().max(4000).optional(), durationMinutes: z.number().int().min(15).max(480), capacity: z.number().int().min(1).max(100), price: z.string().regex(/^\d+(\.\d{1,2})?$/), status: z.enum(["draft", "published"]) })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); const result = await db.insert(services).values({ ...input, creatorId: creator.id }); return Number(result[0].insertId); }),
    addAvailability: protectedProcedure.input(z.object({ serviceId: z.number().int(), startsAt: z.date(), endsAt: z.date() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); const service = (await db.select().from(services).where(and(eq(services.id, input.serviceId), eq(services.creatorId, creator.id))).limit(1))[0]; if (!service) throw new TRPCError({ code: "NOT_FOUND" }); const result = await db.insert(availabilitySlots).values(input); return Number(result[0].insertId); }),
    availability: protectedProcedure.input(z.object({ serviceId: z.number().int() })).query(async ({ ctx, input }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); const service = (await db.select().from(services).where(and(eq(services.id, input.serviceId), eq(services.creatorId, creator.id))).limit(1))[0]; if (!service) throw new TRPCError({ code: "NOT_FOUND" }); return db.select().from(availabilitySlots).where(eq(availabilitySlots.serviceId, input.serviceId)).orderBy(availabilitySlots.startsAt); }),
    appointments: protectedProcedure.query(async ({ ctx }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); return db.select().from(appointments).innerJoin(services, eq(appointments.serviceId, services.id)).innerJoin(customers, eq(appointments.customerId, customers.id)).where(eq(services.creatorId, creator.id)).orderBy(desc(appointments.createdAt)); }),
    updateAppointment: protectedProcedure.input(z.object({ id: z.number().int(), status: z.enum(["pending", "confirmed", "cancelled", "completed"]) })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); const appointment = (await db.select().from(appointments).innerJoin(services, eq(appointments.serviceId, services.id)).where(and(eq(appointments.id, input.id), eq(services.creatorId, creator.id))).limit(1))[0]; if (!appointment) throw new TRPCError({ code: "NOT_FOUND" }); await db.update(appointments).set({ status: input.status }).where(eq(appointments.id, input.id)); return { success: true }; }),
  }),
  memberships: router({
    list: protectedProcedure.query(async ({ ctx }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); return db.select().from(membershipPlans).where(eq(membershipPlans.creatorId, creator.id)); }),
    create: protectedProcedure.input(z.object({ name: z.string().min(2).max(255), description: z.string().max(4000).optional(), benefits: z.array(z.string().min(1).max(220)).max(20), price: z.string().regex(/^\d+(\.\d{1,2})?$/), interval: z.enum(["month", "year"]), status: z.enum(["draft", "published", "archived"]) })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); const result = await db.insert(membershipPlans).values({ ...input, creatorId: creator.id }); return Number(result[0].insertId); }),
  }),
  customers: router({
    list: protectedProcedure.query(async ({ ctx }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); return db.select().from(customers).where(eq(customers.creatorId, creator.id)).orderBy(desc(customers.createdAt)); }),
    save: protectedProcedure.input(z.object({ name: z.string().max(255).optional(), email: z.string().email(), tags: z.array(z.string().max(64)).max(20).optional(), marketingOptIn: z.boolean().default(false) })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); const tags = normalizeTags(input.tags ?? []); await db.insert(customers).values({ ...input, creatorId: creator.id, tags }).onDuplicateKeyUpdate({ set: { name: input.name ?? null, tags, marketingOptIn: input.marketingOptIn } }); return { success: true }; }),
  }),
  marketing: router({
    overview: protectedProcedure.query(async ({ ctx }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); const [audiences, campaigns, sequences] = await Promise.all([db.select().from(emailAudiences).where(eq(emailAudiences.creatorId, creator.id)), db.select().from(emailCampaigns).where(eq(emailCampaigns.creatorId, creator.id)).orderBy(desc(emailCampaigns.createdAt)), db.select().from(emailSequences).where(eq(emailSequences.creatorId, creator.id))]); return { audiences, campaigns, sequences }; }),
    createAudience: protectedProcedure.input(z.object({ name: z.string().min(2).max(255), description: z.string().max(1000).optional() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); const result = await db.insert(emailAudiences).values({ ...input, creatorId: creator.id }); return Number(result[0].insertId); }),
    createCampaign: protectedProcedure.input(z.object({ audienceId: z.number().int().optional(), subject: z.string().min(2).max(255), previewText: z.string().max(255).optional(), body: z.string().min(2).max(20000), status: z.enum(["draft", "scheduled"]), scheduledFor: z.date().optional() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); const result = await db.insert(emailCampaigns).values({ ...input, creatorId: creator.id }); return Number(result[0].insertId); }),
    markSent: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); await db.update(emailCampaigns).set(mvpCampaignSent()).where(and(eq(emailCampaigns.id, input.id), eq(emailCampaigns.creatorId, creator.id))); return { success: true }; }),
    createSequence: protectedProcedure.input(z.object({ name: z.string().min(2).max(255), trigger: z.enum(["signup", "purchase", "enrollment"]), steps: z.array(z.object({ subject: z.string().min(2).max(255), body: z.string().min(2).max(20000), delayDays: z.number().int().min(0).max(365) })).min(1).max(20) })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); const result = await db.insert(emailSequences).values({ name: input.name, trigger: input.trigger, creatorId: creator.id, isActive: true }); const sequenceId = Number(result[0].insertId); await db.insert(emailSequenceSteps).values(input.steps.map((step, sortOrder) => ({ ...step, sequenceId, sortOrder }))); return sequenceId; }),
  }),
  storefront: router({
    publicPage: publicProcedure.input(z.object({ handle: z.string().min(3).max(64) })).query(async ({ input }) => {
      const db = await requireDb(); const creator = await getCreatorForHandle(input.handle); if (!creator) throw new TRPCError({ code: "NOT_FOUND" });
      await db.insert(storeVisits).values({ creatorId: creator.id });
      const [catalog, memberships, bookingServices, blocks, courseCatalog] = await Promise.all([
        db.select().from(products).where(and(eq(products.creatorId, creator.id), eq(products.status, "published"))),
        db.select().from(membershipPlans).where(and(eq(membershipPlans.creatorId, creator.id), eq(membershipPlans.status, "published"))),
        db.select().from(services).where(and(eq(services.creatorId, creator.id), eq(services.status, "published"))),
        db.select().from(storefrontBlocks).where(and(eq(storefrontBlocks.creatorId, creator.id), eq(storefrontBlocks.isVisible, true))).orderBy(storefrontBlocks.sortOrder),
        db.select().from(courses).where(and(eq(courses.creatorId, creator.id), eq(courses.status, "published"))),
      ]);
      return { creator, catalog, memberships, bookingServices, blocks, courses: courseCatalog };
    }),
    subscribe: publicProcedure.input(z.object({ handle: z.string().min(3).max(64), email: z.string().email(), name: z.string().max(255).optional() })).mutation(async ({ input }) => {
      const db = await requireDb();
      const creator = await getCreatorForHandle(input.handle);
      if (!creator) throw new TRPCError({ code: "NOT_FOUND" });
      await db.insert(customers).values({ creatorId: creator.id, email: input.email, name: input.name ?? null, tags: ["subscriber"], marketingOptIn: true }).onDuplicateKeyUpdate({ set: { marketingOptIn: true } });
      return { success: true };
    }),
    purchase: publicProcedure.input(z.object({ handle: z.string().min(3).max(64), email: z.string().email(), name: z.string().max(255).optional(), productId: z.number().int().optional(), membershipPlanId: z.number().int().optional() }).refine((input) => Boolean(input.productId) !== Boolean(input.membershipPlanId), "Select one offer to purchase")).mutation(async ({ input }) => {
      const db = await requireDb(); const creator = await getCreatorForHandle(input.handle); if (!creator) throw new TRPCError({ code: "NOT_FOUND" });
      const customer = await getOrCreateCustomer(db, creator.id, input.email, input.name);
      if (input.productId) {
        const product = (await db.select().from(products).where(and(eq(products.id, input.productId), eq(products.creatorId, creator.id), eq(products.status, "published"))).limit(1))[0];
        if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Offer is unavailable" });
        const orderResult = await db.insert(orders).values({ creatorId: creator.id, customerId: customer.id, orderNumber: mvpOrderNumber(), ...mvpPaidOrder(), total: product.price, currency: product.currency });
        const orderId = Number(orderResult[0].insertId);
        await db.insert(orderItems).values({ orderId, productId: product.id, title: product.name, unitPrice: product.price });
        const deliveryUrl = product.fileUrl || product.externalUrl || null;
        await db.insert(digitalEntitlements).values({ customerId: customer.id, productId: product.id, orderId, deliveryUrl }).onDuplicateKeyUpdate({ set: { orderId, deliveryUrl } });
        const linkedCourses = await db.select().from(courses).where(and(eq(courses.creatorId, creator.id), eq(courses.productId, product.id)));
        for (const course of linkedCourses) await db.insert(enrollments).values({ courseId: course.id, customerId: customer.id, completedLessonIds: [] }).onDuplicateKeyUpdate({ set: { customerId: customer.id } });
        return { kind: "product" as const, orderId, orderNumber: (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0]!.orderNumber, deliveryUrl, productName: product.name };
      }
      const plan = (await db.select().from(membershipPlans).where(and(eq(membershipPlans.id, input.membershipPlanId!), eq(membershipPlans.creatorId, creator.id), eq(membershipPlans.status, "published"))).limit(1))[0];
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Membership is unavailable" });
      const orderResult = await db.insert(orders).values({ creatorId: creator.id, customerId: customer.id, orderNumber: mvpOrderNumber(), ...mvpPaidOrder(), total: plan.price });
      const orderId = Number(orderResult[0].insertId);
      await db.insert(orderItems).values({ orderId, membershipPlanId: plan.id, title: plan.name, unitPrice: plan.price });
      await db.insert(subscriptions).values({ planId: plan.id, customerId: customer.id, ...mvpActiveMembership() }).onDuplicateKeyUpdate({ set: mvpActiveMembership() });
      return { kind: "membership" as const, orderId, orderNumber: (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0]!.orderNumber, planName: plan.name };
    }),
    book: publicProcedure.input(z.object({ handle: z.string().min(3).max(64), serviceId: z.number().int(), slotId: z.number().int().optional(), email: z.string().email(), name: z.string().max(255).optional() })).mutation(async ({ input }) => {
      const db = await requireDb(); const creator = await getCreatorForHandle(input.handle); if (!creator) throw new TRPCError({ code: "NOT_FOUND" });
      const service = (await db.select().from(services).where(and(eq(services.id, input.serviceId), eq(services.creatorId, creator.id), eq(services.status, "published"))).limit(1))[0]; if (!service) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.slotId) { const slot = (await db.select().from(availabilitySlots).where(and(eq(availabilitySlots.id, input.slotId), eq(availabilitySlots.serviceId, service.id), eq(availabilitySlots.isBooked, false))).limit(1))[0]; if (!slot) throw new TRPCError({ code: "CONFLICT", message: "That time is no longer available" }); await db.update(availabilitySlots).set({ isBooked: true }).where(eq(availabilitySlots.id, slot.id)); }
      const customer = await getOrCreateCustomer(db, creator.id, input.email, input.name); const result = await db.insert(appointments).values({ serviceId: service.id, customerId: customer.id, slotId: input.slotId ?? null, ...mvpConfirmedBooking() }); return { appointmentId: Number(result[0].insertId), serviceName: service.name };
    }),
    courseDetail: publicProcedure.input(z.object({ handle: z.string().min(3).max(64), courseId: z.number().int() })).query(async ({ input }) => { const db = await requireDb(); const creator = await getCreatorForHandle(input.handle); if (!creator) throw new TRPCError({ code: "NOT_FOUND" }); const course = (await db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.creatorId, creator.id), eq(courses.status, "published"))).limit(1))[0]; if (!course) throw new TRPCError({ code: "NOT_FOUND" }); return { course, lessons: await db.select().from(lessons).where(eq(lessons.courseId, course.id)).orderBy(lessons.sortOrder) }; }),
    completeLesson: publicProcedure.input(z.object({ handle: z.string().min(3).max(64), courseId: z.number().int(), lessonId: z.number().int(), email: z.string().email(), name: z.string().max(255).optional() })).mutation(async ({ input }) => { const db = await requireDb(); const creator = await getCreatorForHandle(input.handle); if (!creator) throw new TRPCError({ code: "NOT_FOUND" }); const course = (await db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.creatorId, creator.id), eq(courses.status, "published"))).limit(1))[0]; if (!course) throw new TRPCError({ code: "NOT_FOUND" }); const lesson = (await db.select().from(lessons).where(and(eq(lessons.id, input.lessonId), eq(lessons.courseId, course.id))).limit(1))[0]; if (!lesson) throw new TRPCError({ code: "NOT_FOUND" }); const customer = await getOrCreateCustomer(db, creator.id, input.email, input.name); const enrollment = (await db.select().from(enrollments).where(and(eq(enrollments.courseId, course.id), eq(enrollments.customerId, customer.id))).limit(1))[0]; const prior = enrollment?.completedLessonIds ?? []; const completed = mergeCompletedLesson(prior, lesson.id); if (enrollment) await db.update(enrollments).set({ completedLessonIds: completed, completedAt: completed.length === (await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.courseId, course.id))).length ? new Date() : null }).where(eq(enrollments.id, enrollment.id)); else await db.insert(enrollments).values({ courseId: course.id, customerId: customer.id, completedLessonIds: completed }); return { completedLessonIds: completed }; }),
  }),
  admin: router({
    overview: adminProcedure.query(() => getAdminSummary()),
    tickets: adminProcedure.query(async () => { const db = await requireDb(); return db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)); }),
    updateTicket: adminProcedure.input(z.object({ id: z.number().int(), status: z.enum(["open", "in_progress", "resolved"]) })).mutation(async ({ input }) => { const db = await requireDb(); await db.update(supportTickets).set({ status: input.status }).where(eq(supportTickets.id, input.id)); return { success: true }; }),
  }),
});

export type AppRouter = typeof appRouter;
