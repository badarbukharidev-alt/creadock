// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  emptyQuery: { data: [], isLoading: false, isFetching: false, error: null, refetch: vi.fn() },
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: mocks.useAuth }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    account: {
      purchases: { useQuery: () => mocks.emptyQuery }, learning: { useQuery: () => mocks.emptyQuery }, bookings: { useQuery: () => mocks.emptyQuery }, memberships: { useQuery: () => mocks.emptyQuery }, download: { useQuery: () => ({ ...mocks.emptyQuery, data: undefined }) },
    },
    admin: {
      overview: { useQuery: () => mocks.emptyQuery }, tickets: { useQuery: () => mocks.emptyQuery }, configuration: { useQuery: () => mocks.emptyQuery }, users: { useQuery: () => mocks.emptyQuery }, updateTicket: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, updateUserStatus: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import App from "./App";

function renderAt(path: string) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

describe("CreaDock browser route-guard workflows", () => {
  beforeEach(() => {
    mocks.useAuth.mockReset();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })),
    });
  });
  afterEach(() => cleanup());

  it("renders the first-party sign-in gate for an unauthenticated customer account route", () => {
    mocks.useAuth.mockReturnValue({ user: null, loading: false });
    renderAt("/account");
    expect(screen.getByRole("heading", { name: "Your purchases, in one place" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("renders the administrator denial page for a signed-in non-staff route visitor", () => {
    mocks.useAuth.mockReturnValue({ user: { id: 8, role: "user", email: "customer@example.com" }, loading: false });
    renderAt("/admin");
    expect(screen.getByRole("heading", { name: "Admin access required" })).toBeInTheDocument();
    expect(screen.getByText(/reserved for CreaDock platform administrators and support staff/i)).toBeInTheDocument();
  });
});
