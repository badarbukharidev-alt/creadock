import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function anonymousContext(): TrpcContext {
  return { user: null, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("CreaDock in-app MVP contracts", () => {
  it("requires checkout to select exactly one purchasable offer", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.storefront.purchase({ handle: "creator", email: "buyer@example.com" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.storefront.purchase({ handle: "creator", email: "buyer@example.com", productId: 1, membershipPlanId: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("validates buyer details before reserving an MVP booking", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.storefront.book({ handle: "creator", serviceId: 1, email: "invalid" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("validates student email before recording lesson progress", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.storefront.completeLesson({ handle: "creator", courseId: 1, lessonId: 1, email: "invalid" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("protects campaign state changes behind a creator session", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.marketing.markSent({ id: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
