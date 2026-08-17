import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function anonymousContext(): TrpcContext {
  return {
    user: null,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("CreaDock router contracts", () => {
  it("protects creator dashboard data from anonymous callers", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.dashboard.overview()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("protects platform administration from anonymous callers", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects malformed public subscriber data before storage", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.storefront.subscribe({ handle: "creator", email: "not-an-email" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
