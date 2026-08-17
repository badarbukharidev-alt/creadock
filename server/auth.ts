import bcrypt from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { auditLogs, authTokens, customers, type User, users, userSessions } from "../drizzle/schema";
import { getDb } from "./db";

export const CREADOCK_SESSION_COOKIE = "creadock_session";
const SESSION_MS = 1000 * 60 * 60 * 24 * 30;
const SHORT_SESSION_MS = 1000 * 60 * 60 * 12;
const VERIFY_TOKEN_MS = 1000 * 60 * 60 * 24;
const RESET_TOKEN_MS = 1000 * 60 * 30;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 1000 * 60 * 15;

const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const normalizeUsername = (username: string) => username.trim().toLowerCase();
export const isInitialAdminEmail = (email: string) => Boolean(process.env.ADMIN_EMAIL && normalizeEmail(process.env.ADMIN_EMAIL) === normalizeEmail(email));

export function validatePassword(password: string) {
  if (password.length < 12 || password.length > 128) return "Use 12–128 characters.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) return "Use upper and lower case letters, a number, and a symbol.";
  return null;
}

function clientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(",")[0]?.trim() || req.ip || null;
}

function isSecureRequest(req: Request) {
  if (req.secure || req.protocol === "https") return true;
  const forwarded = req.headers["x-forwarded-proto"];
  return typeof forwarded === "string" && forwarded.split(",").some((value) => value.trim() === "https");
}

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db;
}

async function writeAudit(actorUserId: number | null, action: string, entityType: string, entityId: string | number | null, req?: Request, metadata?: Record<string, unknown>) {
  const db = await dbOrThrow();
  await db.insert(auditLogs).values({ actorUserId, action, entityType, entityId: entityId === null ? null : String(entityId), ipAddress: req ? clientIp(req) : null, metadata: metadata ?? null });
}

async function createAuthToken(userId: number, type: "email_verification" | "password_reset", expiresInMs: number) {
  const db = await dbOrThrow();
  const rawToken = randomBytes(32).toString("base64url");
  await db.insert(authTokens).values({ userId, type, tokenHash: tokenHash(rawToken), expiresAt: new Date(Date.now() + expiresInMs) });
  return rawToken;
}

function setSessionCookie(res: Response, req: Request, value: string, remember: boolean) {
  res.cookie(CREADOCK_SESSION_COOKIE, value, { httpOnly: true, secure: isSecureRequest(req), sameSite: "lax", path: "/", maxAge: remember ? SESSION_MS : SHORT_SESSION_MS });
}

export async function createUserSession(user: User, req: Request, res: Response, remember: boolean) {
  const db = await dbOrThrow();
  const sessionId = randomBytes(18).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  const rawToken = `${sessionId}.${secret}`;
  const expiresAt = new Date(Date.now() + (remember ? SESSION_MS : SHORT_SESSION_MS));
  await db.insert(userSessions).values({ id: sessionId, userId: user.id, tokenHash: tokenHash(rawToken), expiresAt, ipAddress: clientIp(req), userAgent: req.get("user-agent")?.slice(0, 512) || null });
  setSessionCookie(res, req, rawToken, remember);
  await writeAudit(user.id, "auth.session.created", "user", user.id, req);
}

export async function getFirstPartyUser(req: Request): Promise<User | null> {
  const rawToken = req.cookies?.[CREADOCK_SESSION_COOKIE] as string | undefined;
  if (!rawToken || !rawToken.includes(".")) return null;
  const [sessionId] = rawToken.split(".");
  if (!sessionId) return null;
  const db = await dbOrThrow();
  const row = (await db.select().from(userSessions).innerJoin(users, eq(userSessions.userId, users.id)).where(and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt), gt(userSessions.expiresAt, new Date()))).limit(1))[0];
  if (!row || !safeEqual(row.userSessions.tokenHash, tokenHash(rawToken))) return null;
  if (row.users.accountStatus !== "active" || !row.users.emailVerifiedAt) return null;
  await db.update(userSessions).set({ lastUsedAt: new Date() }).where(eq(userSessions.id, sessionId));
  return row.users;
}

export async function signUp(input: { name: string; email: string; username: string; password: string }, req: Request) {
  const passwordIssue = validatePassword(input.password);
  if (passwordIssue) return { ok: false as const, code: "BAD_REQUEST", message: passwordIssue };
  const db = await dbOrThrow();
  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username);
  if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(username)) return { ok: false as const, code: "BAD_REQUEST", message: "Username must be 3–32 lowercase letters, numbers, hyphens, or underscores." };
  const existing = (await db.select({ id: users.id }).from(users).where(and(eq(users.normalizedEmail, email))).limit(1))[0];
  if (existing) return { ok: false as const, code: "CONFLICT", message: "An account with this email already exists." };
  const takenUsername = (await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1))[0];
  if (takenUsername) return { ok: false as const, code: "CONFLICT", message: "This username is already in use." };
  const passwordHash = await bcrypt.hash(input.password, 12);
  const role = isInitialAdminEmail(email) ? "super_admin" as const : "user" as const;
  const result = await db.insert(users).values({ openId: `local_${randomBytes(18).toString("base64url")}`, name: input.name.trim(), email, normalizedEmail: email, username, passwordHash, loginMethod: "password", role, accountStatus: "pending" });
  const userId = Number(result[0].insertId);
  const verificationToken = await createAuthToken(userId, "email_verification", VERIFY_TOKEN_MS);
  await writeAudit(userId, "auth.signup", "user", userId, req);
  return { ok: true as const, userId, verificationToken };
}

