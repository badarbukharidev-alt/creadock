import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { makeProductSlug, normalizeTags } from "../shared/commerce";
import { mergeCompletedLesson, mvpActiveMembership, mvpCampaignSent, mvpConfirmedBooking, mvpPaidOrder } from "../shared/mvp-workflows";
import {
  auditLogs,
  appointments,
  availabilitySlots,
  courses,
  creators,
  customers,
  digitalEntitlements,
  emailAudiences,
  emailCampaigns,
  emailDeliveries,
  emailSequenceSteps,
  emailSequences,
  enrollments,
  lessons,
  membershipPlans,
  orders,
  orderItems,
  paymentEvents,
  platformSettings,
  products,
  services,
  storeVisits,
  storefrontBlocks,
  subscriptions,
  supportTickets,
  userSessions,
  users,
} from "../drizzle/schema";
import { getAdminSummary, getCreatorDashboard, getCreatorForHandle, getDb, getOrCreateCreator } from "./db";
import { login, logoutAll, logoutCurrent, requestPasswordReset, resetPassword, signUp, verifyEmail } from "./auth";
import { emailTemplates, sendEmail } from "./email";
import { stripeProvider } from "./payments";
import { smtpStatus } from "./email";
import { stripeStatus } from "./payments";
import { storageGetObjectSize, storageGetSignedUrl } from "./storage";
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

