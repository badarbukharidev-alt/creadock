import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { communityComments, communityMembers, communityPostLikes, communityPosts, communitySpaces, customers, digitalEntitlements, subscriptions } from "../drizzle/schema";

const state = vi.hoisted(() => ({ rows: new Map<unknown, Array<Record<string, unknown>>>(), joinedRows: new Map<unknown, Array<Record<string, unknown>>>(), inserts: [] as Array<{ table: unknown; values: unknown }>, deletes: [] as Array<{ table: unknown }> }));

function queryContains(condition: unknown, expected: string): boolean {
  if (!condition || typeof condition !== "object") return false;
  const value = condition as { name?: string; value?: unknown; queryChunks?: unknown[] };
  if (value.name === expected || value.value === expected) return true;
  return value.queryChunks?.some((chunk) => queryContains(chunk, expected)) ?? false;
}

vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: (table: unknown) => {
        const rows = (condition?: unknown, joined = false) => {
          const storedRows = (joined ? state.joinedRows.get(table) : state.rows.get(table)) ?? [];
          if ((table === communityMembers || table === subscriptions) && queryContains(condition, "active")) return storedRows.filter((row) => row.status === "active" || row.subscriptions?.status === "active");
          return storedRows;
        };
        const query = (condition?: unknown, joined = false) => ({ limit: async () => rows(condition, joined), orderBy: async () => rows(condition, joined), then: (resolve: (value: Array<Record<string, unknown>>) => Promise<unknown>) => Promise.resolve(rows(condition, joined)).then(resolve) });
        const joined = { innerJoin: () => joined, where: (condition: unknown) => query(condition, true), orderBy: async () => rows(undefined, true) };
        return { where: (condition: unknown) => query(condition), orderBy: async () => rows(), innerJoin: () => joined };
      },
    }),
    insert: (table: unknown) => ({ values: (values: unknown) => { state.inserts.push({ table, values }); return [{ insertId: 51 }]; } }),
    delete: (table: unknown) => ({ where: async () => { state.deletes.push({ table }); } }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  }),
  getCreatorForHandle: async () => null,
  getOrCreateCreator: async () => null,
  getCreatorDashboard: async () => ({}),
  getAdminSummary: async () => ({}),
}));

const { appRouter } = await import("./routers");
const memberContext = (): TrpcContext => ({ user: { id: 7, openId: "member", name: "Member", email: "member@example.com", loginMethod: "password", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] });

beforeEach(() => { state.rows.clear(); state.joinedRows.clear(); state.inserts.length = 0; state.deletes.length = 0; state.rows.set(communitySpaces, [{ id: 10, creatorId: 1, name: "Public room", accessType: "public", isPublished: true }]); state.rows.set(customers, [{ id: 22, creatorId: 1, userId: 7, email: "member@example.com" }]); state.rows.set(communityMembers, [{ id: 23, communityId: 10, customerId: 22, status: "active" }]); state.rows.set(communityPosts, [{ id: 30, communityId: 10, title: "Welcome", body: "Hello", status: "published", createdAt: new Date() }]); state.rows.set(communityPostLikes, []); state.rows.set(digitalEntitlements, []); state.rows.set(subscriptions, []); });

describe("CreaDock member community access", () => {
  it("allows an authenticated customer in a public space to comment and toggle a like without touching another space", async () => {
    const caller = appRouter.createCaller(memberContext());
    await caller.memberCommunity.comment({ communityId: 10, postId: 30, body: "Glad to join." });
    const liked = await caller.memberCommunity.toggleLike({ communityId: 10, postId: 30 });
    expect(liked).toEqual({ liked: true });
    expect(state.inserts).toContainEqual(expect.objectContaining({ table: communityComments, values: expect.objectContaining({ postId: 30, authorCustomerId: 22, body: "Glad to join." }) }));
    expect(state.inserts).toContainEqual(expect.objectContaining({ table: communityPostLikes, values: expect.objectContaining({ postId: 30, customerId: 22 }) }));
    state.rows.set(communityPostLikes, [{ id: 60, postId: 30, customerId: 22 }]);
    const unliked = await caller.memberCommunity.toggleLike({ communityId: 10, postId: 30 });
    expect(unliked).toEqual({ liked: false });
    expect(state.deletes).toContainEqual({ table: communityPostLikes });
  });

  it("prevents a removed public-space member from commenting or reacting", async () => {
    state.rows.set(communityMembers, [{ id: 23, communityId: 10, customerId: 22, status: "removed" }]);
    const caller = appRouter.createCaller(memberContext());

    await expect(caller.memberCommunity.comment({ communityId: 10, postId: 30, body: "I should not post." })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.memberCommunity.toggleLike({ communityId: 10, postId: 30 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.inserts).not.toContainEqual(expect.objectContaining({ table: communityComments }));
    expect(state.inserts).not.toContainEqual(expect.objectContaining({ table: communityPostLikes }));
  });

  it("grants an included community benefit only while the related membership remains active", async () => {
    state.rows.set(communitySpaces, [{ id: 10, creatorId: 1, name: "Member room", accessType: "members", membershipPlanId: null, isPublished: true }]);
    state.rows.set(communityMembers, []);
    state.joinedRows.set(subscriptions, [{ subscriptions: { id: 44, customerId: 22, planId: 33, status: "active" }, membershipPlans: { id: 33, accessRules: { includedCommunityIds: [10] } } }]);

    const feed = await appRouter.createCaller(memberContext()).memberCommunity.feed({ communityId: 10 });

    expect(feed.space.id).toBe(10);
    expect(feed.viewerCustomerId).toBe(22);
  });

  it("denies an included community benefit immediately after its membership becomes inactive", async () => {
    state.rows.set(communitySpaces, [{ id: 10, creatorId: 1, name: "Member room", accessType: "members", membershipPlanId: null, isPublished: true }]);
    state.rows.set(communityMembers, []);
    state.rows.set(subscriptions, [{ id: 44, customerId: 22, planId: 33, status: "cancelled" }]);
    state.joinedRows.set(subscriptions, []);

    await expect(appRouter.createCaller(memberContext()).memberCommunity.feed({ communityId: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows a product-gated community only when the customer owns the eligible product entitlement", async () => {
    state.rows.set(communitySpaces, [{ id: 10, creatorId: 1, name: "Product room", accessType: "product", productId: 70, isPublished: true }]);
    state.rows.set(communityMembers, []);
    state.rows.set(digitalEntitlements, [{ id: 88, customerId: 22, productId: 70 }]);

    const feed = await appRouter.createCaller(memberContext()).memberCommunity.feed({ communityId: 10 });

    expect(feed.space.name).toBe("Product room");
    expect(feed.viewerCustomerId).toBe(22);
  });
});
