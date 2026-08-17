import { describe, expect, it } from "vitest";
import { mergeCompletedLesson, mvpActiveMembership, mvpCampaignSent, mvpConfirmedBooking, mvpPaidOrder } from "../shared/mvp-workflows";

describe("CreaDock MVP workflow success states", () => {
  it("completes a product purchase as a paid order", () => {
    expect(mvpPaidOrder()).toEqual({ status: "paid" });
  });

  it("activates membership access after an MVP join", () => {
    expect(mvpActiveMembership()).toEqual({ status: "active" });
  });

  it("confirms an MVP booking reservation", () => {
    expect(mvpConfirmedBooking()).toEqual({ status: "confirmed" });
  });

  it("records lesson completion once and preserves earlier progress", () => {
    expect(mergeCompletedLesson([3, 7], 7)).toEqual([3, 7]);
    expect(mergeCompletedLesson([3, 7], 9)).toEqual([3, 7, 9]);
  });

  it("marks a saved campaign as sent with its completion timestamp", () => {
    const sentAt = new Date("2026-08-17T00:00:00.000Z");
    expect(mvpCampaignSent(sentAt)).toEqual({ status: "sent", sentAt });
  });
});
