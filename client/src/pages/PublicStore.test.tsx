// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const emptyMutation = { mutate: vi.fn(), isPending: false };
vi.mock("@/lib/trpc", () => ({ trpc: { storefront: { publicPage: { useQuery: () => ({ isLoading: false, error: null, data: { creator: { displayName: "Badar", bio: "A useful creator", headline: "Make work clearer", location: "Lahore", accentColor: "#2255cc", visualSettings: { backgroundColor: "#f5f5f0", buttonColor: "#2255cc", borderRadius: "lg" }, socialLinks: [{ label: "Instagram", url: "https://instagram.com/badar" }], avatarUrl: null, logoUrl: null, coverUrl: null }, blocks: [{ id: 1, type: "heading", title: "Start here", content: { text: "Start here" }, isVisible: true }, { id: 2, type: "button", title: null, content: { text: "Get the guide" }, isVisible: true }], catalog: [], memberships: [], bookingServices: [], courses: [] }, refetch: vi.fn() }) }, subscribe: { useMutation: () => emptyMutation }, purchase: { useMutation: () => emptyMutation }, book: { useMutation: () => emptyMutation }, courseDetail: { useQuery: () => ({ data: null }) }, completeLesson: { useMutation: () => emptyMutation } } } }));
import PublicStore from "./PublicStore";
afterEach(() => cleanup());
describe("CreaDock public storefront builder rendering", () => { it("renders persisted visual profile data and visible storefront blocks", () => { window.history.pushState({}, "", "/c/badar"); render(<PublicStore />); expect(screen.getByRole("heading", { name: "Badar" })).toBeInTheDocument(); expect(screen.getByText("Make work clearer")).toBeInTheDocument(); expect(screen.getByRole("heading", { name: "Start here" })).toBeInTheDocument(); const builderButton = screen.getByRole("button", { name: "Get the guide" }); expect(builderButton).toHaveStyle({ backgroundColor: "#2255cc" }); expect(document.querySelector("main")).toHaveStyle({ backgroundColor: "#f5f5f0" }); expect(screen.getByText("Instagram")).toBeInTheDocument(); }); });
