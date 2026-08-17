// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    storefront: {
      productDetail: {
        useQuery: () => ({
          isLoading: false,
          data: {
            creator: { displayName: "Badar", accentColor: "#2255cc", visualSettings: { backgroundColor: "#f5f5f0", buttonColor: "#2255cc" } },
            product: { name: "VoiceDelta", type: "digital", price: "5.00", shortDescription: "A clear voice tool", description: "Full description", thumbnailUrl: null, benefits: ["Instant access"], productPageSettings: { ctaLabel: "Buy VoiceDelta" } },
            variants: [{ id: 1, name: "Personal", priceDelta: "0.00" }],
          },
        }),
      },
    },
  },
}));

import PublicProductPage from "./PublicProductPage";

afterEach(() => cleanup());

describe("CreaDock public product page", () => {
  it("renders a published product’s saved details and call to action", () => {
    window.history.pushState({}, "", "/c/badar/p/voicedelta");
    render(<PublicProductPage />);
    expect(screen.getByRole("heading", { name: "VoiceDelta" })).toBeInTheDocument();
    expect(screen.getByText("Instant access")).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy VoiceDelta" })).toBeInTheDocument();
  });
});
