import { beforeEach, describe, expect, it, vi } from "vitest";
import { appointments, availabilitySlots } from "../drizzle/schema";

const state = vi.hoisted(() => ({ reminderRows: [] as Array<Record<string, unknown>>, slots: [] as Array<Record<string, unknown>>, updates: [] as Array<{ table: unknown; values: unknown }> }));
const authenticateRequest = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn());
const deleteHeartbeatJob = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest } }));
vi.mock("./_core/heartbeat", () => ({ deleteHeartbeatJob }));
vi.mock("./email", () => ({
  sendEmail,
  emailTemplates: { bookingReminder: (name: string, service: string) => ({ subject: `${service} reminder`, text: name, html: "<p>reminder</p>" }) },
}));
vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: (table: unknown) => {
        const rows = table === appointments ? state.reminderRows : table === availabilitySlots ? state.slots : [];
        const query = { limit: async () => rows, then: (resolve: (value: Array<Record<string, unknown>>) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject) };
        const joined = { innerJoin: () => joined, where: () => query };
        return { innerJoin: () => joined, where: () => query };
      },
    }),
    update: (table: unknown) => ({ set: (values: unknown) => { state.updates.push({ table, values }); return { where: async () => undefined }; } }),
  }),
}));

const { handleAppointmentReminder } = await import("./appointmentReminder");

function response() {
  const result = { status: vi.fn(), json: vi.fn() };
  result.status.mockReturnValue(result);
  result.json.mockReturnValue(result);
  return result;
}

beforeEach(() => {
  state.reminderRows = [];
  state.slots = [];
  state.updates.length = 0;
  authenticateRequest.mockReset();
  sendEmail.mockReset();
  deleteHeartbeatJob.mockClear();
});

describe("scheduled appointment reminders", () => {
  it("accepts only authenticated scheduler calls", async () => {
    authenticateRequest.mockResolvedValue({ isCron: false });
    const res = response();

    await handleAppointmentReminder({} as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "cron-only" });
  });

  it("delivers one reminder, records it against the appointment, and removes its one-time job", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-reminder-44" });
    sendEmail.mockResolvedValue({ id: 1, sent: true });
    state.reminderRows = [{ appointments: { id: 44, slotId: 55, status: "confirmed", reminderSentAt: null, createdAt: new Date("2030-02-01T12:00:00Z"), meetingUrl: null }, services: { id: 4, creatorId: 3, name: "Office hours", locationDetails: "https://meet.example/office" }, customers: { id: 9, email: "member@example.com", name: "Avery" } }];
    state.slots = [{ id: 55, startsAt: new Date("2030-02-02T12:00:00Z") }];
    const res = response();

    await handleAppointmentReminder({} as never, res as never);

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "member@example.com", subject: "Office hours reminder" }), expect.objectContaining({ kind: "booking_reminder", creatorId: 3, customerId: 9 }));
    expect(state.updates).toContainEqual(expect.objectContaining({ table: appointments, values: expect.objectContaining({ reminderScheduleTaskUid: null }) }));
    expect(deleteHeartbeatJob).toHaveBeenCalledWith("task-reminder-44", "");
    expect(res.json).toHaveBeenCalledWith({ ok: true, sent: true });
  });

  it("does not resend a reminder that was already delivered", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-reminder-44" });
    state.reminderRows = [{ appointments: { id: 44, slotId: null, status: "confirmed", reminderSentAt: new Date("2030-02-01T11:00:00Z"), createdAt: new Date("2030-02-01T12:00:00Z"), meetingUrl: null }, services: { id: 4, creatorId: 3, name: "Office hours", locationDetails: null }, customers: { id: 9, email: "member@example.com", name: "Avery" } }];
    const res = response();

    await handleAppointmentReminder({} as never, res as never);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(state.updates).toHaveLength(0);
    expect(deleteHeartbeatJob).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, skipped: "not-sendable" });
  });
});
