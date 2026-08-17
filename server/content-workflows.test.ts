import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { bundleItems, coupons, creatorLinks, creatorPages, creators, mediaAssets, mediaFolders, pageBlocks, productBundles, productVariants, products, storefrontBlocks } from "../drizzle/schema";

const state = vi.hoisted(() => ({
  rows: new Map<unknown, Array<Record<string, unknown>>>(),
  inserts: [] as Array<{ table: unknown; values: unknown }>,
  updates: [] as Array<{ table: unknown; values: unknown }>,
  deletes: [] as Array<{ table: unknown }>,
  nextId: 50,
  creator: { id: 1, userId: 1, handle: "creator", displayName: "Creator", accentColor: "#111827", isPublished: true },
}));

vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: (table: unknown) => {
        const rows = () => state.rows.get(table) ?? [];
        const query = { limit: async () => rows(), orderBy: async () => rows(), then: (resolve: (value: Array<Record<string, unknown>>) => unknown) => Promise.resolve(rows()).then(resolve) };
        return { where: () => query, orderBy: async () => rows() };
      },
    }),
    insert: (table: unknown) => ({
      values: (values: unknown) => { state.inserts.push({ table, values }); return [{ insertId: state.nextId++ }]; },
    }),
    update: (table: unknown) => ({ set: (values: unknown) => { state.updates.push({ table, values }); return { where: async () => undefined }; } }),
    delete: (table: unknown) => ({ where: async () => { state.deletes.push({ table }); } }),
  }),
  getCreatorForHandle: async () => state.creator,
  getOrCreateCreator: async () => state.creator,
  getCreatorDashboard: async () => ({}),
  getAdminSummary: async () => ({}),
}));

const { appRouter } = await import("./routers");

