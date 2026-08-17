// @vitest-environment jsdom
import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setLocation: vi.fn(),
  setData: vi.fn(),
  invalidate: vi.fn(),
  loginOptions: null as null | { onSuccess: (result: { user: unknown }) => void },
}));

vi.mock("wouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wouter")>();
  return { ...actual, useLocation: () => ["/login", mocks.setLocation] };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { setData: mocks.setData, invalidate: mocks.invalidate } } }),
    auth: {
      signUp: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      login: { useMutation: (options: typeof mocks.loginOptions) => { mocks.loginOptions = options; return { mutate: vi.fn(), isPending: false }; } },
      requestPasswordReset: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      resetPassword: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      verifyEmail: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import AuthPage from "./AuthPage";

describe("CreaDock post-login navigation", () => {
  it("hydrates the first-party session cache before entering the creator dashboard", () => {
    render(<AuthPage />);
    const user = { id: 7, role: "user", email: "creator@example.com" };
    mocks.loginOptions?.onSuccess({ user });

    expect(mocks.setData).toHaveBeenCalledWith(undefined, user);
    expect(mocks.invalidate).toHaveBeenCalledOnce();
    expect(mocks.setLocation).toHaveBeenCalledWith("/app/dashboard");
  });
});
