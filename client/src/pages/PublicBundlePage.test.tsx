// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/trpc", () => ({ trpc: { storefront: { bundleDetail: { useQuery: () => ({ isLoading: false, data: { creator: { displayName: "Badar", accentColor: "#2255cc" }, bundle: { name: "Launch Kit", price: "39.00", description: "Everything to start" }, items: [{ products: { id: 1, name: "VoiceDelta", price: "20.00" } }, { products: { id: 2, name: "Templates", price: "30.00" } }] } }) }, purchase: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } } } }));
import PublicBundlePage from "./PublicBundlePage";
afterEach(() => cleanup());
describe("CreaDock public bundle page", () => { it("renders published bundle pricing and included products", () => { window.history.pushState({}, "", "/c/badar/b/launch-kit"); render(<PublicBundlePage />); expect(screen.getByRole("heading", { name: "Launch Kit" })).toBeInTheDocument(); expect(screen.getByText("VoiceDelta")).toBeInTheDocument(); expect(screen.getByText("Templates")).toBeInTheDocument(); expect(screen.getByText("$39.00")).toBeInTheDocument(); }); });
