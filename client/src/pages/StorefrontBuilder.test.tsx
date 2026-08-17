// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mutation = { mutate: vi.fn(), isPending: false };
vi.mock("@/lib/trpc", () => ({ trpc: { storefrontBuilder: { state: { useQuery: () => ({ isLoading: false, error: null, data: { creator: { id: 1, displayName: "Badar", handle: "badar", headline: "Creator", bio: "Bio", location: "Lahore", accentColor: "#2255cc", theme: "minimal", isPublished: true, avatarUrl: null, logoUrl: null, coverUrl: null, socialLinks: [], visualSettings: { backgroundColor: "#f5f5f0", buttonStyle: "solid", borderRadius: "lg" } }, blocks: [{ id: 1, type: "heading", title: "Start here", content: { text: "Start here" }, isVisible: true }], assets: [] }, refetch: vi.fn() }) }, updateBrand: { useMutation: () => mutation }, saveBlock: { useMutation: () => mutation }, removeBlock: { useMutation: () => mutation }, reorderBlocks: { useMutation: () => mutation }, applyTemplate: { useMutation: () => mutation } } } }));
import StorefrontBuilder from "./StorefrontBuilder";
afterEach(() => cleanup());
describe("CreaDock storefront builder", () => { it("exposes richer profile controls and switches the preview to mobile", () => { render(<StorefrontBuilder />); expect(screen.getByPlaceholderText("Lahore, Pakistan")).toHaveValue("Lahore"); expect(screen.getByPlaceholderText(/Instagram \|/)).toBeInTheDocument(); const frame = screen.getByTestId("storefront-preview-frame"); expect(frame.className).toContain("max-w-[760px]"); fireEvent.click(screen.getByRole("button", { name: "Mobile preview" })); expect(frame.className).toContain("max-w-[390px]"); }); });
