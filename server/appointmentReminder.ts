import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { appointments, availabilitySlots, customers, services } from "../drizzle/schema";
import { getDb } from "./db";
import { emailTemplates, sendEmail } from "./email";
import { deleteHeartbeatJob } from "./_core/heartbeat";
import { sdk } from "./_core/sdk";

export async function handleAppointmentReminder(req: Request, res: Response) {
  try {
    const caller = await sdk.authenticateRequest(req);
    if (!caller.isCron || !caller.taskUid) return res.status(403).json({ error: "cron-only" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "database unavailable" });
    const row = (await db.select().from(appointments).innerJoin(services, eq(appointments.serviceId, services.id)).innerJoin(customers, eq(appointments.customerId, customers.id)).where(eq(appointments.reminderScheduleTaskUid, caller.taskUid)).limit(1))[0];
    if (!row) return res.json({ ok: true, skipped: "orphan" });
    if (row.appointments.status === "cancelled" || row.appointments.reminderSentAt) return res.json({ ok: true, skipped: "not-sendable" });
    const slot = row.appointments.slotId ? (await db.select().from(availabilitySlots).where(eq(availabilitySlots.id, row.appointments.slotId)).limit(1))[0] : undefined;
    const sent = await sendEmail({ to: row.customers.email, ...emailTemplates.bookingReminder(row.customers.name || "there", row.services.name, slot?.startsAt || row.appointments.createdAt, row.appointments.meetingUrl || row.services.locationDetails) }, { kind: "booking_reminder", creatorId: row.services.creatorId, customerId: row.customers.id });
    if (sent.sent) {
      await db.update(appointments).set({ reminderSentAt: new Date(), reminderScheduleTaskUid: null }).where(eq(appointments.id, row.appointments.id));
      await deleteHeartbeatJob(caller.taskUid, "");
    }
    return res.json({ ok: true, sent: sent.sent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Appointment reminder failed";
    return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
  }
}
