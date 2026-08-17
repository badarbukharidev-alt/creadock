// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const comment = { mutate: vi.fn(), isPending: false };
const like = { mutate: vi.fn(), isPending: false };
const communityState = vi.hoisted(() => ({ accessType: "members", viewerMember: true, join: vi.fn() }));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 7, name: "Member" } }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    memberCommunity: {
      spaces: { useQuery: () => ({ data: [{ id: 10, name: "Member circle", description: "A private space", accessType: communityState.accessType }], refetch: vi.fn() }) },
      feed: { useQuery: () => ({ data: { space: { id: 10, name: "Member circle", description: "A private space", accessType: communityState.accessType }, viewerCustomerId: 22, viewerMember: communityState.viewerMember, posts: [{ id: 30, title: "Welcome", body: "Say hello", createdAt: new Date("2030-01-01T10:00:00Z"), isAnnouncement: false }], comments: [{ id: 40, postId: 30, body: "Glad to be here." }], likes: [{ id: 50, postId: 30, customerId: 22 }] }, refetch: vi.fn() }) },
      joinPublic: { useMutation: () => ({ mutate: communityState.join, isPending: false }) },
      createPost: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      toggleLike: { useMutation: () => like },
      comment: { useMutation: () => comment },
    },
  },
}));

import AccountCommunity from "./AccountCommunity";

afterEach(() => { cleanup(); comment.mutate.mockReset(); like.mutate.mockReset(); communityState.join.mockReset(); communityState.accessType = "members"; communityState.viewerMember = true; });

describe("CreaDock member community interactions", () => {
  it("renders comments and submits member replies and likes against the selected community", () => {
    render(<AccountCommunity />);
    fireEvent.click(screen.getByRole("button", { name: /Member circle/i }));
    expect(screen.getByText("Glad to be here.")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Add a comment"), { target: { value: "Thanks for hosting." } });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(comment.mutate).toHaveBeenCalledWith({ communityId: 10, postId: 30, body: "Thanks for hosting." });
    const likeButton = screen.getByRole("button", { name: "Like post 30" });
    expect(likeButton).toHaveClass("text-rose-600");
    expect(likeButton).toHaveTextContent("1");
    fireEvent.click(likeButton);
    expect(like.mutate).toHaveBeenCalledWith({ communityId: 10, postId: 30 });
  });

  it("shows Join to a signed-in public-space non-member before member interaction controls", () => {
    communityState.accessType = "public"; communityState.viewerMember = false;
    render(<AccountCommunity />);
    fireEvent.click(screen.getByRole("button", { name: /Member circle/i }));
    fireEvent.click(screen.getByRole("button", { name: "Join space" }));
    expect(communityState.join).toHaveBeenCalledWith({ communityId: 10 });
    expect(screen.queryByPlaceholderText("Add a comment")).not.toBeInTheDocument();
  });
});