async function getOrCreateCustomer(db: Awaited<ReturnType<typeof requireDb>>, creatorId: number, email: string, name?: string, marketingOptIn = false, userId?: number) {
  const normalizedEmail = email.trim().toLowerCase();
  const current = (await db.select().from(customers).where(and(eq(customers.creatorId, creatorId), eq(customers.email, normalizedEmail))).limit(1))[0];
  if (current) {
    if ((marketingOptIn && !current.marketingOptIn) || (userId && current.userId !== userId)) await db.update(customers).set({ marketingOptIn: marketingOptIn || current.marketingOptIn, userId: userId ?? current.userId }).where(eq(customers.id, current.id));
    return current;
  }
  const result = await db.insert(customers).values({ creatorId, userId: userId ?? null, email: normalizedEmail, name: name ?? null, tags: marketingOptIn ? ["subscriber"] : ["customer"], marketingOptIn });
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
  fileSizeBytes: z.number().int().min(0).max(2_147_483_647).optional(),
  externalUrl: z.string().url().optional().or(z.literal("")),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    signUp: publicProcedure.input(z.object({ name: z.string().trim().min(2).max(160), email: z.string().email().max(320), username: z.string().min(3).max(32), password: z.string().min(12).max(128), confirmPassword: z.string().min(12).max(128) })).mutation(async ({ ctx, input }) => {
      if (input.password !== input.confirmPassword) throw new TRPCError({ code: "BAD_REQUEST", message: "Passwords do not match." });
      const db = await requireDb();
      const settings = (await db.select({ allowPublicSignups: platformSettings.allowPublicSignups }).from(platformSettings).where(eq(platformSettings.id, 1)).limit(1))[0];
      if (settings && !settings.allowPublicSignups) throw new TRPCError({ code: "FORBIDDEN", message: "New account registration is temporarily unavailable." });
      const result = await signUp(input, ctx.req);
      if (!result.ok) throw new TRPCError({ code: result.code as "BAD_REQUEST" | "CONFLICT", message: result.message });
      await sendEmail({ to: input.email, ...emailTemplates.verification(input.name, result.verificationToken, ctx.req) }, { kind: "verification", userId: result.userId });
      return { success: true, message: "Account created. Check your email to verify your CreaDock account." };
    }),
    login: publicProcedure.input(z.object({ email: z.string().email().max(320), password: z.string().min(1).max(128), remember: z.boolean().default(true) })).mutation(async ({ ctx, input }) => {
      const result = await login(input, ctx.req, ctx.res);
      if (!result.ok) throw new TRPCError({ code: result.code as "UNAUTHORIZED" | "FORBIDDEN" | "TOO_MANY_REQUESTS", message: result.message });
      return { success: true, user: result.user };
    }),
    verifyEmail: publicProcedure.input(z.object({ token: z.string().min(20).max(256) })).mutation(async ({ ctx, input }) => {
      const result = await verifyEmail(input.token, ctx.req, ctx.res);
      if (!result.ok) throw new TRPCError({ code: "BAD_REQUEST", message: result.message });
      await sendEmail({ to: result.user.email || "", ...emailTemplates.welcome(result.user.name || "there") }, { kind: "welcome", userId: result.user.id });
      return { success: true };
    }),
    requestPasswordReset: publicProcedure.input(z.object({ email: z.string().email().max(320) })).mutation(async ({ ctx, input }) => {
      const result = await requestPasswordReset(input.email, ctx.req);
      if (result.resetToken) {
        await sendEmail({ to: result.user.email || input.email, ...emailTemplates.passwordReset(result.user.name || "there", result.resetToken, ctx.req) }, { kind: "password_reset", userId: result.user.id });
      }
      return { success: true, message: "If an eligible account exists, a reset email has been requested." };
    }),
    resetPassword: publicProcedure.input(z.object({ token: z.string().min(20).max(256), password: z.string().min(12).max(128), confirmPassword: z.string().min(12).max(128) })).mutation(async ({ ctx, input }) => {
      if (input.password !== input.confirmPassword) throw new TRPCError({ code: "BAD_REQUEST", message: "Passwords do not match." });
      const result = await resetPassword(input.token, input.password, ctx.req);
      if (!result.ok) throw new TRPCError({ code: "BAD_REQUEST", message: result.message });
      return { success: true };
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => { await logoutCurrent(ctx.req, ctx.res); return { success: true } as const; }),
    logoutAll: protectedProcedure.mutation(async ({ ctx }) => { await logoutAll(ctx.user.id, ctx.req, ctx.res); return { success: true } as const; }),
    sessions: protectedProcedure.query(async ({ ctx }) => { const db = await requireDb(); return db.select({ id: userSessions.id, expiresAt: userSessions.expiresAt, lastUsedAt: userSessions.lastUsedAt, revokedAt: userSessions.revokedAt, ipAddress: userSessions.ipAddress, userAgent: userSessions.userAgent, createdAt: userSessions.createdAt }).from(userSessions).where(eq(userSessions.userId, ctx.user.id)).orderBy(desc(userSessions.createdAt)); }),
    revokeSession: protectedProcedure.input(z.object({ id: z.string().min(12).max(64) })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const session = (await db.select({ id: userSessions.id }).from(userSessions).where(and(eq(userSessions.id, input.id), eq(userSessions.userId, ctx.user.id))).limit(1))[0]; if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." }); await db.update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.id, input.id)); await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "auth.session.revoked", entityType: "session", entityId: input.id, ipAddress: ctx.req.ip || null }); return { success: true }; }),
    securityEvents: protectedProcedure.query(async ({ ctx }) => { const db = await requireDb(); return db.select().from(auditLogs).where(eq(auditLogs.actorUserId, ctx.user.id)).orderBy(desc(auditLogs.createdAt)).limit(100); }),
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
      const payload = { ...input, slug: makeProductSlug(input.name), fileUrl: input.fileUrl || null, fileKey: input.fileUrl?.startsWith("/manus-storage/") ? input.fileUrl.replace("/manus-storage/", "") : null, fileSizeBytes: input.fileSizeBytes ?? 0, externalUrl: input.externalUrl || null };
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
    subscribers: protectedProcedure.query(async ({ ctx }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); return db.select().from(subscriptions).innerJoin(membershipPlans, eq(subscriptions.planId, membershipPlans.id)).innerJoin(customers, eq(subscriptions.customerId, customers.id)).where(eq(membershipPlans.creatorId, creator.id)).orderBy(desc(subscriptions.createdAt)); }),
    updateSubscriber: protectedProcedure.input(z.object({ id: z.number().int(), status: z.enum(["active", "past_due", "cancelled", "paused"]) })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); const subscription = (await db.select().from(subscriptions).innerJoin(membershipPlans, eq(subscriptions.planId, membershipPlans.id)).where(and(eq(subscriptions.id, input.id), eq(membershipPlans.creatorId, creator.id))).limit(1))[0]; if (!subscription) throw new TRPCError({ code: "NOT_FOUND" }); await db.update(subscriptions).set({ status: input.status }).where(eq(subscriptions.id, input.id)); return { success: true }; }),
  }),
  customers: router({
    list: protectedProcedure.query(async ({ ctx }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); return db.select().from(customers).where(eq(customers.creatorId, creator.id)).orderBy(desc(customers.createdAt)); }),
    save: protectedProcedure.input(z.object({ name: z.string().max(255).optional(), email: z.string().email(), tags: z.array(z.string().max(64)).max(20).optional(), marketingOptIn: z.boolean().default(false) })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); const tags = normalizeTags(input.tags ?? []); await db.insert(customers).values({ ...input, creatorId: creator.id, tags }).onDuplicateKeyUpdate({ set: { name: input.name ?? null, tags, marketingOptIn: input.marketingOptIn } }); return { success: true }; }),
    activity: protectedProcedure.input(z.object({ customerId: z.number().int() })).query(async ({ ctx, input }) => { const db = await requireDb(); const creator = await ownedCreator(ctx); const customer = (await db.select().from(customers).where(and(eq(customers.id, input.customerId), eq(customers.creatorId, creator.id))).limit(1))[0]; if (!customer) throw new TRPCError({ code: "NOT_FOUND" }); const [purchaseHistory, memberships, bookings, enrollmentsForCustomer] = await Promise.all([db.select().from(orders).where(and(eq(orders.customerId, customer.id), eq(orders.creatorId, creator.id))).orderBy(desc(orders.createdAt)), db.select().from(subscriptions).innerJoin(membershipPlans, eq(subscriptions.planId, membershipPlans.id)).where(eq(subscriptions.customerId, customer.id)), db.select().from(appointments).innerJoin(services, eq(appointments.serviceId, services.id)).where(eq(appointments.customerId, customer.id)), db.select().from(enrollments).innerJoin(courses, eq(enrollments.courseId, courses.id)).where(eq(enrollments.customerId, customer.id))]); return { customer, purchaseHistory, memberships, bookings, enrollments: enrollmentsForCustomer }; }),
  }),
  account: router({
    purchases: protectedProcedure.query(async ({ ctx }) => { const db = await requireDb(); return db.select().from(orders).innerJoin(customers, eq(orders.customerId, customers.id)).innerJoin(orderItems, eq(orderItems.orderId, orders.id)).where(eq(customers.userId, ctx.user.id)).orderBy(desc(orders.createdAt)); }),
    learning: protectedProcedure.query(async ({ ctx }) => { const db = await requireDb(); return db.select().from(enrollments).innerJoin(customers, eq(enrollments.customerId, customers.id)).innerJoin(courses, eq(enrollments.courseId, courses.id)).where(eq(customers.userId, ctx.user.id)); }),
    bookings: protectedProcedure.query(async ({ ctx }) => { const db = await requireDb(); return db.select().from(appointments).innerJoin(customers, eq(appointments.customerId, customers.id)).innerJoin(services, eq(appointments.serviceId, services.id)).where(eq(customers.userId, ctx.user.id)).orderBy(desc(appointments.createdAt)); }),
    memberships: protectedProcedure.query(async ({ ctx }) => { const db = await requireDb(); return db.select().from(subscriptions).innerJoin(customers, eq(subscriptions.customerId, customers.id)).innerJoin(membershipPlans, eq(subscriptions.planId, membershipPlans.id)).where(eq(customers.userId, ctx.user.id)).orderBy(desc(subscriptions.createdAt)); }),
    course: protectedProcedure.input(z.object({ courseId: z.number().int() })).query(async ({ ctx, input }) => { const db = await requireDb(); const row = (await db.select().from(enrollments).innerJoin(customers, eq(enrollments.customerId, customers.id)).innerJoin(courses, eq(enrollments.courseId, courses.id)).where(and(eq(customers.userId, ctx.user.id), eq(enrollments.courseId, input.courseId))).limit(1))[0]; if (!row) throw new TRPCError({ code: "FORBIDDEN", message: "You are not enrolled in this course." }); return { course: row.courses, enrollment: row.enrollments, lessons: await db.select().from(lessons).where(eq(lessons.courseId, input.courseId)).orderBy(lessons.sortOrder) }; }),
    completeLesson: protectedProcedure.input(z.object({ courseId: z.number().int(), lessonId: z.number().int() })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const row = (await db.select().from(enrollments).innerJoin(customers, eq(enrollments.customerId, customers.id)).where(and(eq(customers.userId, ctx.user.id), eq(enrollments.courseId, input.courseId))).limit(1))[0]; if (!row) throw new TRPCError({ code: "FORBIDDEN", message: "You are not enrolled in this course." }); const lesson = (await db.select({ id: lessons.id }).from(lessons).where(and(eq(lessons.id, input.lessonId), eq(lessons.courseId, input.courseId))).limit(1))[0]; if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found." }); const completedLessonIds = mergeCompletedLesson(row.enrollments.completedLessonIds ?? [], input.lessonId); const lessonCount = (await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.courseId, input.courseId))).length; await db.update(enrollments).set({ completedLessonIds, completedAt: completedLessonIds.length === lessonCount ? new Date() : null }).where(eq(enrollments.id, row.enrollments.id)); return { completedLessonIds }; }),
    download: protectedProcedure.input(z.object({ productId: z.number().int() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const row = (await db.select().from(digitalEntitlements).innerJoin(customers, eq(digitalEntitlements.customerId, customers.id)).innerJoin(products, eq(digitalEntitlements.productId, products.id)).where(and(eq(customers.userId, ctx.user.id), eq(digitalEntitlements.productId, input.productId))).limit(1))[0];
      if (!row) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this product." });
      const fileKey = row.products.fileKey || (row.products.fileUrl?.startsWith("/manus-storage/") ? row.products.fileUrl.replace("/manus-storage/", "") : null);
      if (!fileKey) throw new TRPCError({ code: "NOT_FOUND", message: "No protected file is attached to this product." });
      return { url: await storageGetSignedUrl(fileKey), filename: row.products.name };
    }),
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
    subscribe: publicProcedure.input(z.object({ handle: z.string().min(3).max(64), email: z.string().email(), name: z.string().max(255).optional() })).mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const creator = await getCreatorForHandle(input.handle);
      if (!creator) throw new TRPCError({ code: "NOT_FOUND" });
      await getOrCreateCustomer(db, creator.id, input.email, input.name, true, ctx.user?.normalizedEmail === input.email.trim().toLowerCase() ? ctx.user.id : undefined);
      return { success: true };
    }),
    purchase: publicProcedure.input(z.object({ handle: z.string().min(3).max(64), email: z.string().email(), name: z.string().max(255).optional(), productId: z.number().int().optional(), membershipPlanId: z.number().int().optional() }).refine((input) => Boolean(input.productId) !== Boolean(input.membershipPlanId), "Select one offer to purchase")).mutation(async ({ input, ctx }) => {
      const db = await requireDb(); const creator = await getCreatorForHandle(input.handle); if (!creator) throw new TRPCError({ code: "NOT_FOUND" });
      if (!stripeProvider.isConfigured()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Payments are not configured yet. Add Stripe keys in the platform settings." });
      const customer = await getOrCreateCustomer(db, creator.id, input.email, input.name, false, ctx.user?.normalizedEmail === input.email.trim().toLowerCase() ? ctx.user.id : undefined);
      const host = ctx.req.headers.host || "localhost";
      const origin = ctx.req.headers.origin || `${ctx.req.protocol === "https" ? "https" : "http"}://${host}`;
      if (input.productId) {
        const product = (await db.select().from(products).where(and(eq(products.id, input.productId), eq(products.creatorId, creator.id), eq(products.status, "published"))).limit(1))[0];
        if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Offer is unavailable" });
        const orderResult = await db.insert(orders).values({ creatorId: creator.id, customerId: customer.id, orderNumber: mvpOrderNumber(), status: "pending", total: product.price, currency: product.currency });
        const orderId = Number(orderResult[0].insertId);
        await db.insert(orderItems).values({ orderId, productId: product.id, title: product.name, unitPrice: product.price });
        const checkout = await stripeProvider.createCheckout({ orderId, customerEmail: customer.email, title: product.name, amount: String(product.price), currency: product.currency, mode: "payment", successUrl: `${origin}/c/${input.handle}?checkout=success&session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${origin}/c/${input.handle}?checkout=cancelled`, metadata: { creatorId: String(creator.id), customerId: String(customer.id), productId: String(product.id) } });
        await db.update(orders).set({ stripeCheckoutSessionId: checkout.id }).where(eq(orders.id, orderId));
        return { kind: "product" as const, orderId, checkoutUrl: checkout.url, productName: product.name };
      }
      const plan = (await db.select().from(membershipPlans).where(and(eq(membershipPlans.id, input.membershipPlanId!), eq(membershipPlans.creatorId, creator.id), eq(membershipPlans.status, "published"))).limit(1))[0];
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Membership is unavailable" });
      const orderResult = await db.insert(orders).values({ creatorId: creator.id, customerId: customer.id, orderNumber: mvpOrderNumber(), status: "pending", total: plan.price });
      const orderId = Number(orderResult[0].insertId);
      await db.insert(orderItems).values({ orderId, membershipPlanId: plan.id, title: plan.name, unitPrice: plan.price });
      const checkout = await stripeProvider.createCheckout({ orderId, customerEmail: customer.email, title: plan.name, amount: String(plan.price), currency: "USD", mode: "subscription", successUrl: `${origin}/c/${input.handle}?checkout=success&session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${origin}/c/${input.handle}?checkout=cancelled`, metadata: { creatorId: String(creator.id), customerId: String(customer.id), membershipPlanId: String(plan.id) } });
      await db.update(orders).set({ stripeCheckoutSessionId: checkout.id }).where(eq(orders.id, orderId));
      return { kind: "membership" as const, orderId, checkoutUrl: checkout.url, planName: plan.name };
    }),
    book: publicProcedure.input(z.object({ handle: z.string().min(3).max(64), serviceId: z.number().int(), slotId: z.number().int().optional(), email: z.string().email(), name: z.string().max(255).optional() })).mutation(async ({ input, ctx }) => {
      const db = await requireDb(); const creator = await getCreatorForHandle(input.handle); if (!creator) throw new TRPCError({ code: "NOT_FOUND" });
      const service = (await db.select().from(services).where(and(eq(services.id, input.serviceId), eq(services.creatorId, creator.id), eq(services.status, "published"))).limit(1))[0]; if (!service) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.slotId) { const slot = (await db.select().from(availabilitySlots).where(and(eq(availabilitySlots.id, input.slotId), eq(availabilitySlots.serviceId, service.id), eq(availabilitySlots.isBooked, false))).limit(1))[0]; if (!slot) throw new TRPCError({ code: "CONFLICT", message: "That time is no longer available" }); await db.update(availabilitySlots).set({ isBooked: true }).where(eq(availabilitySlots.id, slot.id)); }
      const customer = await getOrCreateCustomer(db, creator.id, input.email, input.name, false, ctx.user?.normalizedEmail === input.email.trim().toLowerCase() ? ctx.user.id : undefined); const result = await db.insert(appointments).values({ serviceId: service.id, customerId: customer.id, slotId: input.slotId ?? null, ...mvpConfirmedBooking() }); await sendEmail({ to: customer.email, ...emailTemplates.booking(customer.name || "there", service.name) }, { kind: "booking_confirmation", creatorId: creator.id, customerId: customer.id }); return { appointmentId: Number(result[0].insertId), serviceName: service.name };
    }),
    courseDetail: publicProcedure.input(z.object({ handle: z.string().min(3).max(64), courseId: z.number().int() })).query(async ({ input }) => { const db = await requireDb(); const creator = await getCreatorForHandle(input.handle); if (!creator) throw new TRPCError({ code: "NOT_FOUND" }); const course = (await db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.creatorId, creator.id), eq(courses.status, "published"))).limit(1))[0]; if (!course) throw new TRPCError({ code: "NOT_FOUND" }); return { course, lessons: await db.select().from(lessons).where(eq(lessons.courseId, course.id)).orderBy(lessons.sortOrder) }; }),
    completeLesson: publicProcedure.input(z.object({ handle: z.string().min(3).max(64), courseId: z.number().int(), lessonId: z.number().int(), email: z.string().email(), name: z.string().max(255).optional() })).mutation(async ({ input, ctx }) => { const db = await requireDb(); const creator = await getCreatorForHandle(input.handle); if (!creator) throw new TRPCError({ code: "NOT_FOUND" }); const course = (await db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.creatorId, creator.id), eq(courses.status, "published"))).limit(1))[0]; if (!course) throw new TRPCError({ code: "NOT_FOUND" }); const lesson = (await db.select().from(lessons).where(and(eq(lessons.id, input.lessonId), eq(lessons.courseId, course.id))).limit(1))[0]; if (!lesson) throw new TRPCError({ code: "NOT_FOUND" }); const customer = await getOrCreateCustomer(db, creator.id, input.email, input.name, false, ctx.user?.normalizedEmail === input.email.trim().toLowerCase() ? ctx.user.id : undefined); const enrollment = (await db.select().from(enrollments).where(and(eq(enrollments.courseId, course.id), eq(enrollments.customerId, customer.id))).limit(1))[0]; const prior = enrollment?.completedLessonIds ?? []; const completed = mergeCompletedLesson(prior, lesson.id); if (enrollment) await db.update(enrollments).set({ completedLessonIds: completed, completedAt: completed.length === (await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.courseId, course.id))).length ? new Date() : null }).where(eq(enrollments.id, enrollment.id)); else await db.insert(enrollments).values({ courseId: course.id, customerId: customer.id, completedLessonIds: completed }); return { completedLessonIds: completed }; }),
  }),
  admin: router({
    overview: adminProcedure.query(() => getAdminSummary()),
    configuration: adminProcedure.query(async () => {
      const db = await requireDb();
      const settings = (await db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1))[0];
      return { stripe: stripeStatus(), smtp: smtpStatus(), settings: settings ?? { platformName: "CreaDock", supportEmail: null, allowPublicSignups: true } };
    }),
    updatePlatformSettings: adminProcedure.input(z.object({ platformName: z.string().trim().min(2).max(120), supportEmail: z.string().email().max(320).optional().or(z.literal("")), allowPublicSignups: z.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const payload = { platformName: input.platformName, supportEmail: input.supportEmail || null, allowPublicSignups: input.allowPublicSignups, updatedByUserId: ctx.user.id };
      await db.insert(platformSettings).values({ id: 1, ...payload }).onDuplicateKeyUpdate({ set: payload });
      await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "admin.platform_settings.updated", entityType: "platform_settings", entityId: "1", ipAddress: ctx.req.ip || null, metadata: { allowPublicSignups: input.allowPublicSignups } });
      return { success: true };
    }),
    operations: adminProcedure.query(async () => { const db = await requireDb(); const [recentUsers, recentCreators, recentProducts, recentOrders, recentSubscriptions, recentPayments, recentTickets] = await Promise.all([db.select().from(users).orderBy(desc(users.createdAt)).limit(50), db.select().from(creators).orderBy(desc(creators.createdAt)).limit(50), db.select().from(products).orderBy(desc(products.createdAt)).limit(50), db.select().from(orders).orderBy(desc(orders.createdAt)).limit(50), db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)).limit(50), db.select().from(paymentEvents).orderBy(desc(paymentEvents.createdAt)).limit(50), db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)).limit(50)]); return { users: recentUsers.map(({ passwordHash, ...user }) => user), creators: recentCreators, products: recentProducts, orders: recentOrders, subscriptions: recentSubscriptions, payments: recentPayments, support: recentTickets }; }),
    reports: adminProcedure.input(z.object({ from: z.date().optional(), to: z.date().optional() })).query(async ({ input }) => { const db = await requireDb(); const [allUsers, allCreators, allOrders, allSubscriptions, allVisits, allTickets] = await Promise.all([db.select().from(users), db.select().from(creators), db.select().from(orders), db.select().from(subscriptions), db.select().from(storeVisits), db.select().from(supportTickets)]); const within = (date: Date) => (!input.from || date >= input.from) && (!input.to || date <= input.to); const ordersInRange = allOrders.filter((order) => within(order.createdAt)); const paid = ordersInRange.filter((order) => order.status === "paid"); const refunded = ordersInRange.filter((order) => order.status === "refunded"); return { users: allUsers.filter((user) => within(user.createdAt)).length, creators: allCreators.filter((creator) => within(creator.createdAt)).length, orders: ordersInRange.length, paidOrders: paid.length, refunds: refunded.length, gmv: paid.reduce((sum, order) => sum + Number(order.total), 0), activeSubscriptions: allSubscriptions.filter((subscription) => subscription.status === "active").length, visits: allVisits.filter((visit) => within(visit.createdAt)).length, openSupport: allTickets.filter((ticket) => ticket.status !== "resolved").length }; }),
    enhancedReports: adminProcedure.input(z.object({ from: z.date().optional(), to: z.date().optional() })).query(async ({ input }) => {
      const db = await requireDb();
      const [allSubscriptions, allPlans, initialProducts, allPayments, allUsers, allCreators, allOrders] = await Promise.all([db.select().from(subscriptions), db.select().from(membershipPlans), db.select().from(products), db.select().from(paymentEvents), db.select().from(users), db.select().from(creators), db.select().from(orders)]);
      const unmeasured = initialProducts.map((product) => ({ id: product.id, key: product.fileSizeBytes === 0 ? product.fileKey || (product.fileUrl?.startsWith("/manus-storage/") ? product.fileUrl.replace("/manus-storage/", "") : null) : null })).filter((product): product is { id: number; key: string } => Boolean(product.key));
      const measured = await Promise.allSettled(unmeasured.map(async (file) => ({ id: file.id, size: await storageGetObjectSize(file.key) })));
      const resolved = measured.filter((result): result is PromiseFulfilledResult<{ id: number; size: number }> => result.status === "fulfilled").map((result) => result.value);
      if (resolved.length) await Promise.all(resolved.map((file) => db.update(products).set({ fileSizeBytes: file.size }).where(eq(products.id, file.id))));
      const sizeByProductId = new Map(resolved.map((file) => [file.id, file.size]));
      const allProducts = initialProducts.map((product) => ({ ...product, fileSizeBytes: sizeByProductId.get(product.id) ?? product.fileSizeBytes }));
      const rangeEnd = input.to ?? new Date(); const rangeStart = input.from ?? new Date(rangeEnd.getTime() - 30 * 24 * 60 * 60 * 1000); const duration = Math.max(rangeEnd.getTime() - rangeStart.getTime(), 24 * 60 * 60 * 1000); const previousStart = new Date(rangeStart.getTime() - duration);
      const within = (date: Date) => date >= rangeStart && date <= rangeEnd; const previous = (date: Date) => date >= previousStart && date < rangeStart;
      const plans = new Map(allPlans.map((plan) => [plan.id, plan])); const active = allSubscriptions.filter((subscription) => subscription.status === "active");
      const mrr = active.reduce((sum, subscription) => { const plan = plans.get(subscription.planId); return sum + (plan ? Number(plan.price) / (plan.interval === "year" ? 12 : 1) : 0); }, 0);
      const trackedFiles = allProducts.filter((product) => Boolean(product.fileKey || product.fileUrl)); const paidInRange = allOrders.filter((order) => within(order.createdAt) && order.status === "paid"); const paidPrevious = allOrders.filter((order) => previous(order.createdAt) && order.status === "paid");
      const growth = (current: number, prior: number) => prior === 0 ? (current ? 100 : 0) : Math.round(((current - prior) / prior) * 100);
      return { mrr, managedFiles: trackedFiles.length, storageBytes: trackedFiles.reduce((sum, product) => sum + product.fileSizeBytes, 0), storageAddedBytes: trackedFiles.filter((product) => within(product.updatedAt)).reduce((sum, product) => sum + product.fileSizeBytes, 0), unmeasuredFiles: unmeasured.length - resolved.length, paymentEvents: allPayments.filter((event) => within(event.createdAt)).length, successfulPayments: allPayments.filter((event) => within(event.createdAt) && event.status === "processed").length, activeSubscriptions: active.length, newAccounts: allUsers.filter((user) => within(user.createdAt)).length, accountGrowthPercent: growth(allUsers.filter((user) => within(user.createdAt)).length, allUsers.filter((user) => previous(user.createdAt)).length), newCreators: allCreators.filter((creator) => within(creator.createdAt)).length, paidOrderGrowthPercent: growth(paidInRange.length, paidPrevious.length), gmvGrowthPercent: growth(paidInRange.reduce((sum, order) => sum + Number(order.total), 0), paidPrevious.reduce((sum, order) => sum + Number(order.total), 0)) };
    }),
    files: adminProcedure.query(async () => { const db = await requireDb(); return db.select({ id: products.id, name: products.name, slug: products.slug, fileKey: products.fileKey, fileUrl: products.fileUrl, fileSizeBytes: products.fileSizeBytes, externalUrl: products.externalUrl, creatorId: products.creatorId, status: products.status, updatedAt: products.updatedAt }).from(products).orderBy(desc(products.updatedAt)).limit(100); }),
    refreshStorageUsage: adminProcedure.mutation(async ({ ctx }) => {
      const db = await requireDb();
      const rows = await db.select({ id: products.id, fileKey: products.fileKey, fileUrl: products.fileUrl }).from(products);
      const candidates = rows.map((row) => ({ id: row.id, key: row.fileKey || (row.fileUrl?.startsWith("/manus-storage/") ? row.fileUrl.replace("/manus-storage/", "") : null) })).filter((row): row is { id: number; key: string } => Boolean(row.key));
      const results = await Promise.allSettled(candidates.map(async (file) => ({ id: file.id, size: await storageGetObjectSize(file.key) })));
      const measured = results.filter((result): result is PromiseFulfilledResult<{ id: number; size: number }> => result.status === "fulfilled").map((result) => result.value);
      await Promise.all(measured.map((file) => db.update(products).set({ fileSizeBytes: file.size }).where(eq(products.id, file.id))));
      await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "admin.storage_usage.refreshed", entityType: "storage", entityId: "platform", ipAddress: ctx.req.ip || null, metadata: { measuredFiles: measured.length, failedFiles: candidates.length - measured.length } });
      return { measuredFiles: measured.length, failedFiles: candidates.length - measured.length, storageBytes: measured.reduce((sum, file) => sum + file.size, 0) };
    }),
    updateFileStatus: adminProcedure.input(z.object({ id: z.number().int(), status: z.enum(["draft", "archived"]) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb(); const product = (await db.select({ id: products.id, name: products.name }).from(products).where(eq(products.id, input.id)).limit(1))[0];
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product file record not found." });
      await db.update(products).set({ status: input.status }).where(eq(products.id, input.id));
      await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: `admin.file.${input.status}`, entityType: "product", entityId: String(input.id), ipAddress: ctx.req.ip || null, metadata: { name: product.name } });
      return { success: true };
    }),
    sessions: adminProcedure.query(async () => { const db = await requireDb(); return db.select().from(userSessions).innerJoin(users, eq(userSessions.userId, users.id)).orderBy(desc(userSessions.createdAt)).limit(100); }),
    revokeSession: adminProcedure.input(z.object({ id: z.string().min(12).max(64) })).mutation(async ({ ctx, input }) => { const db = await requireDb(); const session = (await db.select().from(userSessions).where(eq(userSessions.id, input.id)).limit(1))[0]; if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." }); await db.update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.id, input.id)); await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: "admin.session.revoked", entityType: "session", entityId: input.id, ipAddress: ctx.req.ip || null, metadata: { userId: session.userId } }); return { success: true }; }),
    auditEvents: adminProcedure.query(async () => { const db = await requireDb(); return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100); }),
    emailDeliveries: adminProcedure.query(async () => { const db = await requireDb(); return db.select().from(emailDeliveries).orderBy(desc(emailDeliveries.createdAt)).limit(100); }),
    users: adminProcedure.input(z.object({ query: z.string().max(120).optional(), status: z.enum(["pending", "active", "suspended"]).optional() })).query(async ({ input }) => {
      const db = await requireDb();
      let rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(100);
      if (input.status) rows = rows.filter((user) => user.accountStatus === input.status);
      if (input.query?.trim()) { const query = input.query.trim().toLowerCase(); rows = rows.filter((user) => [user.name, user.email, user.username].some((value) => value?.toLowerCase().includes(query))); }
      return rows.map(({ passwordHash, ...user }) => user);
    }),
    updateUserStatus: adminProcedure.input(z.object({ id: z.number().int(), accountStatus: z.enum(["pending", "active", "suspended"]) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.id && input.accountStatus === "suspended") throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot suspend your own account." });
      const db = await requireDb();
      await db.update(users).set({ accountStatus: input.accountStatus }).where(eq(users.id, input.id));
      await db.insert(auditLogs).values({ actorUserId: ctx.user.id, action: `admin.user.${input.accountStatus}`, entityType: "user", entityId: String(input.id), ipAddress: ctx.req.ip || null });
      return { success: true };
    }),
    tickets: adminProcedure.query(async () => { const db = await requireDb(); return db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)); }),
    updateTicket: adminProcedure.input(z.object({ id: z.number().int(), status: z.enum(["open", "in_progress", "resolved"]) })).mutation(async ({ input }) => { const db = await requireDb(); await db.update(supportTickets).set({ status: input.status }).where(eq(supportTickets.id, input.id)); return { success: true }; }),
  }),
});

export type AppRouter = typeof appRouter;
