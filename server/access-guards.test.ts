import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function anonymousContext(): TrpcContext {
  return { user: null, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

function customerContext(): TrpcContext {
  return {
    user: {
      id: 99,
      openId: "creadock-customer-99",
      email: "customer@example.com",
      normalizedEmail: "customer@example.com",
      username: "customer99",
      name: "Customer",
      role: "user",
      accountStatus: "active",
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      failedLoginCount: 0,
      passwordHash: "not-used-by-route-tests",
      lockedUntil: null,
      lastPasswordChangedAt: new Date(),
      loginMethod: "password",
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("CreaDock first-party access guard workflows", () => {
  it("rejects an unauthenticated visitor before customer account data can load", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.account.purchases()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.account.memberships()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects a signed-in customer before administrator inventory or configuration actions can run", async () => {
    const caller = appRouter.createCaller(customerContext());
    await expect(caller.admin.files()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.updateFileStatus({ id: 1, status: "archived" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.updatePlatformSettings({ platformName: "CreaDock", supportEmail: "support@example.com", allowPublicSignups: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps the browser sign-in entry point inside CreaDock's own login route", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/const.ts"), "utf8");
    expect(source).toContain('window.location.assign("/login")');
    expect(source).not.toMatch(/app-auth|oauth\/callback|VITE_OAUTH|manus/i);
  });
});