export async function verifyEmail(token: string, req: Request, res: Response) {
  const db = await dbOrThrow();
  const row = (await db.select().from(authTokens).innerJoin(users, eq(authTokens.userId, users.id)).where(and(eq(authTokens.tokenHash, tokenHash(token)), eq(authTokens.type, "email_verification"), isNull(authTokens.consumedAt), gt(authTokens.expiresAt, new Date()))).limit(1))[0];
  if (!row) return { ok: false as const, message: "This verification link is invalid or has expired." };
  const now = new Date();
  await db.update(authTokens).set({ consumedAt: now }).where(eq(authTokens.id, row.authTokens.id));
  await db.update(users).set({ emailVerifiedAt: now, accountStatus: "active", failedLoginCount: 0 }).where(eq(users.id, row.users.id));
  if (row.users.normalizedEmail) await db.update(customers).set({ userId: row.users.id }).where(eq(customers.email, row.users.normalizedEmail));
  const user = { ...row.users, emailVerifiedAt: now, accountStatus: "active" as const };
  await createUserSession(user, req, res, true);
  await writeAudit(user.id, "auth.email.verified", "user", user.id, req);
  return { ok: true as const, user };
}

export async function login(input: { email: string; password: string; remember: boolean }, req: Request, res: Response) {
  const db = await dbOrThrow();
  const email = normalizeEmail(input.email);
  const user = (await db.select().from(users).where(eq(users.normalizedEmail, email)).limit(1))[0];
  const invalid = { ok: false as const, code: "UNAUTHORIZED", message: "Invalid email or password." };
  if (!user || !user.passwordHash) return invalid;
  if (user.accountStatus === "suspended") return { ok: false as const, code: "FORBIDDEN", message: "This account is suspended." };
  if (user.lockedUntil && user.lockedUntil > new Date()) return { ok: false as const, code: "TOO_MANY_REQUESTS", message: "Too many attempts. Please wait before trying again." };
  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    const failedLoginCount = user.failedLoginCount + 1;
    await db.update(users).set({ failedLoginCount, lockedUntil: failedLoginCount >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MS) : null }).where(eq(users.id, user.id));
    await writeAudit(user.id, "auth.login.failed", "user", user.id, req);
    return invalid;
  }
  if (!user.emailVerifiedAt || user.accountStatus !== "active") return { ok: false as const, code: "FORBIDDEN", message: "Please verify your email before signing in." };
  await db.update(users).set({ failedLoginCount: 0, lockedUntil: null, lastSignedIn: new Date() }).where(eq(users.id, user.id));
  await createUserSession(user, req, res, input.remember);
  await writeAudit(user.id, "auth.login.succeeded", "user", user.id, req);
  return { ok: true as const, user };
}

export async function requestPasswordReset(emailInput: string, req: Request) {
  const db = await dbOrThrow();
  const user = (await db.select().from(users).where(eq(users.normalizedEmail, normalizeEmail(emailInput))).limit(1))[0];
  if (!user || !user.emailVerifiedAt || user.accountStatus !== "active") return { ok: true as const, resetToken: null };
  const resetToken = await createAuthToken(user.id, "password_reset", RESET_TOKEN_MS);
  await writeAudit(user.id, "auth.password_reset.requested", "user", user.id, req);
  return { ok: true as const, resetToken, user };
}

export async function resetPassword(token: string, newPassword: string, req: Request) {
  const issue = validatePassword(newPassword);
  if (issue) return { ok: false as const, message: issue };
  const db = await dbOrThrow();
  const row = (await db.select().from(authTokens).innerJoin(users, eq(authTokens.userId, users.id)).where(and(eq(authTokens.tokenHash, tokenHash(token)), eq(authTokens.type, "password_reset"), isNull(authTokens.consumedAt), gt(authTokens.expiresAt, new Date()))).limit(1))[0];
  if (!row) return { ok: false as const, message: "This reset link is invalid or has expired." };
  const now = new Date();
  await db.update(users).set({ passwordHash: await bcrypt.hash(newPassword, 12), failedLoginCount: 0, lockedUntil: null, lastPasswordChangedAt: now }).where(eq(users.id, row.users.id));
  await db.update(authTokens).set({ consumedAt: now }).where(eq(authTokens.id, row.authTokens.id));
  await db.update(userSessions).set({ revokedAt: now }).where(and(eq(userSessions.userId, row.users.id), isNull(userSessions.revokedAt)));
  await writeAudit(row.users.id, "auth.password_reset.completed", "user", row.users.id, req);
  return { ok: true as const };
}

export async function logoutCurrent(req: Request, res: Response) {
  const rawToken = req.cookies?.[CREADOCK_SESSION_COOKIE] as string | undefined;
  const sessionId = rawToken?.split(".")[0];
  if (sessionId) { const db = await dbOrThrow(); await db.update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.id, sessionId)); }
  res.clearCookie(CREADOCK_SESSION_COOKIE, { httpOnly: true, secure: isSecureRequest(req), sameSite: "lax", path: "/" });
}

export async function logoutAll(userId: number, req: Request, res: Response) {
  const db = await dbOrThrow();
  await db.update(userSessions).set({ revokedAt: new Date() }).where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
  await logoutCurrent(req, res);
  await writeAudit(userId, "auth.sessions.revoked", "user", userId, req);
}