function creatorContext(): TrpcContext {
  return { user: { id: 1, openId: "creator", name: "Creator", email: "creator@example.com", loginMethod: "password", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

beforeEach(() => { state.rows.clear(); state.inserts.length = 0; state.updates.length = 0; state.deletes.length = 0; state.nextId = 50; });

describe("CreaDock creator content workflows", () => {
  it("persists creator media folders and lists only creator media records", async () => {
    state.rows.set(mediaAssets, [{ id: 5, creatorId: 1, name: "cover.png", kind: "image", sizeBytes: 100 }]);
    state.rows.set(mediaFolders, [{ id: 6, creatorId: 1, name: "Launch" }]);
    const caller = appRouter.createCaller(creatorContext());
    const library = await caller.media.library();
    expect(library.assets).toHaveLength(1); expect(library.folders).toHaveLength(1);
    await caller.media.createFolder({ name: "Course files" });
    expect(state.inserts).toContainEqual(expect.objectContaining({ table: mediaFolders, values: expect.objectContaining({ creatorId: 1, name: "Course files" }) }));
    await caller.media.updateAsset({ id: 5, name: "course-cover.png", altText: "Course cover", folderId: 6 });
    expect(state.updates).toContainEqual(expect.objectContaining({ table: mediaAssets, values: expect.objectContaining({ name: "course-cover.png", altText: "Course cover", folderId: 6 }) }));
    await caller.media.removeAsset({ id: 5 });
    expect(state.deletes).toContainEqual({ table: mediaAssets });
  });

  it("creates a new page before its later publication lifecycle", async () => {
    state.rows.set(creatorPages, []);
    const pageId = await appRouter.createCaller(creatorContext()).pages.save({ title: "About", slug: "about", kind: "about", template: "creator", status: "draft" });
    expect(pageId).toBe(50);
    expect(state.inserts).toContainEqual(expect.objectContaining({ table: creatorPages, values: expect.objectContaining({ creatorId: 1, title: "About", slug: "about", status: "draft" }) }));
  });

  it("creates page-builder blocks, reorders them, and publishes a creator page", async () => {
    state.rows.set(creatorPages, [{ id: 10, creatorId: 1, title: "Links", slug: "links", kind: "links", template: "creator", status: "draft" }]);
    state.rows.set(pageBlocks, [{ id: 11, pageId: 10, type: "heading", content: { text: "Hello" }, isVisible: true, sortOrder: 0 }]);
    const caller = appRouter.createCaller(creatorContext());
    await caller.pages.saveBlock({ pageId: 10, type: "text", content: { text: "Welcome" }, isVisible: true });
    expect(state.inserts).toContainEqual(expect.objectContaining({ table: pageBlocks, values: expect.objectContaining({ pageId: 10, type: "text" }) }));
    await caller.pages.reorderBlocks({ pageId: 10, blockIds: [11] });
    expect(state.updates.some((entry) => entry.table === pageBlocks)).toBe(true);
    await caller.pages.save({ id: 10, title: "Links", slug: "links", kind: "links", template: "creator", status: "published" });
    expect(state.updates.some((entry) => entry.table === creatorPages && (entry.values as { status: string }).status === "published")).toBe(true);
  });

  it("filters expired links from public content and records public link clicks", async () => {
    state.rows.set(creatorPages, [{ id: 12, creatorId: 1, title: "Links", slug: "links", kind: "links", template: "creator", status: "published" }]);
    state.rows.set(pageBlocks, [{ id: 13, pageId: 12, type: "heading", content: { text: "Fresh links" }, isVisible: true, sortOrder: 0 }]);
    state.rows.set(creatorLinks, [
      { id: 14, creatorId: 1, title: "Current", url: "https://example.com/current", isVisible: true, openInNewTab: true, clickCount: 3, sortOrder: 0, expiresAt: null },
      { id: 15, creatorId: 1, title: "Expired", url: "https://example.com/expired", isVisible: true, openInNewTab: true, clickCount: 0, sortOrder: 1, expiresAt: new Date("2000-01-01") },
    ]);
    const caller = appRouter.createCaller(creatorContext());
    const content = await caller.storefront.publicContent({ handle: "creator", slug: "links" });
    expect(content.blocks).toHaveLength(1); expect(content.links.map((link) => link.id)).toEqual([14]);
    const click = await caller.storefront.registerLinkClick({ handle: "creator", linkId: 14 });
    expect(click).toEqual({ url: "https://example.com/current", openInNewTab: true });
    expect(state.updates).toContainEqual(expect.objectContaining({ table: creatorLinks, values: expect.objectContaining({ clickCount: 4 }) }));
    await caller.links.save({ title: "New link", url: "https://example.com/new", isVisible: true, openInNewTab: true });
    await caller.links.reorder({ linkIds: [14, 15] });
    await caller.links.remove({ id: 15 });
    expect(state.inserts.some((entry) => entry.table === creatorLinks)).toBe(true);
    expect(state.updates.filter((entry) => entry.table === creatorLinks).length).toBeGreaterThan(1);
    expect(state.deletes).toContainEqual({ table: creatorLinks });
  });

  it("persists a visual storefront system, template blocks, and creator-owned block order", async () => {
    state.rows.set(creators, [state.creator]); state.rows.set(storefrontBlocks, []); state.rows.set(mediaAssets, []);
    const caller = appRouter.createCaller(creatorContext());
    await caller.storefrontBuilder.updateBrand({ displayName: "Creator", handle: "creator", headline: "Make it useful", bio: "A focused brand", theme: "editorial", accentColor: "#123456", isPublished: true, visualSettings: { backgroundColor: "#fafafa", buttonStyle: "soft", borderRadius: "lg" } });
    expect(state.updates).toContainEqual(expect.objectContaining({ table: creators, values: expect.objectContaining({ headline: "Make it useful", theme: "editorial", visualSettings: expect.objectContaining({ buttonStyle: "soft" }) }) }));
    await caller.storefrontBuilder.applyTemplate({ template: "creator" });
    expect(state.inserts.some((entry) => entry.table === storefrontBlocks)).toBe(true);
    await caller.storefrontBuilder.saveBlock({ type: "heading", title: "A better beginning", content: { text: "A better beginning" }, isVisible: true });
    await caller.storefrontBuilder.reorderBlocks({ blockIds: [1] });
    expect(state.updates.some((entry) => entry.table === storefrontBlocks)).toBe(true);
  });

  it("persists creator-owned product variants, coupons, and bundles", async () => {
    state.rows.set(products, [{ id: 20, creatorId: 1, name: "Guide", status: "published", price: "20.00" }, { id: 21, creatorId: 1, name: "Templates", status: "published", price: "30.00" }]);
    state.rows.set(productVariants, []); state.rows.set(coupons, []); state.rows.set(productBundles, []); state.rows.set(bundleItems, []);
    const caller = appRouter.createCaller(creatorContext());
    await caller.products.saveVariant({ productId: 20, name: "Personal license", priceDelta: "5.00" });
    await caller.commerce.saveCoupon({ code: "launch20", type: "percent", amount: "20", isActive: true });
    await caller.commerce.saveBundle({ name: "Launch bundle", price: "35.00", status: "draft", productIds: [20, 21] });
    expect(state.inserts.some((entry) => entry.table === productVariants && (entry.values as { productId: number }).productId === 20)).toBe(true);
    expect(state.inserts.some((entry) => entry.table === coupons && (entry.values as { code: string }).code === "LAUNCH20")).toBe(true);
    expect(state.inserts.some((entry) => entry.table === productBundles && (entry.values as { creatorId: number }).creatorId === 1)).toBe(true);
    expect(state.inserts.some((entry) => entry.table === bundleItems)).toBe(true);
  });
});
