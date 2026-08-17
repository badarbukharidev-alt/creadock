// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const createLesson = { mutate: vi.fn(), isPending: false };
const mutation = { mutate: vi.fn(), isPending: false };

vi.mock("@/lib/trpc", () => ({
  trpc: {
    courses: {
      list: { useQuery: () => ({ isLoading: false, error: null, data: [{ id: 1, title: "Creator foundations", description: "Learn the essentials", status: "draft" }], refetch: vi.fn() }) },
      builder: { useQuery: () => ({ error: null, data: { course: { id: 1, title: "Creator foundations", description: "Learn the essentials", status: "draft", learningOutcomes: [], settings: null, thumbnailAssetId: null }, modules: [], lessons: [], assets: [{ id: 11, name: "cover.png", kind: "image", url: "/manus-storage/cover.png" }, { id: 12, name: "gallery.png", kind: "image", url: "/manus-storage/gallery.png" }] }, refetch: vi.fn() }) },
      create: { useMutation: () => mutation }, update: { useMutation: () => mutation }, saveModule: { useMutation: () => mutation }, removeModule: { useMutation: () => mutation }, reorderModules: { useMutation: () => mutation }, addLesson: { useMutation: () => createLesson }, updateLesson: { useMutation: () => mutation }, deleteLesson: { useMutation: () => mutation }, reorderLessons: { useMutation: () => mutation },
    },
  },
}));

import CourseBuilder from "./CourseBuilder";

afterEach(() => { cleanup(); createLesson.mutate.mockReset(); mutation.mutate.mockReset(); });

describe("CreaDock Course Builder rich lesson controls", () => {
  it("sends thumbnail, gallery, and duration values when creating a lesson", () => {
    const { container } = render(<CourseBuilder />);
    fireEvent.click(screen.getByRole("button", { name: /Creator foundations/i }));
    fireEvent.click(screen.getByRole("button", { name: "Add lesson" }));
    fireEvent.change(screen.getByPlaceholderText("Welcome to the course"), { target: { value: "Visual practice" } });
    const durationInput = screen.getByText(/Duration/i).parentElement?.querySelector("input");
    const thumbnailSelect = screen.getByText("Lesson thumbnail").parentElement?.querySelector("select");
    const gallerySelect = screen.getByText("Image gallery").parentElement?.querySelector("select");
    expect(durationInput).not.toBeNull(); expect(thumbnailSelect).not.toBeNull(); expect(gallerySelect).not.toBeNull();
    fireEvent.change(durationInput!, { target: { value: "180" } });
    fireEvent.change(thumbnailSelect!, { target: { value: "11" } });
    Array.from((gallerySelect as HTMLSelectElement).options).forEach((option) => { option.selected = option.value === "11" || option.value === "12"; });
    fireEvent.change(gallerySelect!);
    const addButtons = screen.getAllByRole("button", { name: "Add lesson" });
    fireEvent.click(addButtons[addButtons.length - 1]);
    expect(createLesson.mutate).toHaveBeenCalledWith(expect.objectContaining({ title: "Visual practice", thumbnailAssetId: 11, galleryAssetIds: [11, 12], durationSeconds: 180 }));
    expect(container.querySelector("select[multiple]")).toBeInTheDocument();
  });
});
