import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { eq } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { getFirstPartyUser } from "../auth";
import { getDb, getOrCreateCreator } from "../db";
import { mediaAssets } from "../../drizzle/schema";
import { storagePut } from "../storage";
import { handleStripeWebhook } from "../stripeWebhook";
import { handleAppointmentReminder } from "../appointmentReminder";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function mediaKind(contentType: string): "image" | "video" | "audio" | "document" | "archive" | "other" {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  if (contentType.includes("zip") || contentType.includes("compressed")) return "archive";
  if (contentType.includes("pdf") || contentType.includes("document") || contentType.includes("text")) return "document";
  return "other";
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  app.post("/api/uploads/product", express.raw({ type: "application/octet-stream", limit: "50mb" }), async (req, res) => {
    try {
      const user = await getFirstPartyUser(req);
      if (!user) return res.status(401).json({ error: "Sign in to upload a product file" });
      const creator = await getOrCreateCreator(user);
      const rawName = typeof req.query.name === "string" ? req.query.name : "download";
      const fileName = rawName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 180) || "download";
      const contentType = typeof req.headers["x-content-type"] === "string" ? req.headers["x-content-type"] : "application/octet-stream";
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: "A file is required" });
      const stored = await storagePut(`creators/${creator.id}/digital-products/${fileName}`, req.body, contentType);
      return res.status(201).json({ ...stored, sizeBytes: req.body.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      return res.status(500).json({ error: message });
    }
  });
  app.post("/api/uploads/media", express.raw({ type: "application/octet-stream", limit: "100mb" }), async (req, res) => {
    try {
      const user = await getFirstPartyUser(req);
      if (!user) return res.status(401).json({ error: "Sign in to upload media" });
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: "A media file is required" });
      const creator = await getOrCreateCreator(user);
      const db = await getDb();
      if (!db) return res.status(503).json({ error: "Media storage is temporarily unavailable" });
      const rawName = typeof req.query.name === "string" ? req.query.name : "media";
      const fileName = rawName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 180) || "media";
      const contentType = typeof req.headers["x-content-type"] === "string" ? req.headers["x-content-type"] : "application/octet-stream";
      const stored = await storagePut(`creators/${creator.id}/media/${Date.now()}-${fileName}`, req.body, contentType);
      const result = await db.insert(mediaAssets).values({ creatorId: creator.id, name: fileName, fileKey: stored.key, url: stored.url, mimeType: contentType, kind: mediaKind(contentType), sizeBytes: req.body.length });
      const asset = (await db.select().from(mediaAssets).where(eq(mediaAssets.id, Number(result[0].insertId))).limit(1))[0];
      return res.status(201).json(asset);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Media upload failed";
      return res.status(500).json({ error: message });
    }
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.post("/api/scheduled/appointmentReminder", handleAppointmentReminder);
  registerStorageProxy(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
