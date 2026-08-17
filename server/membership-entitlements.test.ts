import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { customers, digitalEntitlements, membershipPlans, products, subscriptions } from "../drizzle/schema";

const state = vi.hoisted(() => ({ rows: new Map<unknown, Array<Record<string, unknown>>>(), joinedRows: new Map<unknown, Array<Record<string, unknown>>>() }));
const storageGetSignedUrl = vi.hoisted(() => vi.fn(async (key: string) => `https://downloads.example/${key}`));

vi.mock("./storage", () => ({ storageGetObjectSize: async () => 0, storageGetSignedUrl }));
vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: (table: unknown) => {
        const rows = (joined = false) => (joined ? state.joinedRows.get(table) : state.rows.get(table)) ?? [];
        const query = (joined = false) => ({ limit: async () => rows(joined), orderBy: async () => rows(joined), then: (resolve: (value: Array<Record<string, unknown>>) => Promise<unknown>) => Promise.resolve(rows(joined)).then(resolve) });
        const joined = { innerJoin: () => joined, where: () => query(true), orderBy: async () => rows(true) };
        return { where: () => query(), innerJoin: () => joined, orderBy: async () => rows() };
      },
    }),
    insert: () => ({ values: () => ({ onDuplicateKeyUpdate: async () => [{ insertId: 1 }] }) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    delete: () => ({ where: async () => undefined }),
  }),
  getCreatorForHandle: async () => null,
  getOrCreateCreator: async () => null,
  getCreatorDashboard: async () => ({}),
  getAdminSummary: async () => ({}),
}));

const { appRouter } = await import("./routers");

function customerContext(): TrpcContext {
  return { user: { id: 7, openId: "member", name: "Member", email: "member@example.com", loginMethod: "password", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

beforeEach(() => {
  state.rows.clear();
  state.joinedRows.clear();
  storageGetSignedUrl.mockClear();
  state.rows.set(customers, [{ id: 22, userId: 7, email: "member@example.com" }]);
  state.rows.set(digitalEntitlements, []);
  state.rows.set(products, [{ id: 90, name: "Member workbook", fileKey: "files/member-workbook.pdf", fileUrl: null }]);
});

describe("membership-included product downloads", () => {
  it("returns the protected file only while an active membership includes that product", async () => {
    state.joinedRows.set(subscriptions, [{ subscriptions: { id: 33, customerId: 22, planId: 44, status: "active" }, membershipPlans: { id: 44, accessRules: { includedProductIds: [90] } } }]);
    state.rows.set(membershipPlans, [{ id: 44, accessRules: { includedProductIds: [90] } }]);

    await expect(appRouter.createCaller(customerContext()).account.download({ productId: 90 })).resolves.toEqual({ url: "https://downloads.example/files/member-workbook.pdf", filename: "Member workbook" });
    expect(storageGetSignedUrl).toHaveBeenCalledWith("files/member-workbook.pdf");
  });

  it("denies the protected file after the membership that included it is cancelled", async () => {
    state.rows.set(subscriptions, [{ id: 33, customerId: 22, planId: 44, status: "cancelled" }]);
    state.joinedRows.set(subscriptions, []);

    await expect(appRouter.createCaller(customerContext()).account.download({ productId: 90 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(storageGetSignedUrl).not.toHaveBeenCalled();
  });
});
