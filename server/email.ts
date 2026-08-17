import nodemailer from "nodemailer";
import type { Request } from "express";
import { eq } from "drizzle-orm";
import { emailDeliveries } from "../drizzle/schema";
import { getDb } from "./db";

type EmailKind = "verification" | "password_reset" | "welcome" | "purchase_confirmation" | "product_delivery" | "booking_confirmation" | "booking_reminder" | "membership_confirmation" | "broadcast";
type EmailMessage = { to: string; subject: string; html: string; text: string };
type DeliveryContext = { creatorId?: number | null; userId?: number | null; customerId?: number | null; campaignId?: number | null; kind: EmailKind };

export interface EmailProvider { isConfigured(): boolean; send(message: EmailMessage): Promise<{ messageId: string }>; }

class SMTPProvider implements EmailProvider {
  isConfigured() { return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USERNAME && process.env.SMTP_PASSWORD && process.env.EMAIL_FROM); }
  async send(message: EmailMessage) {
    if (!this.isConfigured()) throw new Error("SMTP is not configured. Add the sender and SMTP credentials in the platform settings.");
    const port = Number(process.env.SMTP_PORT);
    const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD } });
    const result = await transport.sendMail({ from: process.env.EMAIL_FROM, to: message.to, subject: message.subject, html: message.html, text: message.text });
    return { messageId: result.messageId };
  }
}

const provider = new SMTPProvider();
export const smtpStatus = () => ({ provider: "smtp", configured: provider.isConfigured(), host: process.env.SMTP_HOST || null, port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null, from: process.env.EMAIL_FROM || null });

function safeText(value: string) { return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] || character); }
function emailLayout(title: string, body: string, action?: { label: string; href: string }) { const actionHtml = action ? `<p style="margin:28px 0"><a href="${safeText(action.href)}" style="display:inline-block;border-radius:8px;background:#020617;color:#fff;padding:12px 18px;text-decoration:none;font-weight:600">${safeText(action.label)}</a></p>` : ""; return `<!doctype html><html><body style="margin:0;background:#f7f7f3;font-family:Arial,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:600px;background:#fff;border:1px solid #e2e8f0;border-radius:20px"><tr><td style="padding:32px"><p style="margin:0 0 28px;font-weight:700">CreaDock</p><h1 style="margin:0 0 14px;font-size:28px;letter-spacing:-.6px">${safeText(title)}</h1><div style="font-size:16px;line-height:1.6;color:#475569">${body}</div>${actionHtml}<p style="margin:32px 0 0;color:#94a3b8;font-size:12px">This message was sent by CreaDock. If you did not expect it, you can safely ignore it.</p></td></tr></table></td></tr></table></body></html>`; }

function appUrl(req?: Request) { const configured = process.env.APP_URL?.replace(/\/$/, ""); if (configured) return configured; const origin = req?.headers.origin; if (origin) return origin.replace(/\/$/, ""); const host = req?.get("host"); return host ? `${req?.secure ? "https" : "http"}://${host}` : ""; }

export const emailTemplates = {
  verification: (name: string, token: string, req?: Request) => ({ subject: "Verify your CreaDock account", text: `Hi ${name}, verify your account: ${appUrl(req)}/verify-email?token=${token}`, html: emailLayout("Verify your CreaDock account", `<p>Hi ${safeText(name)},</p><p>Confirm your email address to activate your CreaDock account and start building your storefront.</p>`, { label: "Verify email", href: `${appUrl(req)}/verify-email?token=${token}` }) }),
  passwordReset: (name: string, token: string, req?: Request) => ({ subject: "Reset your CreaDock password", text: `Hi ${name}, reset your password: ${appUrl(req)}/reset-password?token=${token}`, html: emailLayout("Reset your password", `<p>Hi ${safeText(name)},</p><p>Use the secure link below to choose a new CreaDock password. This link expires in 30 minutes.</p>`, { label: "Reset password", href: `${appUrl(req)}/reset-password?token=${token}` }) }),
  welcome: (name: string) => ({ subject: "Welcome to CreaDock", text: `Welcome to CreaDock, ${name}. Your creator workspace is ready.`, html: emailLayout("Welcome to CreaDock", `<p>Hi ${safeText(name)},</p><p>Your creator workspace is ready. Start with your profile, then create your first offer.</p>`) }),
  purchase: (name: string, item: string) => ({ subject: "Your CreaDock purchase is confirmed", text: `Hi ${name}, your purchase of ${item} is confirmed.`, html: emailLayout("Purchase confirmed", `<p>Hi ${safeText(name)},</p><p>Your purchase of <strong>${safeText(item)}</strong> is confirmed.</p>`) }),
  delivery: (name: string, item: string, href: string) => ({ subject: "Your product is ready", text: `Hi ${name}, download ${item}: ${href}`, html: emailLayout("Your product is ready", `<p>Hi ${safeText(name)},</p><p>Your purchase of <strong>${safeText(item)}</strong> is ready to access.</p>`, { label: "Access your product", href }) }),
  booking: (name: string, service: string) => ({ subject: "Your booking is confirmed", text: `Hi ${name}, your booking for ${service} is confirmed.`, html: emailLayout("Booking confirmed", `<p>Hi ${safeText(name)},</p><p>Your booking for <strong>${safeText(service)}</strong> is confirmed.</p>`) }),
  bookingReminder: (name: string, service: string, startsAt: Date, location?: string | null) => ({ subject: `Reminder: ${service} is coming up`, text: `Hi ${name}, your ${service} appointment is scheduled for ${startsAt.toLocaleString()}${location ? `. Location: ${location}` : ""}.`, html: emailLayout("Your appointment is coming up", `<p>Hi ${safeText(name)},</p><p>Your <strong>${safeText(service)}</strong> appointment is scheduled for <strong>${safeText(startsAt.toLocaleString())}</strong>.</p>${location ? `<p>Location or meeting details: ${safeText(location)}</p>` : ""}`) }),
  membership: (name: string, plan: string) => ({ subject: "Your membership is confirmed", text: `Hi ${name}, your ${plan} membership is active.`, html: emailLayout("Membership confirmed", `<p>Hi ${safeText(name)},</p><p>Your <strong>${safeText(plan)}</strong> membership is active.</p>`) }),
};

export async function sendEmail(message: EmailMessage, context: DeliveryContext) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const result = await db.insert(emailDeliveries).values({ ...context, recipient: message.to.toLowerCase(), subject: message.subject, status: "queued" });
  const deliveryId = Number(result[0].insertId);
  try {
    const sent = await provider.send(message);
    await db.update(emailDeliveries).set({ status: "sent", providerMessageId: sent.messageId, sentAt: new Date() }).where(eq(emailDeliveries.id, deliveryId));
    return { id: deliveryId, sent: true };
  } catch (error) {
    await db.update(emailDeliveries).set({ status: "failed", errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Email delivery failed" }).where(eq(emailDeliveries.id, deliveryId));
    return { id: deliveryId, sent: false };
  }
}
