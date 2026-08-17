import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { courseModules, customers, enrollments, lessonQuizAttempts, lessons, mediaAssets, subscriptions } from "../drizzle/schema";

const state = vi.hoisted(() => ({
  rows: new Map<unknown, Array<Record<string, unknown>>>(),
  inserts: [] as Array<{ table: unknown; values: unknown }>,
  updates: [] as Array<{ table: unknown; values: unknown }>,
  nextId: 200,
}));

vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: (table: unknown) => {
        const rows = () => state.rows.get(table) ?? [];
        const query = { limit: async () => rows(), orderBy: async () => rows(), then: (resolve: (value: Array<Record<string, unknown>>) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(rows()).then(resolve, reject) };
        const joined = { innerJoin: () => joined, where: () => query, orderBy: async () => rows() };
        return joined;
      },
    }),
    insert: (table: unknown) => ({ values: (values: unknown) => { state.inserts.push({ table, values }); return [{ insertId: state.nextId++ }]; } }),
    update: (table: unknown) => ({ set: (values: unknown) => { state.updates.push({ table, values }); return { where: async () => undefined }; } }),
  }),
  getCreatorForHandle: async () => undefined,
  getOrCreateCreator: async () => ({ id: 1, userId: 1, handle: "creator", displayName: "Creator" }),
  getCreatorDashboard: async () => ({}),
  getAdminSummary: async () => ({}),
}));

const { appRouter } = await import("./routers");

function studentContext(): TrpcContext {
  return { user: { id: 1, openId: "student", name: "Student", email: "student@example.com", loginMethod: "password", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

function enrolledCourse(enrolledAt = new Date("2026-08-01T00:00:00Z")) {
  return { enrollments: { id: 90, courseId: 5, customerId: 6, completedLessonIds: [], enrolledAt }, customers: { id: 6, userId: 1, email: "student@example.com" }, courses: { id: 5, creatorId: 1, title: "Course", status: "published" } };
}

function quizLesson(overrides: Record<string, unknown> = {}) {
  return { id: 7, courseId: 5, moduleId: null, title: "Knowledge check", kind: "quiz", body: null, videoUrl: null, mediaAssetId: null, thumbnailAssetId: null, galleryAssetIds: null, resourceAssetIds: null, durationSeconds: null, quiz: { prompt: "Pick the first step", choices: ["Plan", "Publish"], correctAnswerIndex: 0, explanation: "Start with a plan." }, isPublished: true, isLocked: false, dripDays: 0, prerequisiteLessonId: null, isPreview: false, ...overrides };
}

beforeEach(() => {
  state.rows.clear(); state.inserts.length = 0; state.updates.length = 0; state.nextId = 200;
  state.rows.set(enrollments, [enrolledCourse()]); state.rows.set(courseModules, []); state.rows.set(mediaAssets, []); state.rows.set(lessonQuizAttempts, []); state.rows.set(customers, []);
});

describe("authenticated course player", () => {
  it("returns student lesson availability and records a passing quiz as completed progress", async () => {
    state.rows.set(lessons, [quizLesson()]);
    const caller = appRouter.createCaller(studentContext());
    const player = await caller.account.course({ courseId: 5 });
    expect(player.lessons[0]?.availability).toMatchObject({ isAvailable: true, reason: null });

    const missed = await caller.account.submitQuiz({ courseId: 5, lessonId: 7, selectedAnswerIndex: 1 });
    expect(missed).toMatchObject({ score: 0, isPassed: false, completedLessonIds: [] });
    const passed = await caller.account.submitQuiz({ courseId: 5, lessonId: 7, selectedAnswerIndex: 0 });
    expect(passed).toMatchObject({ score: 100, isPassed: true, completedLessonIds: [7] });
    expect(state.inserts.filter((entry) => entry.table === lessonQuizAttempts)).toHaveLength(2);
    expect(state.updates).toContainEqual(expect.objectContaining({ table: enrollments, values: expect.objectContaining({ completedLessonIds: [7] }) }));
  });

  it("keeps a drip-scheduled lesson unavailable until its enrollment delay has elapsed", async () => {
    state.rows.set(enrollments, [enrolledCourse(new Date())]);
    state.rows.set(lessons, [quizLesson({ kind: "text", quiz: null, dripDays: 10 })]);

    const player = await appRouter.createCaller(studentContext()).account.course({ courseId: 5 });

    expect(player.lessons[0]?.availability).toMatchObject({ isAvailable: false, reason: "This lesson is scheduled for later." });
  });

  it("denies a membership-sourced course enrollment as soon as its linked plan is no longer active", async () => {
    state.rows.set(enrollments, [{ ...enrolledCourse(), enrollments: { ...enrolledCourse().enrollments, membershipPlanId: 44 } }]);
    state.rows.set(subscriptions, []);

    await expect(appRouter.createCaller(studentContext()).account.course({ courseId: 5 })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "This course is available while the associated membership remains active.",
    });
  });
});
