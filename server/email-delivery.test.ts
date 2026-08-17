import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emailDeliveries } from "../drizzle/schema";

const state = vi.hoisted(() => ({ inserts: [] as Array<{ table: unknown; values: unknown }>, updates: [] as Array<{ table: unknown; values: unknown }> }));
const sendMail = vi.hoisted(() => vi.fn(async () => ({ messageId: "smtp-message-77" })));

vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));
vi.mock("./db", () => ({
  getDb: async () => ({
    insert: (table: unknown) => ({ values: (values: unknown) => { state.inserts.push({ table, values }); return [{ insertId: 77 }]; } }),
    update: (table: unknown) => ({ set: (values: unknown) => { state.updates.push({ table, values }); return { where: async () => undefined }; } }),
  }),
}));

const { emailTemplates, sendEmail } = await import("./email");

beforeEach(() => {
  state.inserts.length = 0;
  state.updates.length = 0;
  sendMail.mockClear();
  vi.stubEnv("SMTP_HOST", "smtp.example.com");
  vi.stubEnv("SMTP_PORT", "587");
  vi.stubEnv("SMTP_USERNAME", "sender");
  vi.stubEnv("SMTP_PASSWORD", "secret");
  vi.stubEnv("EMAIL_FROM", "CreaDock <no-reply@example.com>");
});

afterEach(() => vi.unstubAllEnvs());

describe("appointment reminder email deliveries", () => {
  it("records a booking_reminder delivery and marks it sent after SMTP accepts the message", async () => {
    const result = await sendEmail(
      { to: "Member@Example.com", ...emailTemplates.bookingReminder("Avery", "Office hours", new Date("2030-02-02T12:00:00Z"), "https://meet.example/office") },
      { kind: "booking_reminder", creatorId: 3, customerId: 9 },
    );

    expect(result).toEqual({ id: 77, sent: true });
    expect(state.inserts).toContainEqual(expect.objectContaining({ table: emailDeliveries, values: expect.objectContaining({ kind: "booking_reminder", creatorId: 3, customerId: 9, recipient: "member@example.com", status: "queued" }) }));
    expect(state.updates).toContainEqual(expect.objectContaining({ table: emailDeliveries, values: expect.objectContaining({ status: "sent", providerMessageId: "smtp-message-77" }) }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "Member@Example.com", subject: "Reminder: Office hours is coming up" }));
  });
});
