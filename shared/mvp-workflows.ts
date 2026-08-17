export function mvpPaidOrder() {
  return { status: "paid" as const };
}

export function mvpActiveMembership() {
  return { status: "active" as const };
}

export function mvpConfirmedBooking() {
  return { status: "confirmed" as const };
}

export function mergeCompletedLesson(existing: number[], lessonId: number): number[] {
  return Array.from(new Set([...existing, lessonId]));
}

export function mvpCampaignSent(sentAt = new Date()) {
  return { status: "sent" as const, sentAt };
}
