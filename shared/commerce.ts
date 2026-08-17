export function makeProductSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 180) || "item";
}

export function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)));
}

export function calculateMonthlyRecurringRevenue(plans: Array<{ price: string | number; interval: "month" | "year"; status: "active" | "past_due" | "cancelled" | "paused" }>): number {
  return plans
    .filter((plan) => plan.status === "active")
    .reduce((total, plan) => total + Number(plan.price) / (plan.interval === "year" ? 12 : 1), 0);
}
