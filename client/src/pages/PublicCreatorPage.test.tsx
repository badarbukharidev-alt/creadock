// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ openLink: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    storefront: {
      publicContent: { useQuery: () => ({ isLoading: false, error: null, data: { creator: { displayName: "Badar", bio: "Creator", accentColor: "#111827" }, page: { title: "My links" }, blocks: [{ id: 1, type: "heading", content: { text: "Start here" } }], links: [{ id: 2, title: "Creator kit", description: "A useful download", url: "https://example.com/kit", openInNewTab: true }] }, refetch: vi.fn() }) },
      registerLinkClick: { useMutation: () => ({ mutateAsync: mocks.openLink }) },
    },
  },
}));

import PublicCreatorPage from "./PublicCreatorPage";

afterEach(() => cleanup());

describe("CreaDock nested public creator page", () => {
  it("renders published content blocks and visible link-in-bio actions", () => {
    window.history.pushState({}, "", "/c/badar/links");
    render(<PublicCreatorPage />);
    expect(screen.getByRole("heading", { name: "My links" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Start here" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /creator kit/i })).toBeInTheDocument();
  });
});
